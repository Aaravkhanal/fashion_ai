const fs = require('fs');

let html = fs.readFileSync('frontend/fitting-room.html', 'utf8');

// 1. Add Pinterest Search Bar and Photoreal Button to Right Panel
html = html.replace(
    /<div class="p-5 border-b border-white\/10">[\s\S]*?<\/div>\s*<div class="p-4 flex-1 overflow-y-auto sidebar-scroll space-y-3" id="outfit-list">/,
    `<div class="p-5 border-b border-white/10">
                <h2 class="text-lg font-bold flex items-center gap-2">
                    <span class="text-gradient">✦</span> Wardrobe & Pinterest
                </h2>
                <div class="mt-3 flex gap-2">
                    <input type="text" id="pinterest-search" placeholder="Search Pinterest..." class="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[color:var(--neon-cyan)] text-white">
                    <button id="pinterest-btn" class="bg-white/10 hover:bg-[color:var(--neon-cyan)] hover:text-black px-3 py-1.5 rounded text-xs font-bold transition-colors">Search</button>
                </div>
            </div>

            <div class="p-4 flex-1 overflow-y-auto sidebar-scroll space-y-3" id="outfit-list">`
);

html = html.replace(
    /<\/div>\s*<\/div>\s*<!-- ═══ SCRIPTS ═══ -->/,
    `</div>
            <div class="p-4 border-t border-white/10 bg-black/40 hidden" id="photoreal-panel">
                <button id="trigger-photoreal" class="w-full bg-[color:var(--neon-cyan)] text-black font-bold py-2 rounded-lg text-sm hover:scale-[1.02] transition">Generate Photoreal Try-On</button>
                <div id="photoreal-loading" class="text-xs text-center mt-2 text-[color:var(--neon-cyan)] hidden animate-pulse">Warping 2D Image... Please wait.</div>
            </div>
        </div>
    </div>

    <!-- ═══ SCRIPTS ═══ -->`
);

// 2. Add Photoreal Overlay to Center Panel
html = html.replace(
    /<div id="three-canvas" class="w-full h-full opacity-0 pointer-events-none scale-95 transition-all duration-1000"><\/div>/,
    `<div id="three-canvas" class="w-full h-full opacity-0 pointer-events-none scale-95 transition-all duration-1000 relative">
                    <!-- Photoreal Overlay -->
                    <div id="photoreal-overlay" class="absolute inset-0 z-50 hidden bg-black/80 flex flex-col items-center justify-center p-4 rounded-xl">
                        <img id="photoreal-image" class="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-white/20">
                        <button onclick="document.getElementById('photoreal-overlay').classList.add('hidden')" class="absolute top-4 right-4 bg-white/10 hover:bg-[color:var(--neon-red)] text-white hover:text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button>
                    </div>
                </div>`
);

// 3. Update Script Imports
html = html.replace(
    /import { initScene, applyBiometrics, changeOutfit, changeOutfitCustom, resetCamera, toggleAutoRotate, OUTFIT_PRESETS } from '\.\/fitting-room\.js';/,
    `import { initScene, applyBiometrics, changeOutfit, changeOutfitCustom, resetCamera, toggleAutoRotate, OUTFIT_PRESETS, applyPinterestTo3D, trigger2DPhotorealTryOn } from './fitting-room.js';`
);

// 4. Add JS Logic for Pinterest & Try-On
const logic = `
        let selectedGarmentUrl = null;

        // ── Pinterest Integration ──
        document.getElementById('pinterest-btn').addEventListener('click', async () => {
            const query = document.getElementById('pinterest-search').value.trim();
            if(!query) return;
            
            const btn = document.getElementById('pinterest-btn');
            btn.textContent = '...';
            btn.disabled = true;

            try {
                const res = await fetch(\`/api/pinterest-fashion?q=\${encodeURIComponent(query)}\`);
                const data = await res.json();
                
                const outfitList = document.getElementById('outfit-list');
                outfitList.innerHTML = '';

                if(data.fashionItems && data.fashionItems.length > 0) {
                    data.fashionItems.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'outfit-card rounded-xl p-3 cursor-pointer';
                        card.innerHTML = \`
                            <div class="flex gap-3">
                                <div class="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                    <img src="\${item.imageUrl}" class="w-full h-full object-cover">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h4 class="text-xs font-semibold truncate text-white">\${item.title}</h4>
                                    </div>
                                    <p class="text-[10px] text-[color:var(--neon-cyan)] mt-1">Pinterest Result</p>
                                </div>
                            </div>
                        \`;
                        card.addEventListener('click', () => {
                            document.querySelectorAll('.outfit-card').forEach(c => c.classList.remove('active'));
                            card.classList.add('active');
                            
                            // 1. Instant 3D Color Extraction
                            applyPinterestTo3D(item.imageUrl);
                            
                            // 2. Prep for 2D Try-On
                            selectedGarmentUrl = item.imageUrl;
                            document.getElementById('photoreal-panel').classList.remove('hidden');
                        });
                        outfitList.appendChild(card);
                    });
                } else {
                    outfitList.innerHTML = '<p class="text-xs text-gray-400 text-center mt-4">No results found.</p>';
                }
            } catch(e) {
                console.error(e);
                alert("Failed to search Pinterest");
            } finally {
                btn.textContent = 'Search';
                btn.disabled = false;
            }
        });

        // ── True Photoreal Try-On ──
        document.getElementById('trigger-photoreal').addEventListener('click', () => {
            if(!selectedGarmentUrl) {
                alert("Please select a garment first.");
                return;
            }
            if(!imageUploaded) {
                alert("Please upload your base photo first.");
                return;
            }
            
            const base64 = document.getElementById('photo-preview').src;
            document.getElementById('photoreal-loading').classList.remove('hidden');
            trigger2DPhotorealTryOn(base64, selectedGarmentUrl);
        });

        window.addEventListener('tryon-ready', (e) => {
            document.getElementById('photoreal-loading').classList.add('hidden');
            const url = e.detail;
            document.getElementById('photoreal-image').src = url;
            document.getElementById('photoreal-overlay').classList.remove('hidden');
        });
`;

html = html.replace(
    /\/\/ ── Scan Body Handler ──/,
    logic + '\n\n        // ── Scan Body Handler ──'
);

fs.writeFileSync('frontend/fitting-room.html', html);
