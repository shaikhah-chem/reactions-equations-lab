// Builds animated Bohr-model atoms as GLB blobs in the browser (no model files needed).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export const ATOMS = {
  H:    { name: 'الهيدروجين', sym: 'H',  z: 1,  shells: [1],          cfg: '1s<sup>1</sup>', color: '#e8e8e8' },
  Be:   { name: 'البيريليوم', sym: 'Be', z: 4,  shells: [2, 2],       cfg: '1s<sup>2</sup> 2s<sup>2</sup>', color: '#9fd18b' },
  F:    { name: 'الفلور',     sym: 'F',  z: 9,  shells: [2, 7],       cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>5</sup>', color: '#c6e86a' },
  Al:   { name: 'الألومنيوم', sym: 'Al', z: 13, shells: [2, 8, 3],    cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup> 3s<sup>2</sup> 3p<sup>1</sup>', color: '#b8c4d0' },
  Cl:   { name: 'الكلور',     sym: 'Cl', z: 17, shells: [2, 8, 7],    cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup> 3s<sup>2</sup> 3p<sup>5</sup>', color: '#70ad47' },
  K:    { name: 'البوتاسيوم', sym: 'K',  z: 19, shells: [2, 8, 8, 1], cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup> 3s<sup>2</sup> 3p<sup>6</sup> 4s<sup>1</sup>', color: '#b07fd6' },
  Al3:  { name: 'أيون الألومنيوم', sym: 'Al<sup>3+</sup>', z: 13, charge: '+3', shells: [2, 8], cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup>', color: '#b8c4d0' },
  Clm:  { name: 'أيون الكلوريد', sym: 'Cl<sup>−</sup>', z: 17, charge: '−1', shells: [2, 8, 8], cfg: '1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup> 3s<sup>2</sup> 3p<sup>6</sup>', color: '#70ad47' },
};

const SHELL_COL = ['#E07A3F', '#2E8B8B', '#2F5597', '#7030A0'];

export function buildAtomGLB(key) {
  const a = ATOMS[key];
  const scene = new THREE.Scene();
  const root = new THREE.Group(); root.name = 'atom'; scene.add(root);

  // nucleus: a cluster of protons (red) and neutrons (grey)
  const nuc = new THREE.Group(); nuc.name = 'nucleus'; root.add(nuc);
  const nCount = Math.min(2 * a.z, 24);
  const pMat = new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: .4 });
  const nMat = new THREE.MeshStandardMaterial({ color: '#a6a6a6', roughness: .4 });
  const nucR = 0.045 + 0.012 * Math.cbrt(nCount);
  const ball = new THREE.SphereGeometry(0.026, 20, 14);
  for (let i = 0; i < nCount; i++) {        // fibonacci-sphere packing
    const y = 1 - (i + .5) / nCount * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const m = new THREE.Mesh(ball, i % 2 ? nMat : pMat);
    const rr = nCount === 1 ? 0 : nucR * (0.55 + 0.45 * ((i * 7) % 5) / 4);
    m.position.set(Math.cos(th) * r * rr, y * rr, Math.sin(th) * r * rr);
    nuc.add(m);
  }

  const tracks = [];
  a.shells.forEach((count, s) => {
    const R = 0.17 + s * 0.11;
    const tilt = new THREE.Group(); tilt.name = 'tilt' + s;
    tilt.rotation.set([0.35, -0.5, 0.6, -0.25][s], 0, [0.15, 0.4, -0.35, 0.55][s]);
    root.add(tilt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0035, 8, 128),
      new THREE.MeshStandardMaterial({ color: SHELL_COL[s], transparent: true, opacity: .75, roughness: .5 }));
    ring.rotation.x = Math.PI / 2; tilt.add(ring);
    const spin = new THREE.Group(); spin.name = 'spin' + s; tilt.add(spin);
    const eMat = new THREE.MeshStandardMaterial({ color: '#4fa3ff', emissive: '#1f6fd1', emissiveIntensity: .9, roughness: .3 });
    for (let j = 0; j < count; j++) {
      const ang = 2 * Math.PI * j / count;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 12), eMat);
      e.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      spin.add(e);
    }
    // full turn about local Y (5 keys so the slerp never takes a shortcut)
    const dur = [6, 9, 12, 18][s], times = [], vals = [];
    for (let k = 0; k <= 4; k++) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (s % 2 ? -1 : 1) * k * Math.PI / 2);
      times.push(dur * k / 4); vals.push(q.x, q.y, q.z, q.w);
    }
    tracks.push({ name: spin.name, times, vals, dur });
  });
  // one clip with a common length: repeat each shell's turn to fill it
  const L = a.shells.length > 3 ? 36 : a.shells.length === 3 ? 36 : 18;
  const kf = tracks.map(t => {
    const times = [], vals = [];
    const reps = Math.round(L / t.dur);
    for (let r = 0; r < reps; r++) for (let k = (r ? 1 : 0); k < t.times.length; k++) {
      times.push(r * t.dur + t.times[k]); vals.push(...t.vals.slice(k * 4, k * 4 + 4));
    }
    return new THREE.QuaternionKeyframeTrack(t.name + '.quaternion', times, vals);
  });
  const clip = new THREE.AnimationClip('orbit', -1, kf);

  return new Promise((res, rej) => {
    new GLTFExporter().parse(scene, glb => {
      res(URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })));
    }, rej, { binary: true, animations: [clip] });
  });
}
