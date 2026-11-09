export interface EffectsConfig {
  fogDensity: number;
  beamActive: boolean;
  beamOriginX: number; // 0..1 normalized
  beamOriginY: number; // 0..1 normalized
  beamFlicker: boolean;
  saltParticles: boolean;
  rain: boolean;
  reduceMotion: boolean;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface FogPuff {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
  alpha: number;
}

export class AtmosphereCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private particles: Particle[] = [];
  private fogPuffs: FogPuff[] = [];
  private time = 0;
  private flickerTimer = 0;

  private config: EffectsConfig = {
    fogDensity: 0.45,
    beamActive: false,
    beamOriginX: 0.808,
    beamOriginY: 0.175,
    beamFlicker: false,
    saltParticles: true,
    rain: false,
    reduceMotion: false,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D context unavailable');
    this.ctx = context;
    this.initEntities();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private initEntities(): void {
    this.particles = [];
    for (let i = 0; i < 42; i++) {
      this.particles.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        r: 0.8 + Math.random() * 1.8,
        vx: -0.18 - Math.random() * 0.32,
        vy: -0.05 - Math.random() * 0.15,
        alpha: 0.08 + Math.random() * 0.25,
      });
    }

    this.fogPuffs = [
      { x: 220, y: 520, rx: 420, ry: 130, speed: 0.16, alpha: 0.08 },
      { x: 780, y: 590, rx: 510, ry: 145, speed: 0.24, alpha: 0.10 },
      { x: 1120, y: 470, rx: 390, ry: 120, speed: 0.11, alpha: 0.07 },
    ];
  }

  public resize(): void {
    this.canvas.width = 1280;
    this.canvas.height = 720;
  }

  public setConfig(partial: Partial<EffectsConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Automatically configures lighthouse lantern coordinates and fog level based on the current scene background!
   */
  public syncWithBackground(bgPath: string, cgPath: string | null): void {
    const active = cgPath || bgPath;
    if (active.includes('title_farol')) {
      // Exact lantern room position after 6% margin crop
      this.setConfig({
        beamActive: true,
        beamOriginX: 0.816,
        beamOriginY: 0.158,
        fogDensity: 0.45,
      });
    } else if (active.includes('cg_primeiro_farol')) {
      // The CG already has a painted dramatic beam; add only a soft pulsing lantern glow at (0.418, 0.125)
      this.setConfig({
        beamActive: true,
        beamOriginX: 0.418,
        beamOriginY: 0.125,
        fogDensity: 0.3,
      });
    } else if (active.includes('bg_cozinha_farol') || active.includes('bg_quarto_infancia')) {
      // Indoor scenes: no floating exterior beam, subtle warm dust particles only
      this.setConfig({
        beamActive: false,
        fogDensity: 0.12,
      });
    } else if (active.includes('bg_comboio')) {
      this.setConfig({
        beamActive: false,
        fogDensity: 0.18,
      });
    } else {
      // Outdoor village/station/dunes
      this.setConfig({
        beamActive: false,
        fogDensity: 0.42,
      });
    }
  }

  public triggerBeamFlicker(): void {
    this.config.beamFlicker = true;
    this.flickerTimer = 90;
  }

  public start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderFrame(): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const motionScale = this.config.reduceMotion ? 0.05 : 1;
    this.time += 0.014 * motionScale;

    // 1. Soft drifting sea mist puffs
    if (this.config.fogDensity > 0) {
      for (const puff of this.fogPuffs) {
        puff.x += puff.speed * motionScale;
        if (puff.x - puff.rx > width) {
          puff.x = -puff.rx * 0.6;
        }
        const grad = ctx.createRadialGradient(puff.x, puff.y, 10, puff.x, puff.y, puff.rx);
        const a = puff.alpha * this.config.fogDensity;
        grad.addColorStop(0, `rgba(202, 214, 224, ${a})`);
        grad.addColorStop(0.6, `rgba(182, 196, 208, ${a * 0.45})`);
        grad.addColorStop(1, 'rgba(182, 196, 208, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // 2. Physically-aligned Lighthouse Lantern Glow & Soft Sweeping Cone
    if (this.config.beamActive) {
      const ox = width * this.config.beamOriginX;
      const oy = height * this.config.beamOriginY;
      const pulse = 0.78 + Math.sin(this.time * 1.7) * 0.22;

      let flickerMult = 1;
      if (this.flickerTimer > 0) {
        this.flickerTimer--;
        flickerMult = this.flickerTimer % 10 < 4 ? 0.15 : 1.25;
        if (this.flickerTimer === 0) this.config.beamFlicker = false;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Warm radial bloom centered directly on the painted lantern glass
      const haloRadius = 115 * pulse;
      const halo = ctx.createRadialGradient(ox, oy, 2, ox, oy, haloRadius);
      halo.addColorStop(0, `rgba(255, 238, 175, ${0.62 * flickerMult})`);
      halo.addColorStop(0.3, `rgba(242, 193, 78, ${0.28 * flickerMult})`);
      halo.addColorStop(1, 'rgba(242, 193, 78, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(ox, oy, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // Gentle rotating volumetric cone (only on title_farol where origin is on right cliff)
      if (this.config.beamOriginX > 0.65) {
        const sweepY = oy + Math.sin(this.time * 0.75) * 95;
        const coneGrad = ctx.createLinearGradient(ox, oy, ox - 680, sweepY);
        const coneAlpha = (0.14 + Math.sin(this.time * 1.5) * 0.05) * flickerMult;
        coneGrad.addColorStop(0, `rgba(255, 226, 138, ${coneAlpha * 1.4})`);
        coneGrad.addColorStop(0.45, `rgba(242, 193, 78, ${coneAlpha * 0.65})`);
        coneGrad.addColorStop(1, 'rgba(242, 193, 78, 0)');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(ox, oy - 4);
        ctx.lineTo(ox - 720, sweepY - 125);
        ctx.lineTo(ox - 720, sweepY + 125);
        ctx.lineTo(ox, oy + 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // 3. Fine floating salt & dust motes
    if (this.config.saltParticles && !this.config.reduceMotion) {
      ctx.fillStyle = 'rgba(246, 239, 226, 0.42)';
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.y < 0) p.y = height;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 4. Cinematic letterbox vignette
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      width * 0.34,
      width * 0.5,
      height * 0.5,
      width * 0.68
    );
    vig.addColorStop(0, 'rgba(10, 15, 20, 0)');
    vig.addColorStop(1, 'rgba(8, 12, 17, 0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }
}
