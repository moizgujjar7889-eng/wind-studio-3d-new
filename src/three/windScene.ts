import * as THREE from 'three';
import type { CharacterPreset, LocationPreset } from '../lib/types';
import { buildCharacter, type CharacterRig } from './character';
import { createDressSimulation, type DressSimulation } from './dressSim';
import { buildEnvironment, type EnvironmentHandle } from './environment';

export interface SceneCallbacks {
  onFps?(fps: number): void;
}

export class WindScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private rig: CharacterRig | null = null;
  private dress: DressSimulation | null = null;
  private env: EnvironmentHandle | null = null;
  private envPreset: LocationPreset | null = null;
  private sky: THREE.Mesh | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private fog: THREE.FogExp2 | null = null;
  private wind = 0;
  private windSmooth = 0;
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private resizeObs: ResizeObserver;
  private rotateTarget = 0;
  private yaw = 0;
  private distance = 3.4;
  private distanceTarget = 3.4;
  private frames = 0;
  private fpsAt = 0;
  private characterPreset: CharacterPreset;

  constructor(container: HTMLElement, location: LocationPreset, character: CharacterPreset, callbacks: SceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.characterPreset = character;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 1.5, 3.4);
    this.camera.lookAt(0, 1.1, 0);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);

    this.setLocation(location);
    this.setCharacter(character);
    this.loop();
  }

  setWind(w: number) {
    this.wind = w;
  }

  setCharacter(preset: CharacterPreset) {
    this.characterPreset = preset;
    if (this.dress) {
      this.dress.dispose();
      this.dress = null;
    }
    if (this.rig) {
      this.scene.remove(this.rig.group);
      this.rig = null;
    }
    this.rig = buildCharacter(preset);
    this.scene.add(this.rig.group);
    this.dress = createDressSimulation(this.rig, this.scene, {
      dressColor: preset.dressColor,
      accentColor: preset.accentColor,
      hairColor: preset.hairColor,
      dressLength: preset.dressLength,
      fit: preset.fit,
      style: preset.style,
    });
  }

  setLocation(preset: LocationPreset) {
    if (this.env) {
      this.scene.remove(this.env.group);
      this.env.dispose();
    }
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
    }
    this.envPreset = preset;
    this.env = buildEnvironment(preset);
    this.scene.add(this.env.group);

    // sky dome
    const skyGeo = new THREE.SphereGeometry(50, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(preset.skyTop) },
        bottom: { value: new THREE.Color(preset.skyBottom) },
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
        void main(){ float h = clamp(vPos.y / 40.0 + 0.35, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // lighting
    if (this.sun) {
      this.scene.remove(this.sun);
      this.sun.dispose();
    }
    if (this.hemi) this.scene.remove(this.hemi);
    this.sun = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
    this.sun.position.set(...preset.sunPosition);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -6;
    this.sun.shadow.camera.right = 6;
    this.sun.shadow.camera.top = 6;
    this.sun.shadow.camera.bottom = -6;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
    this.scene.add(this.hemi);

    if (!this.fog) {
      this.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
      this.scene.fog = this.fog;
    } else {
      this.fog.color.set(preset.fogColor);
      this.fog.density = preset.fogDensity;
    }
  }

  /** Drag-to-orbit yaw offset in radians */
  addYaw(delta: number) {
    this.rotateTarget = THREE.MathUtils.clamp(this.rotateTarget + delta, -1.2, 1.2);
  }

  addZoom(delta: number) {
    this.distanceTarget = THREE.MathUtils.clamp(this.distanceTarget + delta, 1.8, 6.5);
  }

  resetYaw() {
    this.rotateTarget = 0;
    this.distanceTarget = 3.4;
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    // fps
    this.frames++;
    if (time - this.fpsAt >= 1) {
      this.callbacks.onFps?.(this.frames);
      this.frames = 0;
      this.fpsAt = time;
    }

    this.windSmooth += (this.wind - this.windSmooth) * Math.min(1, dt * 6);
    const w = this.windSmooth;

    // ambient + gusts shaping
    const amb = this.envPreset ? this.envPreset.ambient : 0.1;
    const effective = Math.min(1, Math.max(amb, w));

    // slow idle sway of the whole figure
    if (this.rig) {
      this.rig.group.rotation.y = Math.sin(time * 0.4) * 0.05;
      this.rig.torso.position.y = 0.92 + Math.sin(time * 1.7) * 0.004;
      this.rig.head.rotation.z = Math.sin(time * 0.9) * 0.03;
      this.rig.head.rotation.x = Math.sin(time * 0.7 + 1) * 0.02 - w * 0.06;
    }

    this.dress?.update(dt, time, effective);
    this.env?.update(dt, time, effective);

    // camera micro-shake with strong wind + orbit yaw + smooth zoom
    this.yaw += (this.rotateTarget - this.yaw) * Math.min(1, dt * 5);
    this.distance += (this.distanceTarget - this.distance) * Math.min(1, dt * 4);
    const shake = w * w * 0.012;
    const d = this.distance;
    this.camera.position.x = Math.sin(this.yaw) * d + Math.sin(time * 13) * shake;
    this.camera.position.z = Math.cos(this.yaw) * d + Math.cos(time * 11) * shake;
    this.camera.position.y = 1.5 + (d - 3.4) * 0.15 + Math.sin(time * 9) * shake * 0.5;
    this.camera.lookAt(0, 1.05, 0);

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.dress?.dispose();
    this.env?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
