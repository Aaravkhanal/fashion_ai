/**
 * AUЯA Avatar Engine — Three.js 3D Fitting Room
 * Procedural humanoid avatar with cyberpunk scene, OrbitControls,
 * biometric mapping, and wardrobe integration.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── COLORS ───────────────────────────────────────────────────────────
const NEON_CYAN  = 0x00f2fe;
const NEON_VIOLET = 0x8a2be2;
const DARK_BG     = 0x030303;

// ── STATE ────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock;
let avatarGroup, bodyParts = {};
let gridFloor, gridHelper;
let currentOutfit = { top: null, bottom: null, shoes: null };

// Default biometrics
let biometrics = {
    height_cm: 178,
    body_type: 'Athletic',
    skin_tone_hex: '#c68642'
};

// ── INIT ─────────────────────────────────────────────────────────────
export function initScene(canvasContainer) {
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(DARK_BG);
    scene.fog = new THREE.FogExp2(DARK_BG, 0.015);

    const width = canvasContainer.clientWidth || canvasContainer.getBoundingClientRect().width || 600;
    const height = canvasContainer.clientHeight || canvasContainer.getBoundingClientRect().height || 800;

    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.6, 4.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    canvasContainer.appendChild(renderer.domElement);

    // OrbitControls — 360° rotation + zoom
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.0, 0);
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;

    // Build scene contents
    createLighting();
    createCyberpunkFloor();
    createAvatar();
    createParticles();

    // Resize handler
    window.addEventListener('resize', () => {
        const w = canvasContainer.clientWidth || canvasContainer.getBoundingClientRect().width || 600;
        const h = canvasContainer.clientHeight || canvasContainer.getBoundingClientRect().height || 800;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // Start loop
    animate();
}

// ── LIGHTING ─────────────────────────────────────────────────────────
function createLighting() {
    // Ambient
    scene.add(new THREE.AmbientLight(0x222233, 0.6));

    // Key light — warm, from right
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(3, 5, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 15;
    scene.add(keyLight);

    // Fill light — cool cyan from left
    const fillLight = new THREE.DirectionalLight(NEON_CYAN, 0.4);
    fillLight.position.set(-3, 3, -2);
    scene.add(fillLight);

    // Rim light — violet from behind (Fresnel Effect)
    const rimLight = new THREE.PointLight(NEON_VIOLET, 5.0, 15);
    rimLight.position.set(0, 3, -4);
    scene.add(rimLight);

    // Ground glow
    const groundGlow = new THREE.PointLight(NEON_CYAN, 0.6, 6);
    groundGlow.position.set(0, 0.1, 0);
    scene.add(groundGlow);

    // Spotlight on avatar
    const spot = new THREE.SpotLight(0xffffff, 1.0, 15, Math.PI * 0.15, 0.5, 1);
    spot.position.set(0, 6, 2);
    spot.target.position.set(0, 1, 0);
    spot.castShadow = true;
    scene.add(spot);
    scene.add(spot.target);
}

// ── CYBERPUNK FLOOR ──────────────────────────────────────────────────
function createCyberpunkFloor() {
    // Grid floor
    gridHelper = new THREE.GridHelper(30, 60, NEON_CYAN, 0x111122);
    gridHelper.material.opacity = 0.15;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Reflective floor plane
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x050508,
        metalness: 0.95,
        roughness: 0.15,
        envMapIntensity: 0.5
    });
    gridFloor = new THREE.Mesh(floorGeo, floorMat);
    gridFloor.rotation.x = -Math.PI / 2;
    gridFloor.receiveShadow = true;
    scene.add(gridFloor);

    // Neon ring around avatar platform
    const ringGeo = new THREE.RingGeometry(1.2, 1.25, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: NEON_CYAN,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Second ring
    const ring2Geo = new THREE.RingGeometry(1.5, 1.52, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
        color: NEON_VIOLET,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.01;
    scene.add(ring2);
}

// ── PROCEDURAL HUMANOID AVATAR ───────────────────────────────────────
function createAvatar() {
    avatarGroup = new THREE.Group();

    const skinColor = new THREE.Color(biometrics.skin_tone_hex);

    const skinMat = new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.3,    // Realistic skin
        metalness: 0.1,
        envMapIntensity: 0.8
    });

    const defaultClothMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.95,   // High roughness for cotton
        metalness: 0.0
    });

    const pantsMat = new THREE.MeshStandardMaterial({
        color: 0x0f0f23,
        roughness: 0.95,   // High roughness for cotton
        metalness: 0.0
    });

    const shoesMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.4,
        metalness: 0.3
    });

    // ─ HEAD ─
    const headGeo = new THREE.SphereGeometry(0.14, 32, 32);
    const head = new THREE.Mesh(headGeo, skinMat.clone());
    head.position.set(0, 1.65, 0);
    head.scale.set(1, 1.15, 0.95);
    head.castShadow = true;
    bodyParts.head = head;

    // ─ NECK ─
    const neckGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.08, 32);
    const neck = new THREE.Mesh(neckGeo, skinMat.clone());
    neck.position.set(0, 1.51, 0);
    bodyParts.neck = neck;

    // ─ TORSO ─
    const torsoGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.5, 32);
    const torso = new THREE.Mesh(torsoGeo, defaultClothMat.clone());
    torso.position.set(0, 1.22, 0);
    torso.castShadow = true;
    bodyParts.torso = torso;

    // ─ HIPS ─
    const hipsGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.15, 32);
    const hips = new THREE.Mesh(hipsGeo, pantsMat.clone());
    hips.position.set(0, 0.92, 0);
    bodyParts.hips = hips;

    // ─ LEFT ARM ─
    const armGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.45, 32);

    const leftUpperArm = new THREE.Mesh(armGeo, defaultClothMat.clone());
    leftUpperArm.position.set(-0.25, 1.27, 0);
    leftUpperArm.rotation.z = 0.15;
    leftUpperArm.castShadow = true;
    bodyParts.leftUpperArm = leftUpperArm;

    const leftForearm = new THREE.Mesh(armGeo.clone(), skinMat.clone());
    leftForearm.position.set(-0.28, 0.85, 0);
    leftForearm.rotation.z = 0.08;
    bodyParts.leftForearm = leftForearm;

    // ─ RIGHT ARM ─
    const rightUpperArm = new THREE.Mesh(armGeo.clone(), defaultClothMat.clone());
    rightUpperArm.position.set(0.25, 1.27, 0);
    rightUpperArm.rotation.z = -0.15;
    rightUpperArm.castShadow = true;
    bodyParts.rightUpperArm = rightUpperArm;

    const rightForearm = new THREE.Mesh(armGeo.clone(), skinMat.clone());
    rightForearm.position.set(0.28, 0.85, 0);
    rightForearm.rotation.z = -0.08;
    bodyParts.rightForearm = rightForearm;

    // ─ HANDS ─
    const handGeo = new THREE.SphereGeometry(0.035, 32, 32);
    const leftHand = new THREE.Mesh(handGeo, skinMat.clone());
    leftHand.position.set(-0.3, 0.62, 0);
    bodyParts.leftHand = leftHand;

    const rightHand = new THREE.Mesh(handGeo.clone(), skinMat.clone());
    rightHand.position.set(0.3, 0.62, 0);
    bodyParts.rightHand = rightHand;

    // ─ LEFT LEG ─
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.45, 32);

    const leftThigh = new THREE.Mesh(legGeo, pantsMat.clone());
    leftThigh.position.set(-0.09, 0.65, 0);
    leftThigh.castShadow = true;
    bodyParts.leftThigh = leftThigh;

    const leftShin = new THREE.Mesh(legGeo.clone(), pantsMat.clone());
    leftShin.position.set(-0.09, 0.22, 0);
    bodyParts.leftShin = leftShin;

    // ─ RIGHT LEG ─
    const rightThigh = new THREE.Mesh(legGeo.clone(), pantsMat.clone());
    rightThigh.position.set(0.09, 0.65, 0);
    rightThigh.castShadow = true;
    bodyParts.rightThigh = rightThigh;

    const rightShin = new THREE.Mesh(legGeo.clone(), pantsMat.clone());
    rightShin.position.set(0.09, 0.22, 0);
    bodyParts.rightShin = rightShin;

    // ─ SHOES ─
    const shoeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.15);
    const leftShoe = new THREE.Mesh(shoeGeo, shoesMat.clone());
    leftShoe.position.set(-0.09, 0.02, 0.02);
    leftShoe.castShadow = true;
    bodyParts.leftShoe = leftShoe;

    const rightShoe = new THREE.Mesh(shoeGeo.clone(), shoesMat.clone());
    rightShoe.position.set(0.09, 0.02, 0.02);
    rightShoe.castShadow = true;
    bodyParts.rightShoe = rightShoe;

    // Add all to group
    Object.values(bodyParts).forEach(part => avatarGroup.add(part));
    scene.add(avatarGroup);
}

// ── AMBIENT PARTICLES ────────────────────────────────────────────────
function createParticles() {
    const count = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * 15;
        pos[i * 3 + 1] = Math.random() * 8;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
        color: NEON_CYAN,
        size: 0.02,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(geo, mat);
    particles.userData.isParticles = true;
    scene.add(particles);
}

// ── BIOMETRIC MAPPING ────────────────────────────────────────────────
export function applyBiometrics(data) {
    biometrics = { ...biometrics, ...data };

    // 1. Manual Height override (Scale Y mostly)
    const heightCm = biometrics.height_cm || 180;
    const heightScale = heightCm / 180; // 180cm = scale 1.0
    
    // Scale entire avatar group by height scale uniformly so nothing breaks
    avatarGroup.scale.set(heightScale, heightScale, heightScale);

    // 2. Manual Weight override (Girth)
    const weightKg = biometrics.weight_kg || 80;
    const weightScale = weightKg / 80; // 80kg = scale 1.0
    
    let weightScaleX = weightScale;
    let weightScaleZ = weightScale;

    // 3. AI Proportions (Ratios relative to 1.0)
    const s = biometrics.shoulder_width || 1.0;
    const w = biometrics.waist_width || 1.0;
    const hip = biometrics.hip_width || 1.0;
    const l = biometrics.leg_length || 1.0;
    const a = biometrics.arm_length || 1.0;

    // 4. Apply Skin Tone
    if (biometrics.skin_tone_hex) {
        const skinColor = new THREE.Color(biometrics.skin_tone_hex);
        ['head', 'neck', 'leftForearm', 'rightForearm', 'leftHand', 'rightHand'].forEach(partName => {
            if (bodyParts[partName]) {
                bodyParts[partName].material.color.copy(skinColor);
            }
        });
    }

    // 5. Mesh Scaling Magic
    if (bodyParts.torso) {
        // Torso: shoulders width, chest depth
        const chest = biometrics.chest_depth || w;
        bodyParts.torso.scale.set(s * weightScaleX, 1, chest * weightScaleZ);
        
        // Hips match hip width and weight scale
        if (bodyParts.hips) {
            bodyParts.hips.scale.set(hip * weightScaleX, 1, w * weightScaleZ);
        }

        // Adjust arms
        if (bodyParts.leftUpperArm) {
            bodyParts.leftUpperArm.position.x = -0.25 * s * weightScaleX;
            bodyParts.leftUpperArm.scale.set(weightScaleX, a, weightScaleZ);
        }
        if (bodyParts.rightUpperArm) {
            bodyParts.rightUpperArm.position.x = 0.25 * s * weightScaleX;
            bodyParts.rightUpperArm.scale.set(weightScaleX, a, weightScaleZ);
        }
        if (bodyParts.leftForearm) {
            bodyParts.leftForearm.position.x = -0.28 * s * weightScaleX;
            bodyParts.leftForearm.scale.set(weightScaleX, a, weightScaleZ);
            bodyParts.leftForearm.position.y = 0.85 - ((a - 1) * 0.2); // move down if long
        }
        if (bodyParts.rightForearm) {
            bodyParts.rightForearm.position.x = 0.28 * s * weightScaleX;
            bodyParts.rightForearm.scale.set(weightScaleX, a, weightScaleZ);
            bodyParts.rightForearm.position.y = 0.85 - ((a - 1) * 0.2);
        }
        if (bodyParts.leftHand) {
            bodyParts.leftHand.position.x = -0.3 * s * weightScaleX;
            bodyParts.leftHand.position.y = 0.62 - ((a - 1) * 0.4);
        }
        if (bodyParts.rightHand) {
            bodyParts.rightHand.position.x = 0.3 * s * weightScaleX;
            bodyParts.rightHand.position.y = 0.62 - ((a - 1) * 0.4);
        }
    }

    // Legs thickness and length
    ['leftThigh', 'rightThigh', 'leftShin', 'rightShin'].forEach(p => {
        if (bodyParts[p]) {
            bodyParts[p].scale.set(weightScaleX, l, weightScaleZ);
        }
    });
}

// ── WARDROBE INTEGRATION ─────────────────────────────────────────────
// Outfit configs keyed by name
const OUTFIT_PRESETS = {
    'midnight_blazer': {
        top: 0x1a1a4e,
        bottom: 0x0a0a1a,
        shoes: 0x111111,
        topMetal: 0.15,
        topRough: 0.55
    },
    'streetwear_black': {
        top: 0x0a0a0a,
        bottom: 0x121212,
        shoes: 0xfafafa,
        topMetal: 0.05,
        topRough: 0.8
    },
    'summer_linen': {
        top: 0xf5f0e6,
        bottom: 0xd4c4a8,
        shoes: 0xc4956a,
        topMetal: 0.0,
        topRough: 0.9
    },
    'cyber_neon': {
        top: 0x00f2fe,
        bottom: 0x0a0a2e,
        shoes: 0x8a2be2,
        topMetal: 0.4,
        topRough: 0.3
    },
    'urban_edge': {
        top: 0x2d2d2d,
        bottom: 0x1a1a1a,
        shoes: 0x333333,
        topMetal: 0.2,
        topRough: 0.5
    },
    'classic_navy': {
        top: 0x1b2a4a,
        bottom: 0x3a3a3a,
        shoes: 0x5c3a1e,
        topMetal: 0.1,
        topRough: 0.6
    }
};

export function changeOutfit(presetName) {
    const preset = OUTFIT_PRESETS[presetName];
    if (!preset) return;

    currentOutfit = { ...preset };

    // Animate top
    const topColor = new THREE.Color(preset.top);
    ['torso', 'leftUpperArm', 'rightUpperArm'].forEach(p => {
        if (bodyParts[p]) {
            bodyParts[p].material.color.copy(topColor);
            bodyParts[p].material.metalness = preset.topMetal !== undefined ? preset.topMetal : 0.0;
            bodyParts[p].material.roughness = preset.topRough !== undefined ? preset.topRough : 0.95;
            
            // Inflate slightly to simulate clothing thickness
            if (p === 'torso') {
                bodyParts[p].scale.x *= 1.05;
                bodyParts[p].scale.z *= 1.05;
            } else {
                bodyParts[p].scale.x *= 1.03;
                bodyParts[p].scale.z *= 1.03;
            }
        }
    });

    // Animate bottom
    const bottomColor = new THREE.Color(preset.bottom);
    ['hips', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin'].forEach(p => {
        if (bodyParts[p]) {
            bodyParts[p].material.color.copy(bottomColor);
            bodyParts[p].material.metalness = 0.0;
            bodyParts[p].material.roughness = 0.95;
        }
    });

    // Animate shoes
    const shoeColor = new THREE.Color(preset.shoes);
    ['leftShoe', 'rightShoe'].forEach(p => {
        if (bodyParts[p]) {
            bodyParts[p].material.color.copy(shoeColor);
        }
    });
}

export function changeOutfitCustom(topHex, bottomHex, shoesHex) {
    if (topHex) {
        const c = new THREE.Color(topHex);
        ['torso', 'leftUpperArm', 'rightUpperArm'].forEach(p => {
            if (bodyParts[p]) bodyParts[p].material.color.copy(c);
        });
    }
    if (bottomHex) {
        const c = new THREE.Color(bottomHex);
        ['hips', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin'].forEach(p => {
            if (bodyParts[p]) bodyParts[p].material.color.copy(c);
        });
    }
    if (shoesHex) {
        const c = new THREE.Color(shoesHex);
        ['leftShoe', 'rightShoe'].forEach(p => {
            if (bodyParts[p]) bodyParts[p].material.color.copy(c);
        });
    }
}

// ── CONTROLS ─────────────────────────────────────────────────────────
export function toggleAutoRotate(enabled) {
    if (controls) controls.autoRotate = enabled;
}

export function resetCamera() {
    if (controls) {
        controls.reset();
        camera.position.set(0, 1.6, 4.5);
        controls.target.set(0, 1.0, 0);
    }
}

// ── ANIMATION LOOP ───────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    // Subtle idle animation — gentle sway
    if (avatarGroup) {
        avatarGroup.position.y = Math.sin(t * 1.5) * 0.008;
        // Gentle breathing
        if (bodyParts.torso) {
            bodyParts.torso.scale.z = 1 + Math.sin(t * 2) * 0.015;
        }
    }

    // Animate particles
    scene.traverse(obj => {
        if (obj.userData.isParticles) {
            const positions = obj.geometry.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] += Math.sin(t + i) * 0.0003;
            }
            obj.geometry.attributes.position.needsUpdate = true;
        }
    });

    // Pulse floor ring
    scene.traverse(obj => {
        if (obj.geometry instanceof THREE.RingGeometry && obj.material.color.getHex() === NEON_CYAN) {
            obj.material.opacity = 0.25 + Math.sin(t * 2) * 0.15;
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

// ── EXPORTS ──────────────────────────────────────────────────────────
export { OUTFIT_PRESETS };
