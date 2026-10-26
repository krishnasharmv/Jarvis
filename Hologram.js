/**
 * J.A.R.V.I.S. — REAL-TIME 3D HOLOGRAM ENGINE (Three.js + WebGL Fallback)
 * Path: /hologram.js
 */

class JarvisHologramEngine {
  constructor(canvasId, fallbackId) {
    this.canvas = document.getElementById(canvasId);
    this.fallback = document.getElementById(fallbackId);
    this.state = "idle"; // idle | listening | thinking | speaking | error
    this.theme = "gold"; // gold | cyan | violet
    this.intensity = "balanced"; // low | balanced | high
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.audioEnergy = 0; // 0.0 to 1.0 audio reactive modulator
    this.webglAvailable = false;
    this.isPaused = false;

    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.clock = null;

    this.palettes = {
      gold: {
        core: 0xffb547,
        inner: 0xfff0c2,
        rings: 0xff9e2c,
        accent: 0x57d7ff,
        violet: 0xa855f7
      },
      cyan: {
        core: 0x57d7ff,
        inner: 0xdff8ff,
        rings: 0x38bdf8,
        accent: 0xffb547,
        violet: 0xa855f7
      },
      violet: {
        core: 0xc084fc,
        inner: 0xf3e8ff,
        rings: 0xa855f7,
        accent: 0xec4899,
        violet: 0x57d7ff
      },
      error: {
        core: 0xff5d73,
        inner: 0xffccd5,
        rings: 0xff3b5c,
        accent: 0xffb547,
        violet: 0xff5d73
      }
    };

    this.init();
  }

  init() {
    if (!this.canvas || typeof window.THREE === "undefined") {
      this.activateFallback();
      return;
    }

    try {
      const gl =
        this.canvas.getContext("webgl") ||
        this.canvas.getContext("experimental-webgl");
      if (!gl) {
        this.activateFallback();
        return;
      }

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });

      const isMobile = window.innerWidth < 768;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      this.camera.position.set(0, 0, 7.2);

      this.rootGroup = new THREE.Group();
      this.scene.add(this.rootGroup);

      this.clock = new THREE.Clock();
      this.buildHologramStructure();
      this.resize();
      this.bindEvents();

