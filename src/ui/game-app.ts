import config from '../../config.json';
import prologoData from '../scripts/prologo.yaml';
import { AdaptiveAudioEngine, MUSIC_TRACKS } from '../engine/audio';
import { AtmosphereCanvas } from '../engine/effects';
import { getLocale, setLocale, t } from '../engine/i18n';
import {
  deleteSlot,
  exportAllSavesAsJson,
  getMostRecentSave,
  importSavesFromJson,
  listAllSaves,
  loadFromSlot,
  saveToSlot,
} from '../engine/save';
import {
  applyVariableMutations,
  cloneVariables,
  createInitialVariables,
  evaluateCondition,
  loadPersistentMeta,
  loadSettings,
  savePersistentMeta,
  saveSettings,
} from '../engine/state';
import { parseDialogueText, stripFormatting } from '../engine/text-parser';
import type {
  BacklogEntry,
  GameSettings,
  GameVariables,
  LocaleCode,
  PersistentMeta,
  SaveSlotData,
  SceneDefinition,
  ScriptChoice,
  ScriptChoiceOption,
  ScriptHotspot,
  ScriptNode,
} from '../engine/types';
import { CHARACTER_BIOS, CHARACTER_DIRECTORY, MEMORY_OBJECTS, NOTEBOOK_WORDS } from '../game/notebook-data';

interface RuntimeSnapshot {
  sceneId: string;
  pc: number;
  bg: string;
  cg: string | null;
  music: string | null;
  ambient: string | null;
  sprites: Record<string, { expr: string; pos: 'left' | 'center' | 'right' }>;
  vars: GameVariables;
  backlog: BacklogEntry[];
}

export class FarolGameApp {
  private root: HTMLElement;
  private scenes: Map<string, SceneDefinition> = new Map();
  private settings: GameSettings;
  private meta: PersistentMeta;
  private vars: GameVariables = createInitialVariables();
  private backlog: BacklogEntry[] = [];
  private rewindStack: RuntimeSnapshot[] = [];

  private currentSceneId = 'prologo_comboio';
  private pc = 0;
  private inlineQueue: ScriptNode[] = [];

  private currentBg = './assets/bg/title_farol.webp';
  private currentCg: string | null = null;
  private currentMusic: string | null = null;
  private currentAmbient: string | null = null;
  private activeSprites: Record<string, { expr: string; pos: 'left' | 'center' | 'right' }> = {};
  private currentSpeakerId: string | undefined = undefined;

  private inTitleScreen = true;
  private isTyping = false;
  private skipTypingRequested = false;
  private autoMode = false;
  private skipMode = false;
  private autoTimer: number | null = null;
  private choiceTimer: number | null = null;

  private audio: AdaptiveAudioEngine;
  private fx: AtmosphereCanvas | null = null;

  // DOM references
  private stageEl!: HTMLElement;
  private bgEl!: HTMLElement;
  private cgEl!: HTMLElement;
  private spriteStageEl!: HTMLElement;
  private topHudEl!: HTMLElement;
  private toastStackEl!: HTMLElement;
  private captionEl!: HTMLElement;
  private dialogueWrapEl!: HTMLElement;
  private speakerHeaderEl!: HTMLElement;
  private speakerTagEl!: HTMLElement;
  private dialogueTextEl!: HTMLElement;
  private overlayContainerEl!: HTMLElement;
  private modalContainerEl!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings();
    this.meta = loadPersistentMeta();
    setLocale(this.settings.locale);
    this.audio = new AdaptiveAudioEngine(this.settings);

