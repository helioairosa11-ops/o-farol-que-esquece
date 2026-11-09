export interface EffectsConfig {
  fogDensity: number;
  beamActive: boolean;
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

interface FogBank {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

export class AtmosphereCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private particles: Particle[] = [];
  private fogBanks: FogBank[] = [];
  private beamAngle = 0;
  private flickerTimer = 0;

  private config: EffectsConfig = {
    fogDensity: 0.65,
    beamActive: true,
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
    for (let i = 0; i < 48; i++) {
      this.particles.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        r: 1 + Math.random() * 2.2,
        vx: -0.25 - Math.random() * 0.45,
        vy: -0.08 - Math.random() * 0.25,
        alpha: 0.12 + Math.random() * 0.35,
      });
    }

    this.fogBanks = [
      { x: 0, y: 580, w: 950, h: 320, speed: 0.22, alpha: 0.16 },
      { x: 650, y: 660, w: 1100, h: 340, speed: 0.35, alpha: 0.20 },
      { x: 1200, y: 500, w: 900, h: 280, speed: 0.15, alpha: 0.14 },
    ];
  }

  public resize(): void {
    this.canvas.width = 1280;
    this.canvas.height = 720;
  }

  public setConfig(partial: Partial<EffectsConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public triggerBeamFlicker(): void {
    this.config.beamFlicker = true;
    this.flickerTimer = 95;
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

    // 1. Volumetric fog banks (3 parallax layers)
    if (this.config.fogDensity > 0) {
      for (const bank of this.fogBanks) {
        bank.x += bank.speed * motionScale;
        if (bank.x - bank.w > width) {
          bank.x = -bank.w * 0.5;
        }
        const grad = ctx.createRadialGradient(
          bank.x,
          (bank.y / 1080) * height,
          20,
          bank.x,
          (bank.y / 1080) * height,
          (bank.w / 1920) * width * 0.65
        );
        const a = bank.alpha * this.config.fogDensity;
        grad.addColorStop(0, `rgba(195, 204, 211, ${a})`);
        grad.addColorStop(1, 'rgba(195, 204, 211, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // 2. Sweeping lighthouse beam with bloom
    if (this.config.beamActive) {
      this.beamAngle += 0.006 * motionScale;
      const sweep = (Math.sin(this.beamAngle) + 1) * 0.5; // 0..1
      let flickerMult = 1;
      if (this.flickerTimer > 0) {
        this.flickerTimer--;
        flickerMult = this.flickerTimer % 9 < 4 ? 0.12 : 1.15;
        if (this.flickerTimer === 0) {
          this.config.beamFlicker = false;
        }
      }

      const originX = width * 0.78;
      const originY = height * 0.24;
      const beamAlpha = (0.04 + sweep * 0.13) * flickerMult;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const beamGrad = ctx.createLinearGradient(originX, originY, width * 0.05, height * (0.35 + sweep * 0.3));
      beamGrad.addColorStop(0, `rgba(242, 193, 78, ${beamAlpha * 1.9})`);
      beamGrad.addColorStop(0.45, `rgba(242, 193, 78, ${beamAlpha})`);
      beamGrad.addColorStop(1, 'rgba(242, 193, 78, 0)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(0, height * (0.1 + sweep * 0.35));
      ctx.lineTo(0, height * (0.48 + sweep * 0.35));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Salt & mist particles
    if (this.config.saltParticles && !this.config.reduceMotion) {
      ctx.fillStyle = 'rgba(244, 239, 230, 0.38)';
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.y < 0) p.y = height;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc((p.x / 1920) * width, (p.y / 1080) * height, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 4. Soft painterly vignette
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      width * 0.28,
      width * 0.5,
      height * 0.5,
      width * 0.65
    );
    vig.addColorStop(0, 'rgba(15, 22, 28, 0)');
    vig.addColorStop(1, 'rgba(15, 22, 28, 0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }
}