      this.webglAvailable = true;
      this.animate();
    } catch (err) {
      console.warn("WebGL initialization fallback activated:", err);
      this.activateFallback();
    }
  }

  activateFallback() {
    this.webglAvailable = false;
    if (this.canvas) this.canvas.classList.add("hidden");
    if (this.fallback) this.fallback.classList.remove("hidden");
  }

  buildHologramStructure() {
    const pal = this.palettes[this.theme];

    // 1. Inner Luminous Core Sphere
    const innerGeo = new THREE.IcosahedronGeometry(0.72, 3);
    this.innerMat = new THREE.MeshBasicMaterial({
      color: pal.inner,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.innerCore = new THREE.Mesh(innerGeo, this.innerMat);
    this.rootGroup.add(this.innerCore);

    // 2. Primary Geodesic Holographic Sphere
    const mainSphereGeo = new THREE.IcosahedronGeometry(1.18, 2);
    const wireGeo = new THREE.WireframeGeometry(mainSphereGeo);
    this.mainSphereMat = new THREE.LineBasicMaterial({
      color: pal.core,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending
    });
    this.mainSphere = new THREE.LineSegments(wireGeo, this.mainSphereMat);
    this.rootGroup.add(this.mainSphere);

    // 3. Latitude / Longitude Technical Shell
    const latLonGeo = new THREE.SphereGeometry(1.42, 24, 16);
    const latLonWire = new THREE.WireframeGeometry(latLonGeo);
    this.latLonMat = new THREE.LineBasicMaterial({
      color: pal.rings,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending
    });
    this.latLonShell = new THREE.LineSegments(latLonWire, this.latLonMat);
    this.rootGroup.add(this.latLonShell);

    // 4. Concentric Orbital Rings & Torus Layers
    this.orbitsGroup = new THREE.Group();
    this.rootGroup.add(this.orbitsGroup);

    this.ringMaterials = [];
    const ringSpecs = [
      { radius: 1.65, tube: 0.012, rx: 1.1, ry: 0.3, color: pal.core, opacity: 0.75 },
      { radius: 1.92, tube: 0.009, rx: -0.7, ry: 0.9, color: pal.accent, opacity: 0.5 },
      { radius: 2.18, tube: 0.014, rx: 0.35, ry: -1.1, color: pal.rings, opacity: 0.65 },
      { radius: 2.42, tube: 0.008, rx: 1.45, ry: 0.15, color: pal.violet, opacity: 0.45 }
    ];

    this.orbitalRings = ringSpecs.map((spec) => {
      const geo = new THREE.TorusGeometry(spec.radius, spec.tube, 12, 96);
      const mat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending
      });
      this.ringMaterials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(spec.rx, spec.ry, 0);
      this.orbitsGroup.add(mesh);
      return mesh;
    });

    // 5. Radial Tick-Mark Precision Ring (Iron Man Lab Telemetry Ring)
    const tickPositions = [];
    const tickCount = 120;
    const innerR = 1.74;
    const outerR = 1.84;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const lenMod = i % 5 === 0 ? 0.06 : 0;
      tickPositions.push(
        Math.cos(angle) * innerR,
        Math.sin(angle) * innerR,
        0,
        Math.cos(angle) * (outerR + lenMod),
        Math.sin(angle) * (outerR + lenMod),
        0
      );
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute("position", new THREE.Float32BufferAttribute(tickPositions, 3));
    this.tickMat = new THREE.LineBasicMaterial({
      color: pal.core,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.tickRing = new THREE.LineSegments(tickGeo, this.tickMat);
    this.tickRing.rotation.x = 0.45;
    this.rootGroup.add(this.tickRing);

    // 6. Scanning Ring (Prominent during THINKING state)
    const scanGeo = new THREE.RingGeometry(1.48, 1.54, 64, 1, 0, Math.PI * 1.35);
    this.scanMat = new THREE.MeshBasicMaterial({
      color: pal.accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.scanRing = new THREE.Mesh(scanGeo, this.scanMat);
    this.rootGroup.add(this.scanRing);

    // 7. Luminous Particle Cloud
    this.buildParticles();
  }

  buildParticles() {
    if (this.particleSystem) {
      this.rootGroup.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
    }

    const counts = { low: 90, balanced: 220, high: 420 };
    const count = counts[this.intensity] || 220;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 0.9 + Math.random() * 1.85;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const pal = this.palettes[this.theme];
    this.particleMat = new THREE.PointsMaterial({
      color: pal.core,
      size: 0.042,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(partGeo, this.particleMat);
    this.rootGroup.add(this.particleSystem);
  }

  setState(newState) {
    this.state = newState;
    document.body.setAttribute("data-state", newState);
    this.applyColors();
  }

  setTheme(newTheme) {
    this.theme = newTheme;
    document.body.classList.remove("theme-gold", "theme-cyan", "theme-violet");
    document.body.classList.add(`theme-${newTheme}`);
    this.applyColors();
  }

  setIntensity(level) {
    this.intensity = level;
    if (this.webglAvailable) {
      this.buildParticles();
    }
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  setAudioEnergy(val) {
    this.audioEnergy = Math.max(0, Math.min(1, val || 0));
  }

  applyColors() {
    if (!this.webglAvailable) return;
    const pal = this.state === "error" ? this.palettes.error : this.palettes[this.theme];

    this.innerMat.color.setHex(pal.inner);
    this.mainSphereMat.color.setHex(pal.core);
    this.latLonMat.color.setHex(pal.rings);
    this.tickMat.color.setHex(pal.core);
    this.particleMat.color.setHex(pal.core);

    if (this.state === "listening") {
      this.scanMat.color.setHex(pal.accent);
      this.scanMat.opacity = 0.75;
    } else if (this.state === "thinking") {
      this.scanMat.color.setHex(pal.violet);
      this.scanMat.opacity = 0.85;
    } else {
      this.scanMat.color.setHex(pal.accent);
      this.scanMat.opacity = 0.32;
    }
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    document.addEventListener("visibilitychange", () => {
      this.isPaused = document.hidden;
    });

    window.addEventListener("pointermove", (e) => {
      if (this.reducedMotion) return;
      this.pointer.targetX = (e.clientX / window.innerWidth - 0.5) * 0.55;
      this.pointer.targetY = (e.clientY / window.innerHeight - 0.5) * 0.55;
    });
  }

  resize() {
    if (!this.webglAvailable || !this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(100, rect.width);
    const height = Math.max(100, rect.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.isPaused || !this.webglAvailable) return;

    const elapsed = this.clock.getElapsedTime();
    const motionScale = this.reducedMotion ? 0.12 : 1.0;

    // Speed multiplier per state
    let speedMult = 1.0;
    if (this.state === "listening") speedMult = 1.85;
    if (this.state === "thinking") speedMult = 3.1;
    if (this.state === "speaking") speedMult = 1.5 + this.audioEnergy * 1.4;
    if (this.state === "error") speedMult = 0.4;

    const dt = elapsed * motionScale * speedMult;

    // Breathing & Audio-Reactive Pulse
    let pulse = 1 + Math.sin(elapsed * 2.2) * 0.035;
    if (this.state === "listening" || this.state === "speaking") {
      pulse += this.audioEnergy * 0.22 + Math.sin(elapsed * 9) * 0.03;
    } else if (this.state === "thinking") {
      pulse = 1 + Math.sin(elapsed * 6.5) * 0.06;
    }

    this.innerCore.scale.setScalar(pulse);
    this.mainSphere.scale.setScalar(1 + (pulse - 1) * 0.55);

    this.innerCore.rotation.y = dt * 0.45;
    this.innerCore.rotation.x = dt * 0.28;
    this.mainSphere.rotation.y = -dt * 0.25;
    this.latLonShell.rotation.y = dt * 0.15;
    this.latLonShell.rotation.z = Math.sin(elapsed * 0.5) * 0.15;

    // Rotate nested orbital rings
    this.orbitalRings.forEach((ring, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1;
      ring.rotation.z += 0.0045 * dir * speedMult * motionScale;
      ring.rotation.x += 0.002 * dir * speedMult * motionScale;
    });

    this.tickRing.rotation.z = -dt * 0.22;
    this.scanRing.rotation.z = dt * 1.25;
    this.scanRing.rotation.y = Math.sin(elapsed * 1.4) * 0.65;

    if (this.particleSystem) {
      this.particleSystem.rotation.y = dt * 0.12;
      this.particleSystem.rotation.x = Math.sin(elapsed * 0.3) * 0.1;
    }

    // Subtle parallax camera response
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.06;
    this.rootGroup.rotation.y = this.pointer.x;
    this.rootGroup.rotation.x = this.pointer.y;

    this.renderer.render(this.scene, this.camera);
  }
}

window.JarvisHologramEngine = JarvisHologramEngine;