    this.registerScripts(prologoData as SceneDefinition[]);
    this.buildDom();
    this.applyAccessibilityClasses();
    this.bindKeyboardAndTouch();
    this.renderTitleScreen();
  }

  private registerScripts(list: SceneDefinition[]): void {
    for (const scene of list) {
      this.scenes.set(scene.scene, scene);
    }
  }

  private buildDom(): void {
    this.root.innerHTML = `
      <div class="stage-frame" id="stage-frame">
        <div class="bg-layer ken-burns" id="bg-layer"></div>
        <div class="sprite-stage" id="sprite-stage"></div>
        <div class="cg-layer" id="cg-layer"></div>
        <canvas class="fx-canvas" id="fx-canvas"></canvas>
        <div class="top-hud" id="top-hud" style="display:none"></div>
        <div class="toast-stack" id="toast-stack" aria-live="polite"></div>
        <div class="sound-caption" id="sound-caption" style="display:none" aria-live="polite"></div>
        <div class="dialogue-wrap" id="dialogue-wrap" style="display:none">
          <div class="speaker-header" id="speaker-header" style="display:none">
            <span class="speaker-ornament">✦</span>
            <span class="speaker-tag" id="speaker-tag"></span>
          </div>
          <div class="dialogue-box" id="dialogue-box" role="button" tabindex="0" aria-label="Avançar diálogo">
            <div class="dialogue-text" id="dialogue-text" aria-live="polite"></div>
            <div class="next-indicator">Continuar →</div>
          </div>
        </div>
        <div id="overlay-container"></div>
        <div id="modal-container"></div>
      </div>
    `;

    this.stageEl = this.root.querySelector('#stage-frame')!;
    this.bgEl = this.root.querySelector('#bg-layer')!;
    this.cgEl = this.root.querySelector('#cg-layer')!;
    this.spriteStageEl = this.root.querySelector('#sprite-stage')!;
    this.topHudEl = this.root.querySelector('#top-hud')!;
    this.toastStackEl = this.root.querySelector('#toast-stack')!;
    this.captionEl = this.root.querySelector('#sound-caption')!;
    this.dialogueWrapEl = this.root.querySelector('#dialogue-wrap')!;
    this.speakerHeaderEl = this.root.querySelector('#speaker-header')!;
    this.speakerTagEl = this.root.querySelector('#speaker-tag')!;
    this.dialogueTextEl = this.root.querySelector('#dialogue-text')!;
    this.overlayContainerEl = this.root.querySelector('#overlay-container')!;
    this.modalContainerEl = this.root.querySelector('#modal-container')!;

    const canvas = this.root.querySelector('#fx-canvas') as HTMLCanvasElement;
    this.fx = new AtmosphereCanvas(canvas);
    this.fx.start();

    const dialogueBox = this.root.querySelector('#dialogue-box')!;
    dialogueBox.addEventListener('click', () => {
      this.audio.unlock();
      this.onUserAdvance();
    });
  }

  private applyAccessibilityClasses(): void {
    document.body.classList.remove(
      'font-hyperlegible',
      'font-dyslexic',
      'size-small',
      'size-medium',
      'size-large',
      'high-contrast',
      'reduce-motion'
    );
    if (this.settings.fontFamily === 'hyperlegible') document.body.classList.add('font-hyperlegible');
    if (this.settings.fontFamily === 'dyslexic') document.body.classList.add('font-dyslexic');
    document.body.classList.add(`size-${this.settings.fontSize}`);
    if (this.settings.highContrast) document.body.classList.add('high-contrast');
    if (this.settings.reduceMotion) document.body.classList.add('reduce-motion');
    this.fx?.setConfig({ reduceMotion: this.settings.reduceMotion });
  }

  private bindKeyboardAndTouch(): void {
    window.addEventListener('keydown', (e) => {
      if (this.modalContainerEl.innerHTML !== '') {
        if (e.key === 'Escape') this.closeModal();
        return;
      }
      if (this.inTitleScreen) return;

      if (e.key === ' ' || e.key === 'Enter') {
        if (this.overlayContainerEl.innerHTML === '') {
          e.preventDefault();
          this.audio.unlock();
          this.onUserAdvance();
        }
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        this.rewindStep();
      } else if (e.key.toLowerCase() === 'h' || e.key === 'ArrowUp') {
        this.openBacklogModal();
      } else if (e.key.toLowerCase() === 'a') {
        this.toggleAuto();
      } else if (e.key.toLowerCase() === 's') {
        this.toggleSkip();
      } else if (e.key === 'F5') {
        e.preventDefault();
        this.quickSave();
      } else if (e.key === 'F9') {
        e.preventDefault();
        this.quickLoad();
      }
    });

    let touchStartY = 0;
    this.stageEl.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    });
    this.stageEl.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (touchStartY - endY > 80 && !this.inTitleScreen && this.modalContainerEl.innerHTML === '') {
        this.openBacklogModal();
      }
    });
  }

  public renderTitleScreen(): void {
    this.inTitleScreen = true;
    this.topHudEl.style.display = 'none';
    this.dialogueWrapEl.style.display = 'none';
    this.spriteStageEl.innerHTML = '';
    this.setCg(null);
    this.setBackground('./assets/bg/title_farol.webp');

    const recentSave = getMostRecentSave(config.saveSlots);
    const endingsCount = this.meta.unlockedEndings.length;

    this.overlayContainerEl.innerHTML = `
      <div class="title-screen">
        <div class="title-brand-block">
          <div class="title-eyebrow">Névoa · Costa Oeste Portuguesa</div>
          <h1 class="title-heading">${config.title}</h1>
          <p class="title-subtitle">${t('menu.subtitle')}</p>
        </div>
        <nav class="menu-list" aria-label="Menu principal">
          <button class="menu-btn" id="btn-continue" ${recentSave ? '' : 'disabled'}>${t('menu.continue')}</button>
          <button class="menu-btn" id="btn-new">${t('menu.newGame')}</button>
          <button class="menu-btn" id="btn-chapters">${t('menu.chapters')}</button>
          <button class="menu-btn" id="btn-notebook">${t('menu.notebook')} (${this.meta.unlockedWords.length}/${NOTEBOOK_WORDS.length})</button>
          <button class="menu-btn" id="btn-gallery">${t('menu.gallery')}</button>
          <button class="menu-btn" id="btn-saves">${t('menu.saves')}</button>
          <button class="menu-btn" id="btn-options">${t('menu.options')}</button>
          <button class="menu-btn" id="btn-credits">${t('menu.credits')}</button>
        </nav>
        <div class="title-footer">
          <span>${t('menu.endingsFound', { count: endingsCount })}</span>
          <span>·</span>
          <span>Edição Portuguesa · v${config.version}</span>
        </div>
      </div>
    `;

    this.overlayContainerEl.querySelector('#btn-continue')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSfx('click');
      if (recentSave) this.restoreSaveData(recentSave);
    });

    this.overlayContainerEl.querySelector('#btn-new')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSfx('click');
      this.startNewGame('prologo_comboio');
    });

    this.overlayContainerEl.querySelector('#btn-chapters')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openChaptersModal();
    });

    this.overlayContainerEl.querySelector('#btn-notebook')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openNotebookModal();
    });

    this.overlayContainerEl.querySelector('#btn-gallery')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openGalleryModal();
    });

    this.overlayContainerEl.querySelector('#btn-saves')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openSavesModal();
    });

    this.overlayContainerEl.querySelector('#btn-options')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openOptionsModal();
    });

    this.overlayContainerEl.querySelector('#btn-credits')?.addEventListener('click', () => {
      this.audio.unlock();
      this.openCreditsModal();
    });
  }

  private renderTopHud(): void {
    this.topHudEl.style.display = 'flex';
    const scene = this.scenes.get(this.currentSceneId);
    const glowSize = 8 + this.vars.memoriasRecolhidas * 2.5;
    this.topHudEl.innerHTML = `
      <div class="hud-left-cluster">
        <div class="scene-location-pill">${scene?.title ?? 'Névoa'}</div>
        <div class="memory-beacon" title="Memórias recolhidas">
          <span class="beacon-dot" style="box-shadow: 0 0 ${glowSize}px var(--accent-beacon)"></span>
          <span>Memórias: ${this.vars.memoriasRecolhidas}/12</span>
        </div>
      </div>
      <div class="hud-controls">
        <button class="hud-btn ${this.autoMode ? 'active' : ''}" id="hud-auto">${t('hud.auto')}</button>
        <button class="hud-btn ${this.skipMode ? 'active' : ''}" id="hud-skip">${t('hud.skip')}</button>
        <button class="hud-btn" id="hud-rewind" ${this.rewindStack.length === 0 ? 'disabled' : ''}>${t('hud.rewind')}</button>
        <button class="hud-btn" id="hud-backlog">${t('hud.backlog')}</button>
        <button class="hud-btn" id="hud-notebook">${t('hud.notebook')}</button>
        <button class="hud-btn" id="hud-saves">${t('hud.saves')}</button>
        <button class="hud-btn" id="hud-options">${t('hud.options')}</button>
        <button class="hud-btn" id="hud-menu">${t('hud.menu')}</button>
      </div>
    `;

    this.topHudEl.querySelector('#hud-auto')?.addEventListener('click', () => this.toggleAuto());
    this.topHudEl.querySelector('#hud-skip')?.addEventListener('click', () => this.toggleSkip());
    this.topHudEl.querySelector('#hud-rewind')?.addEventListener('click', () => this.rewindStep());
    this.topHudEl.querySelector('#hud-backlog')?.addEventListener('click', () => this.openBacklogModal());
    this.topHudEl.querySelector('#hud-notebook')?.addEventListener('click', () => this.openNotebookModal());
    this.topHudEl.querySelector('#hud-saves')?.addEventListener('click', () => this.openSavesModal());
    this.topHudEl.querySelector('#hud-options')?.addEventListener('click', () => this.openOptionsModal());
    this.topHudEl.querySelector('#hud-menu')?.addEventListener('click', () => this.renderTitleScreen());
  }

  public startNewGame(startSceneId = 'prologo_comboio'): void {
    this.inTitleScreen = false;
    this.vars = createInitialVariables();
    this.backlog = [];
    this.rewindStack = [];
    this.inlineQueue = [];
    this.activeSprites = {};
    this.currentSpeakerId = undefined;
    this.spriteStageEl.innerHTML = '';
    this.overlayContainerEl.innerHTML = '';
    this.enterScene(startSceneId, 0);
  }

  private enterScene(sceneId: string, pc = 0): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      console.error('Scene not found:', sceneId);
      return;
    }
    this.currentSceneId = sceneId;
    this.pc = pc;
    this.inlineQueue = [];

    if (scene.bg) this.setBackground(scene.bg);
    if (scene.music !== undefined) {
      this.currentMusic = scene.music;
      this.audio.playMusic(scene.music);
    }
    if (scene.ambient !== undefined) {
      this.currentAmbient = scene.ambient;
      this.audio.playAmbient(scene.ambient);
    }

    this.renderTopHud();
    this.saveAuto();
    this.stepExecution();
  }

  private setBackground(bgPath: string): void {
    this.currentBg = bgPath;
    this.bgEl.style.backgroundImage = `url('${bgPath}')`;
    this.fx?.syncWithBackground(this.currentBg, this.currentCg);
  }

  private setCg(cgPath: string | null): void {
    this.currentCg = cgPath;
    if (cgPath) {
      this.cgEl.style.backgroundImage = `url('${cgPath}')`;
      this.cgEl.classList.add('active');
      if (!this.meta.unlockedCGs.includes(cgPath)) {
        this.meta.unlockedCGs.push(cgPath);
        savePersistentMeta(this.meta);
      }
    } else {
      this.cgEl.classList.remove('active');
    }
    this.fx?.syncWithBackground(this.currentBg, this.currentCg);
  }

  private updateSpritesDom(): void {
    this.spriteStageEl.innerHTML = '';
    const entries = Object.entries(this.activeSprites);
    for (const [charId, info] of entries) {
      const img = document.createElement('img');
      const isSpeaking = !this.currentSpeakerId || this.currentSpeakerId === charId || entries.length === 1;
      img.className = `char-sprite pos-${info.pos} ${isSpeaking ? 'speaking' : 'listening'}`;
      const relPath = `./assets/sprites/${charId}_${info.expr}.webp`;
      const assetMap = (window as unknown as { __ASSET_MAP__?: Record<string, string> }).__ASSET_MAP__;
      img.src = assetMap?.[relPath] ?? relPath;
      img.alt = CHARACTER_DIRECTORY[charId]?.displayName ?? charId;
      this.spriteStageEl.appendChild(img);
    }
  }

  private pushRewindSnapshot(): void {
    this.rewindStack.push({
      sceneId: this.currentSceneId,
      pc: this.pc,
      bg: this.currentBg,
      cg: this.currentCg,
      music: this.currentMusic,
      ambient: this.currentAmbient,
      sprites: JSON.parse(JSON.stringify(this.activeSprites)),
      vars: cloneVariables(this.vars),
      backlog: [...this.backlog],
    });
    if (this.rewindStack.length > config.rewindLimit) {
      this.rewindStack.shift();
    }
  }

  public rewindStep(): void {
    if (this.rewindStack.length === 0) return;
    const snap = this.rewindStack.pop()!;
    this.inlineQueue = [];
    this.overlayContainerEl.innerHTML = '';
    this.currentSceneId = snap.sceneId;
    this.pc = snap.pc;
    this.setBackground(snap.bg);
    this.setCg(snap.cg);
    this.currentMusic = snap.music;
    this.currentAmbient = snap.ambient;
    this.audio.playMusic(snap.music);
    this.audio.playAmbient(snap.ambient);
    this.activeSprites = snap.sprites;
    this.updateSpritesDom();
    this.vars = snap.vars;
    this.backlog = snap.backlog;
    this.renderTopHud();
    this.stepExecution(false);
  }

  private onUserAdvance(): void {
    if (this.isTyping) {
      this.skipTypingRequested = true;
      return;
    }
    this.pc++;
    this.stepExecution();
  }

  private stepExecution(recordRewind = true): void {
    if (this.autoTimer !== null) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }

    const scene = this.scenes.get(this.currentSceneId);
    if (!scene) return;

    let node: ScriptNode | undefined;
    if (this.inlineQueue.length > 0) {
      node = this.inlineQueue.shift();
      this.pc--;
    } else {
      node = scene.lines[this.pc];
    }

    if (!node) return;

    if ('bg' in node) {
      this.setBackground(node.bg);
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('cg' in node) {
      this.setCg(node.cg);
      if (node.caption) this.showSoundCaption(node.caption);
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('sprite' in node) {
      if (node.hide) {
        delete this.activeSprites[node.sprite];
      } else {
        this.activeSprites[node.sprite] = {
          expr: node.expr ?? 'neutra',
          pos: node.pos ?? 'center',
        };
      }
      this.updateSpritesDom();
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('music' in node) {
      this.currentMusic = node.music;
      this.audio.playMusic(node.music);
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('ambient' in node) {
      this.currentAmbient = node.ambient;
      this.audio.playAmbient(node.ambient);
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('set' in node) {
      applyVariableMutations(this.vars, node.set);
      this.audio.setCourageBalance(this.vars.coragem, this.vars.negacao);
      if (node.remember) this.showToast(t('hud.memoryToast'));
      this.renderTopHud();
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('if' in node) {
      const branch = evaluateCondition(node.if, this.vars) ? node.then : node.else ?? [];
      this.inlineQueue.unshift(...branch);
      this.pc++;
      this.stepExecution(recordRewind);
      return;
    }

    if ('goto' in node) {
      this.enterScene(node.goto, 0);
      return;
    }

    if ('chapterCard' in node) {
      this.presentChapterCard(node.chapterCard);
      return;
    }

    if ('hotspotScene' in node) {
      this.presentHotspotScene(node.hotspotScene);
      return;
    }

    if ('choice' in node) {
      this.presentChoice(node.choice);
      return;
    }

    if ('ending' in node) {
      this.presentEndingScreen(node.ending);
      return;
    }

    if ('text' in node) {
      if (recordRewind) this.pushRewindSnapshot();
      this.presentDialogueLine(node);
    }
  }

  private presentDialogueLine(node: Extract<ScriptNode, { text: string }>): void {
    this.dialogueWrapEl.style.display = 'flex';
    this.currentSpeakerId = node.who;

    if (node.who && node.expr && this.activeSprites[node.who]) {
      this.activeSprites[node.who].expr = node.expr;
    }
    this.updateSpritesDom();

    if (node.sfx) {
      this.audio.playSfx(node.sfx);
    }
    if (node.caption && this.settings.soundCaptions) {
      this.showSoundCaption(node.caption);
    }
    if (node.effect) {
      this.triggerVisualEffect(node.effect);
    }
    if (node.word) {
      this.unlockWord(node.word);
    }
    if (node.remember) {
      this.showToast(t('hud.memoryToast'));
    }

    const speakerInfo = node.who ? CHARACTER_DIRECTORY[node.who] : undefined;
    const speakerName = node.name ?? speakerInfo?.displayName;
    if (speakerName) {
      this.speakerHeaderEl.style.display = 'inline-flex';
      this.speakerTagEl.textContent = speakerName;
      this.speakerTagEl.style.color = speakerInfo?.color ?? 'var(--accent-beacon)';
    } else {
      this.speakerHeaderEl.style.display = 'none';
    }

    const plainText = stripFormatting(node.text, this.vars);
    this.backlog.push({
      scene: this.currentSceneId,
      pc: this.pc,
      who: node.who,
      speakerName,
      text: plainText,
    });

    const lineKey = `${this.currentSceneId}:${this.pc}:${plainText.slice(0, 24)}`;
    const wasRead = Boolean(this.meta.readLines[lineKey]);
    this.meta.readLines[lineKey] = true;
    savePersistentMeta(this.meta);

    const segments = parseDialogueText(node.text, this.vars);
    this.runTypewriter(segments, wasRead);
  }

  private async runTypewriter(
    segments: ReturnType<typeof parseDialogueText>,
    wasRead: boolean
  ): Promise<void> {
    this.isTyping = true;
    this.skipTypingRequested = false;
    this.dialogueTextEl.innerHTML = '';

    const instant = this.settings.textSpeed === 0 || (this.skipMode && wasRead);

    for (const seg of segments) {
      if (seg.type === 'pause') {
        if (!instant && !this.skipTypingRequested) {
          await new Promise((r) => setTimeout(r, seg.pauseMs ?? 300));
        }
        continue;
      }

      const targetEl: HTMLElement = seg.bold
        ? document.createElement('strong')
        : seg.italic
          ? document.createElement('em')
          : document.createElement('span');
      this.dialogueTextEl.appendChild(targetEl);

      const content = seg.text ?? '';
      if (instant || this.skipTypingRequested) {
        targetEl.textContent = content;
        continue;
      }

      for (let i = 0; i < content.length; i++) {
        if (this.skipTypingRequested) {
          targetEl.textContent = content;
          break;
        }
        targetEl.textContent += content[i];
        await new Promise((r) => setTimeout(r, this.settings.textSpeed));
      }
    }

    this.isTyping = false;
    this.skipTypingRequested = false;

    if (this.skipMode && wasRead) {
      this.autoTimer = window.setTimeout(() => {
        this.pc++;
        this.stepExecution();
      }, 110);
    } else if (this.autoMode) {
      this.autoTimer = window.setTimeout(() => {
        this.pc++;
        this.stepExecution();
      }, this.settings.autoDelay);
    }
  }

  private presentChapterCard(card: {
    number: string;
    title: string;
    quote: string;
    image: string;
  }): void {
    this.dialogueWrapEl.style.display = 'none';
    this.overlayContainerEl.innerHTML = `
      <div class="chapter-card-overlay" style="background-image: url('${card.image}')">
        <div class="chapter-card-backdrop">
          <div class="chapter-num">${card.number}</div>
          <h2 class="chapter-title">${card.title}</h2>
          <p class="chapter-quote">${card.quote}</p>
          <div style="margin-top:1.5rem;font-size:0.82rem;letter-spacing:0.18em;color:var(--accent-beacon);text-transform:uppercase">
            Clica para iniciar →
          </div>
        </div>
      </div>
    `;
    this.overlayContainerEl.querySelector('.chapter-card-overlay')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playSfx('click');
      this.overlayContainerEl.innerHTML = '';
      this.pc++;
      this.stepExecution();
    });
  }

  private presentChoice(choiceRaw: ScriptChoice | ScriptChoiceOption[]): void {
    const choiceObj: ScriptChoice = Array.isArray(choiceRaw) ? { options: choiceRaw } : choiceRaw;
    const validOptions = choiceObj.options.filter((opt) => evaluateCondition(opt.when, this.vars));
    const hasTimer = Boolean(choiceObj.timeoutMs && !this.settings.disableTimers);

    this.overlayContainerEl.innerHTML = `
      <div class="choice-overlay">
        ${choiceObj.prompt ? `<div class="choice-prompt">${choiceObj.prompt}</div>` : ''}
        ${
          hasTimer
            ? `<div class="choice-timer-bar"><div class="choice-timer-fill" id="choice-timer-fill" style="width:100%"></div></div>`
            : ''
        }
        <div id="choice-buttons-wrap" style="display:flex;flex-direction:column;gap:0.8rem"></div>
      </div>
    `;

    const wrap = this.overlayContainerEl.querySelector('#choice-buttons-wrap')!;
    const selectOption = (opt: ScriptChoiceOption) => {
      if (this.choiceTimer !== null) {
        window.clearInterval(this.choiceTimer);
        this.choiceTimer = null;
      }
      this.audio.playSfx('choice');
      this.overlayContainerEl.innerHTML = '';

      if (opt.set) {
        applyVariableMutations(this.vars, opt.set);
        this.audio.setCourageBalance(this.vars.coragem, this.vars.negacao);
      }
      if (opt.remember) {
        this.showToast(t('hud.memoryToast'));
      }
      if (opt.word) {
        this.unlockWord(opt.word);
      }
      this.renderTopHud();

      if (opt.lines && opt.lines.length > 0) {
        this.inlineQueue.unshift(...opt.lines);
      }
      if (opt.goto) {
        this.enterScene(opt.goto, 0);
      } else {
        this.pc++;
        this.stepExecution();
      }
    };

    validOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => selectOption(opt));
      wrap.appendChild(btn);
    });

    if (hasTimer && choiceObj.timeoutMs) {
      const start = performance.now();
      const total = choiceObj.timeoutMs;
      const fillEl = this.overlayContainerEl.querySelector('#choice-timer-fill') as HTMLElement | null;
      this.choiceTimer = window.setInterval(() => {
        const elapsed = performance.now() - start;
        const pct = Math.max(0, 100 - (elapsed / total) * 100);
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (elapsed >= total) {
          if (this.choiceTimer !== null) window.clearInterval(this.choiceTimer);
          this.choiceTimer = null;
          const fallback = validOptions[choiceObj.defaultIndex ?? 0] ?? validOptions[0];
          if (fallback) selectOption(fallback);
        }
      }, 60);
    }
  }

  private presentHotspotScene(hsScene: {
    prompt: string;
    hotspots: ScriptHotspot[];
    continueGoto?: string;
  }): void {
    const visitedLocal = new Set<string>();

    const renderPins = () => {
      this.dialogueWrapEl.style.display = 'none';
      const allVisited = hsScene.hotspots.every(
        (h) => visitedLocal.has(h.id) || this.vars.flags[h.id]
      );

      this.overlayContainerEl.innerHTML = `
        <div class="hotspot-layer">
          <div class="hotspot-banner">
            <span>${hsScene.prompt}</span>
            ${
              allVisited
                ? `<button class="hud-btn active" id="btn-hs-continue">Continuar →</button>`
                : ''
            }
          </div>
          ${hsScene.hotspots
            .map((h) => {
              const done = visitedLocal.has(h.id) || Boolean(this.vars.flags[h.id]);
              return `<button class="hotspot-pin ${done ? 'visited' : ''}" data-id="${h.id}" style="left:${h.x}%;top:${h.y}%" title="${h.title}">✦</button>`;
            })
            .join('')}
        </div>
      `;

      this.overlayContainerEl.querySelectorAll('.hotspot-pin').forEach((pin) => {
        pin.addEventListener('click', () => {
          const id = (pin as HTMLElement).dataset.id!;
          const target = hsScene.hotspots.find((h) => h.id === id);
          if (!target) return;
          this.audio.playSfx('memory');

          if (!this.vars.flags[id]) {
            this.vars.flags[id] = true;
            this.vars.memoriasRecolhidas = Math.min(12, this.vars.memoriasRecolhidas + 1);
            if (!this.meta.unlockedMemories.includes(id)) {
              this.meta.unlockedMemories.push(id);
              savePersistentMeta(this.meta);
            }
            this.showToast(t('hud.objectFound', { title: target.title }));
            this.renderTopHud();
          }
          visitedLocal.add(id);

          this.overlayContainerEl.innerHTML = '';
          this.inlineQueue.unshift(...target.lines);
          const allNowDone = hsScene.hotspots.every(
            (h) => visitedLocal.has(h.id) || Boolean(this.vars.flags[h.id])
          );
          if (allNowDone && hsScene.continueGoto) {
            this.inlineQueue.push({ goto: hsScene.continueGoto });
          } else {
            this.inlineQueue.push({ hotspotScene: hsScene });
          }
          this.pc++;
          this.stepExecution();
        });
      });

      this.overlayContainerEl.querySelector('#btn-hs-continue')?.addEventListener('click', () => {
        this.overlayContainerEl.innerHTML = '';
        if (hsScene.continueGoto) {
          this.enterScene(hsScene.continueGoto, 0);
        } else {
          this.pc++;
          this.stepExecution();
        }
      });
    };

    renderPins();
  }

  private presentEndingScreen(ending: {
    id: string;
    code: string;
    title: string;
    subtitle: string;
    finalParagraph: string;
  }): void {
    this.dialogueWrapEl.style.display = 'none';
    if (!this.meta.unlockedEndings.includes(ending.id)) {
      this.meta.unlockedEndings.push(ending.id);
      savePersistentMeta(this.meta);
    }

    this.overlayContainerEl.innerHTML = `
      <div class="chapter-card-overlay" style="background: rgba(10, 14, 20, 0.92)">
        <div class="chapter-card-backdrop" style="max-width:740px">
          <div class="chapter-num">${ending.code}</div>
          <h2 class="chapter-title">${ending.title}</h2>
          <p class="chapter-quote" style="margin-bottom:1.2rem">${ending.subtitle}</p>
          <p style="line-height:1.65;color:#e6dfd3;margin-bottom:1.8rem">${ending.finalParagraph}</p>
          <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
            <button class="hud-btn active" id="end-notebook">${t('menu.notebook')}</button>
            <button class="hud-btn" id="end-gallery">${t('menu.gallery')}</button>
            <button class="hud-btn" id="end-menu">${t('hud.menu')}</button>
          </div>
        </div>
      </div>
    `;

    this.overlayContainerEl.querySelector('#end-notebook')?.addEventListener('click', () => this.openNotebookModal());
    this.overlayContainerEl.querySelector('#end-gallery')?.addEventListener('click', () => this.openGalleryModal());
    this.overlayContainerEl.querySelector('#end-menu')?.addEventListener('click', () => this.renderTitleScreen());
  }

  private triggerVisualEffect(effect: string): void {
    if (this.settings.reduceMotion) return;
    if (effect === 'shake') {
      this.stageEl.classList.remove('shake');
      void this.stageEl.offsetWidth;
      this.stageEl.classList.add('shake');
    } else if (effect === 'focus') {
      this.bgEl.classList.add('focus-blur');
    } else if (effect === 'clearFocus') {
      this.bgEl.classList.remove('focus-blur');
    } else if (effect === 'beamFlicker') {
      this.fx?.triggerBeamFlicker();
    }
  }

  private unlockWord(wordId: string): void {
    if (!this.meta.unlockedWords.includes(wordId)) {
      this.meta.unlockedWords.push(wordId);
      savePersistentMeta(this.meta);
      const entry = NOTEBOOK_WORDS.find((w) => w.id === wordId);
      if (entry) {
        this.audio.playSfx('paper');
        this.showToast(t('hud.wordUnlocked', { word: entry.word }));
      }
    }
  }

  private showToast(text: string): void {
    const el = document.createElement('div');
    el.className = 'memory-toast';
    el.textContent = text;
    this.toastStackEl.appendChild(el);
    window.setTimeout(() => {
      el.remove();
    }, 3600);
  }

  private showSoundCaption(caption: string): void {
    this.captionEl.textContent = caption;
    this.captionEl.style.display = 'block';
    window.setTimeout(() => {
      this.captionEl.style.display = 'none';
    }, 3400);
  }

  private toggleAuto(): void {
    this.autoMode = !this.autoMode;
    this.renderTopHud();
  }

  private toggleSkip(): void {
    this.skipMode = !this.skipMode;
    this.renderTopHud();
  }

  private buildSaveData(slotId: string): SaveSlotData {
    const scene = this.scenes.get(this.currentSceneId);
    const lastLine = this.backlog[this.backlog.length - 1];
    return {
      slotId,
      timestamp: Date.now(),
      chapterTitle: scene?.title ?? 'Prólogo',
      sceneId: this.currentSceneId,
      pc: Math.max(0, this.pc),
      bg: this.currentBg,
      cg: this.currentCg,
      music: this.currentMusic,
      ambient: this.currentAmbient,
      sprites: JSON.parse(JSON.stringify(this.activeSprites)),
      previewText: lastLine?.text ?? '',
      vars: cloneVariables(this.vars),
      backlog: [...this.backlog.slice(-40)],
    };
  }

  private saveAuto(): void {
    saveToSlot('autosave', this.buildSaveData('autosave'));
  }

  private quickSave(): void {
    saveToSlot('quicksave', this.buildSaveData('quicksave'));
    this.showToast(t('hud.quickSave'));
  }

  private quickLoad(): void {
    const data = loadFromSlot('quicksave');
    if (data) {
      this.restoreSaveData(data);
      this.showToast(t('hud.quickLoad'));
    }
  }

  private restoreSaveData(data: SaveSlotData): void {
    this.inTitleScreen = false;
    this.closeModal();
    this.overlayContainerEl.innerHTML = '';
    this.vars = cloneVariables(data.vars);
    this.backlog = [...data.backlog];
    this.currentSceneId = data.sceneId;
    this.pc = data.pc;
    this.setBackground(data.bg);
    this.setCg(data.cg);
    this.currentMusic = data.music;
    this.currentAmbient = data.ambient;
    this.audio.playMusic(data.music);
    this.audio.playAmbient(data.ambient);
    this.activeSprites = JSON.parse(JSON.stringify(data.sprites));
    this.updateSpritesDom();
    this.renderTopHud();
    this.stepExecution();
  }

  private closeModal(): void {
    this.modalContainerEl.innerHTML = '';
  }

  private openNotebookModal(): void {
    const wordsHtml = NOTEBOOK_WORDS.map((w) => {
      const unlocked = this.meta.unlockedWords.includes(w.id);
      if (!unlocked) {
        return `
          <div class="word-card" style="opacity:0.45">
            <h4>???</h4>
            <div class="word-meta">${t('notebook.locked')}</div>
          </div>
        `;
      }
      return `
        <div class="word-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <h4>${w.word}</h4>
              <div class="word-meta">${w.origin} · ${w.phonetic}</div>
            </div>
            <div class="ink-sketch">${w.inkSvg}</div>
          </div>
          <p style="font-size:0.93rem;line-height:1.45">${w.definition}</p>
          <p class="word-note">«${w.inesNote}»</p>
        </div>
      `;
    }).join('');

    const memHtml = MEMORY_OBJECTS.map((m) => {
      const found = this.meta.unlockedMemories.includes(m.id) || Boolean(this.vars.flags[m.id]);
      return `
        <div class="word-card" style="${found ? '' : 'opacity:0.45'}">
          <h4>${found ? m.title : '???'}</h4>
          <div class="word-meta">${m.chapter} · ${m.location}</div>
          <p style="font-size:0.92rem">${found ? m.description : 'Objeto-memória ainda por encontrar.'}</p>
        </div>
      `;
    }).join('');

    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('notebook.title')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body">
            <p style="font-style:italic;color:#b8c4ce;margin-bottom:1.1rem">${t('notebook.subtitle')}</p>
            <div class="grid-cards" style="margin-bottom:1.8rem">${wordsHtml}</div>
            <h4 style="font-family:var(--font-serif);font-size:1.4rem;color:var(--accent-beacon);margin-bottom:0.8rem">
              ${t('notebook.memoriesHeader', { count: this.vars.memoriasRecolhidas })}
            </h4>
            <div class="grid-cards">${memHtml}</div>
          </div>
        </div>
      </div>
    `;
    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
  }

  private openGalleryModal(): void {
    const bgsAndCgs = [
      { title: 'O Farol na Falésia', path: './assets/bg/title_farol.webp' },
      { title: 'Comboio Regional', path: './assets/bg/bg_comboio.webp' },
      { title: 'Apeadeiro de Névoa', path: './assets/bg/bg_estacao.webp' },
      { title: 'Rua dos Navegantes', path: './assets/bg/bg_rua_nevoa.webp' },
      { title: 'Primeira Visão do Farol (CG)', path: './assets/cg/cg_primeiro_farol.webp' },
      { title: 'Cozinha da Avó Celeste', path: './assets/bg/bg_cozinha_farol.webp' },
      { title: 'O Quarto das Duas Camas', path: './assets/bg/bg_quarto_infancia.webp' },
    ];

    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('gallery.title')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body">
            <h4 style="font-family:var(--font-serif);font-size:1.35rem;color:var(--accent-beacon);margin-bottom:0.75rem">${t('gallery.cgs')}</h4>
            <div class="grid-cards" style="margin-bottom:1.6rem">
              ${bgsAndCgs
                .map(
                  (item) => `
                <div class="word-card">
                  <div style="height:130px;border-radius:6px;background:url('${item.path}') center/cover"></div>
                  <h4 style="font-size:1.15rem;margin-top:0.4rem">${item.title}</h4>
                </div>
              `
                )
                .join('')}
            </div>

            <h4 style="font-family:var(--font-serif);font-size:1.35rem;color:var(--accent-beacon);margin-bottom:0.75rem">${t('gallery.music')}</h4>
            <div class="grid-cards" style="margin-bottom:1.6rem">
              ${MUSIC_TRACKS.map(
                (tr) => `
                <div class="word-card">
                  <h4>${tr.title}</h4>
                  <div class="word-meta">${tr.subtitle}</div>
                  <button class="hud-btn active play-track-btn" data-track="${tr.id}" style="margin-top:0.5rem;align-self:flex-start">▶ Ouvir faixa</button>
                </div>
              `
              ).join('')}
            </div>

            <h4 style="font-family:var(--font-serif);font-size:1.35rem;color:var(--accent-beacon);margin-bottom:0.75rem">${t('gallery.characters')}</h4>
            <div class="grid-cards">
              ${CHARACTER_BIOS.map(
                (c) => `
                <div class="word-card">
                  <h4>${c.name} <span style="font-size:0.85rem;color:#9fb0be">(${c.age})</span></h4>
                  <div class="word-meta">${c.role}</div>
                  <p class="word-note">${c.quote}</p>
                  <p style="font-size:0.9rem;margin-top:0.35rem">${c.bio}</p>
                </div>
              `
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
    this.modalContainerEl.querySelectorAll('.play-track-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trackId = (btn as HTMLElement).dataset.track!;
        this.audio.unlock();
        this.audio.playMusic(trackId);
      });
    });
  }

  private openBacklogModal(): void {
    const rows = this.backlog
      .map(
        (b) => `
      <div style="padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.07)">
        ${b.speakerName ? `<strong style="color:var(--accent-beacon)">${b.speakerName}: </strong>` : ''}
        <span>${b.text}</span>
      </div>
    `
      )
      .join('');

    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('hud.backlog')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body">
            ${rows || '<p style="color:#9fb0be">Sem linhas registadas ainda.</p>'}
          </div>
        </div>
      </div>
    `;
    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
  }

  private openSavesModal(): void {
    const { autosave, quicksave, slots } = listAllSaves(config.saveSlots);

    const renderSlotCard = (slotId: string, label: string, data: SaveSlotData | null, allowSave: boolean) => {
      const dateStr = data ? new Date(data.timestamp).toLocaleString() : t('saves.empty');
      return `
        <div class="word-card">
          <div style="display:flex;justify-content:space-between">
            <h4>${label}</h4>
            <span class="word-meta">${dateStr}</span>
          </div>
          <p style="font-size:0.88rem;color:#cbd5de;min-height:2.4rem">
            ${data ? `${data.chapterTitle} — «${data.previewText.slice(0, 70)}...»` : '—'}
          </p>
          <div style="display:flex;gap:0.4rem;margin-top:0.4rem">
            ${
              allowSave && !this.inTitleScreen
                ? `<button class="hud-btn btn-slot-save" data-slot="${slotId}">${t('saves.save')}</button>`
                : ''
            }
            ${
              data
                ? `<button class="hud-btn btn-slot-load" data-slot="${slotId}">${t('saves.load')}</button>
                   <button class="hud-btn btn-slot-del" data-slot="${slotId}">${t('saves.delete')}</button>`
                : ''
            }
          </div>
        </div>
      `;
    };

    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('saves.title')}</h3>
            <div style="display:flex;gap:0.5rem">
              <button class="hud-btn" id="btn-export-saves">${t('saves.export')}</button>
              <button class="hud-btn" id="btn-import-saves">${t('saves.import')}</button>
              <button class="hud-btn" id="modal-close">${t('options.close')}</button>
            </div>
          </div>
          <div class="modal-body">
            <div class="grid-cards">
              ${renderSlotCard('autosave', t('saves.autosave'), autosave, false)}
              ${renderSlotCard('quicksave', t('saves.quicksave'), quicksave, true)}
              ${slots.map((s, idx) => renderSlotCard(`slot_${idx + 1}`, t('saves.slot', { n: idx + 1 }), s, true)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());

    this.modalContainerEl.querySelectorAll('.btn-slot-save').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot!;
        saveToSlot(slotId, this.buildSaveData(slotId));
        this.openSavesModal();
      });
    });

    this.modalContainerEl.querySelectorAll('.btn-slot-load').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot!;
        const loaded = loadFromSlot(slotId);
        if (loaded) this.restoreSaveData(loaded);
      });
    });

    this.modalContainerEl.querySelectorAll('.btn-slot-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot!;
        deleteSlot(slotId);
        this.openSavesModal();
      });
    });

    this.modalContainerEl.querySelector('#btn-export-saves')?.addEventListener('click', () => {
      const blob = new Blob([exportAllSavesAsJson(config.saveSlots)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'farol-que-esquece-saves.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    this.modalContainerEl.querySelector('#btn-import-saves')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        if (importSavesFromJson(text)) {
          this.openSavesModal();
        }
      });
      input.click();
    });
  }

  private openOptionsModal(): void {
    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('options.title')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body">
            <div class="options-grid">
              <div class="opt-row">
                <label>${t('options.language')}</label>
                <select id="opt-locale" class="hud-btn">
                  <option value="pt-PT" ${getLocale() === 'pt-PT' ? 'selected' : ''}>Português (Portugal)</option>
                  <option value="pt-BR" ${getLocale() === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
                  <option value="en" ${getLocale() === 'en' ? 'selected' : ''}>English</option>
                </select>
              </div>

              <div class="opt-row">
                <label>${t('options.fontFamily')}</label>
                <select id="opt-font" class="hud-btn">
                  <option value="default" ${this.settings.fontFamily === 'default' ? 'selected' : ''}>${t('options.fontDefault')}</option>
                  <option value="hyperlegible" ${this.settings.fontFamily === 'hyperlegible' ? 'selected' : ''}>${t('options.fontHyperlegible')}</option>
                  <option value="dyslexic" ${this.settings.fontFamily === 'dyslexic' ? 'selected' : ''}>${t('options.fontDyslexic')}</option>
                </select>
              </div>

              <div class="opt-row">
                <label>${t('options.fontSize')}</label>
                <select id="opt-size" class="hud-btn">
                  <option value="small" ${this.settings.fontSize === 'small' ? 'selected' : ''}>Pequeno</option>
                  <option value="medium" ${this.settings.fontSize === 'medium' ? 'selected' : ''}>Médio</option>
                  <option value="large" ${this.settings.fontSize === 'large' ? 'selected' : ''}>Grande</option>
                </select>
              </div>

              <div class="opt-row">
                <label>${t('options.textSpeed')}</label>
                <input type="range" id="opt-speed" min="0" max="55" step="5" value="${this.settings.textSpeed}" />
              </div>

              <div class="opt-row">
                <label>${t('options.musicVol')}</label>
                <input type="range" id="opt-music" min="0" max="1" step="0.05" value="${this.settings.musicVol}" />
              </div>

              <div class="opt-row">
                <label>${t('options.ambientVol')}</label>
                <input type="range" id="opt-ambient" min="0" max="1" step="0.05" value="${this.settings.ambientVol}" />
              </div>

              <div class="opt-row">
                <label>${t('options.sfxVol')}</label>
                <input type="range" id="opt-sfx" min="0" max="1" step="0.05" value="${this.settings.sfxVol}" />
              </div>

              <div class="opt-row">
                <label>${t('options.highContrast')}
                  <input type="checkbox" id="opt-contrast" ${this.settings.highContrast ? 'checked' : ''} />
                </label>
              </div>

              <div class="opt-row">
                <label>${t('options.reduceMotion')}
                  <input type="checkbox" id="opt-motion" ${this.settings.reduceMotion ? 'checked' : ''} />
                </label>
              </div>

              <div class="opt-row">
                <label>${t('options.disableTimers')}
                  <input type="checkbox" id="opt-timers" ${this.settings.disableTimers ? 'checked' : ''} />
                </label>
              </div>

              <div class="opt-row">
                <label>${t('options.soundCaptions')}
                  <input type="checkbox" id="opt-captions" ${this.settings.soundCaptions ? 'checked' : ''} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const bind = () => {
      const locale = (this.modalContainerEl.querySelector('#opt-locale') as HTMLSelectElement).value as LocaleCode;
      const fontFamily = (this.modalContainerEl.querySelector('#opt-font') as HTMLSelectElement).value as GameSettings['fontFamily'];
      const fontSize = (this.modalContainerEl.querySelector('#opt-size') as HTMLSelectElement).value as GameSettings['fontSize'];
      const textSpeed = Number((this.modalContainerEl.querySelector('#opt-speed') as HTMLInputElement).value);
      const musicVol = Number((this.modalContainerEl.querySelector('#opt-music') as HTMLInputElement).value);
      const ambientVol = Number((this.modalContainerEl.querySelector('#opt-ambient') as HTMLInputElement).value);
      const sfxVol = Number((this.modalContainerEl.querySelector('#opt-sfx') as HTMLInputElement).value);
      const highContrast = (this.modalContainerEl.querySelector('#opt-contrast') as HTMLInputElement).checked;
      const reduceMotion = (this.modalContainerEl.querySelector('#opt-motion') as HTMLInputElement).checked;
      const disableTimers = (this.modalContainerEl.querySelector('#opt-timers') as HTMLInputElement).checked;
      const soundCaptions = (this.modalContainerEl.querySelector('#opt-captions') as HTMLInputElement).checked;

      this.settings = {
        ...this.settings,
        locale,
        fontFamily,
        fontSize,
        textSpeed,
        musicVol,
        ambientVol,
        sfxVol,
        highContrast,
        reduceMotion,
        disableTimers,
        soundCaptions,
      };
      setLocale(locale);
      saveSettings(this.settings);
      this.applyAccessibilityClasses();
      this.audio.applySettings(this.settings);
      if (this.inTitleScreen) this.renderTitleScreen();
      else this.renderTopHud();
    };

    this.modalContainerEl.querySelectorAll('select, input').forEach((el) => {
      el.addEventListener('change', bind);
      el.addEventListener('input', bind);
    });

    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
  }

  private openChaptersModal(): void {
    const chapters = [
      { id: 'prologo_comboio', num: 'Prólogo', title: 'Maré Vazia', duration: '~8 min', unlocked: true },
      { id: 'cap1', num: 'Capítulo 1', title: 'A Vila Que Sorri', duration: '~20 min', unlocked: false },
      { id: 'cap2', num: 'Capítulo 2', title: 'O Livro das Marés', duration: '~22 min', unlocked: false },
      { id: 'cap3', num: 'Capítulo 3', title: 'A Escada do Farol', duration: '~25 min', unlocked: false },
      { id: 'cap4', num: 'Capítulo 4', title: 'A Noite da Tempestade', duration: '~25 min', unlocked: false },
      { id: 'cap5', num: 'Capítulo 5', title: 'O Que o Mar Devolve', duration: '~15 min', unlocked: false },
    ];

    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('menu.chapters')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body">
            <div class="grid-cards">
              ${chapters
                .map(
                  (c) => `
                <div class="word-card" style="${c.unlocked ? '' : 'opacity:0.45'}">
                  <div class="word-meta">${c.num} · ${c.duration}</div>
                  <h4>${c.title}</h4>
                  ${
                    c.unlocked
                      ? `<button class="hud-btn active start-chap-btn" data-scene="${c.id}" style="margin-top:0.6rem;align-self:flex-start">Iniciar capítulo →</button>`
                      : `<span class="word-meta" style="margin-top:0.5rem">Em produção (Fase 2)</span>`
                  }
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
    this.modalContainerEl.querySelectorAll('.start-chap-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sceneId = (btn as HTMLElement).dataset.scene!;
        this.closeModal();
        this.startNewGame(sceneId);
      });
    });
  }

  private openCreditsModal(): void {
    this.modalContainerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-window">
          <div class="modal-header">
            <h3 class="modal-title">${t('menu.credits')}</h3>
            <button class="hud-btn" id="modal-close">${t('options.close')}</button>
          </div>
          <div class="modal-body" style="text-align:center;padding:2.5rem">
            <div class="chapter-num">UMA VISUAL NOVEL ORIGINAL</div>
            <h2 style="font-family:var(--font-serif);font-size:2.4rem;margin:0.4rem 0 1.4rem">${config.title}</h2>
            <p style="font-size:1.1rem;margin-bottom:0.5rem">Direção, Escrita, Arte e Programação</p>
            <p style="font-family:var(--font-serif);font-size:1.55rem;color:var(--accent-beacon);margin-bottom:1.8rem">${config.AUTHOR_NAME}</p>
            <p style="font-size:0.9rem;color:#9fb0be">Tipografia: Cormorant Garamond, Source Sans 3, Atkinson Hyperlegible, OpenDyslexic (SIL OFL).</p>
          </div>
        </div>
      </div>
    `;
    this.modalContainerEl.querySelector('#modal-close')?.addEventListener('click', () => this.closeModal());
  }
}
