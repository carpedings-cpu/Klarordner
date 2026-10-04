import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const farben = ['#2a7cf0','#23a149','#e8403c','#8a55e8','#14919a','#e9810f','#d93a82','#d99a00'];
const symbole = {
  A: s => `<div style="width:${s}px;height:${s}px;position:relative;overflow:hidden;background:linear-gradient(140deg,#3fb0ff 0%,#0a64c8 52%,#5b4fd8 100%)">
    <div style="position:absolute;width:${s*.55}px;height:${s*.55}px;border-radius:50%;left:${-s*.12}px;top:${-s*.16}px;background:rgba(255,255,255,.14)"></div>
    <div style="position:absolute;width:${s*.22}px;height:${s*.22}px;border-radius:50%;right:${s*.14}px;bottom:${s*.12}px;background:rgba(255,211,77,.9)"></div>
    <svg viewBox="0 0 24 24" style="position:absolute;left:${s*.2}px;top:${s*.2}px;width:${s*.6}px;height:${s*.6}px" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="rgba(255,255,255,.12)"/><path d="M8 13l3 3 5-5"/></svg></div>`,
  // Aktenordner mit bunten Registern: die Farben der Bereiche
  B: s => `<div style="width:${s}px;height:${s}px;position:relative;overflow:hidden;background:linear-gradient(160deg,#fdfbf7 0%,#efe9df 100%)">
    ${farben.slice(0,6).map((f,i)=>`<div style="position:absolute;right:${s*.17}px;top:${s*(.2+i*.1)}px;width:${s*.14}px;height:${s*.075}px;border-radius:0 ${s*.03}px ${s*.03}px 0;background:${f}"></div>`).join('')}
    <div style="position:absolute;left:${s*.2}px;top:${s*.14}px;width:${s*.52}px;height:${s*.72}px;border-radius:${s*.06}px;background:linear-gradient(140deg,#2f8cff,#0a5cc0);box-shadow:0 ${s*.02}px ${s*.05}px rgba(10,60,140,.35)"></div>
    <div style="position:absolute;left:${s*.31}px;top:${s*.26}px;width:${s*.3}px;height:${s*.2}px;border-radius:${s*.025}px;background:#fff"></div>
    <div style="position:absolute;left:${s*.35}px;top:${s*.31}px;width:${s*.22}px;height:${s*.025}px;border-radius:9px;background:#0a5cc0;opacity:.8"></div>
    <div style="position:absolute;left:${s*.35}px;top:${s*.37}px;width:${s*.15}px;height:${s*.025}px;border-radius:9px;background:#0a5cc0;opacity:.45"></div>
    <div style="position:absolute;left:${s*.395}px;top:${s*.6}px;width:${s*.13}px;height:${s*.13}px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:inset 0 0 0 ${s*.03}px #0a5cc0"></div>
  </div>`,
  // Bunte Blasen um ein großes K
  C: s => `<div style="width:${s}px;height:${s}px;position:relative;overflow:hidden;background:#ffffff">
    ${[[.08,.1,.3,'#ffd34d'],[.62,.06,.22,'#5ac8fa'],[.7,.6,.34,'#af52de'],[.05,.66,.22,'#34c759'],[.42,.78,.14,'#ff6b6b'],[.78,.38,.12,'#ff9f0a']].map(([x,y,d,f])=>`<div style="position:absolute;left:${s*x}px;top:${s*y}px;width:${s*d}px;height:${s*d}px;border-radius:50%;background:${f};opacity:.9"></div>`).join('')}
    <div style="position:absolute;left:${s*.22}px;top:${s*.22}px;width:${s*.56}px;height:${s*.56}px;border-radius:50%;background:linear-gradient(140deg,#3fb0ff,#0a64c8 60%,#5b4fd8);display:flex;align-items:center;justify-content:center;box-shadow:0 ${s*.02}px ${s*.06}px rgba(10,100,200,.35)">
      <span style="font:800 ${s*.34}px -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#fff;letter-spacing:-.02em;margin-top:-${s*.01}px">K</span></div>
  </div>`
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [k, f] of Object.entries(symbole)) {
  for (const s of [180, 192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0">${f(s)}</body>`);
    await p.screenshot({ path: `../symbole/${k}-${s}.png` });
    await p.close();
  }
}
// Vorschau: groß mit iOS-Maske und klein auf einem Home-Bildschirm
const gross = 260, klein = 76, maske = r => `border-radius:${r*0.2237}px;overflow:hidden`;
const platz = ['#8e8e93','#c7c7cc','#aeaeb2','#d1d1d6'];
const zelle = (inhalt, name) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:110px"><div style="width:${klein}px;height:${klein}px;${maske(klein)};box-shadow:0 2px 8px rgba(0,0,0,.25)">${inhalt}</div><span style="font:500 13px -apple-system,Segoe UI,Roboto,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)">${name}</span></div>`;
const leer = i => zelle(`<div style="width:${klein}px;height:${klein}px;background:${platz[i%4]}"></div>`, ['Kalender','Fotos','Mail','Wetter'][i%4]);
const html = `<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f2f2f7">
<div style="display:flex;gap:28px;padding:32px;justify-content:center">
${Object.entries(symbole).map(([k,f])=>`<div style="display:flex;flex-direction:column;gap:18px;align-items:center">
  <div style="font:700 22px -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1e">Variante ${k}</div>
  <div style="width:${gross}px;height:${gross}px;${maske(gross)};box-shadow:0 8px 30px rgba(0,0,0,.18)">${f(gross)}</div>
  <div style="width:${gross+40}px;padding:22px 0;border-radius:24px;background:linear-gradient(160deg,#5b6f91,#2d3a55 60%,#1c2436);display:flex;flex-wrap:wrap;justify-content:center;row-gap:16px">
    ${leer(0)}${zelle(f(klein),'Klarordner')}${leer(1)}${leer(2)}${leer(3)}${leer(4)}
  </div></div>`).join('')}
</div></body>`;
const p = await b.newPage({ viewport: { width: 1060, height: 720 } });
await p.setContent(html);
await p.screenshot({ path: '../symbole/vorschau.png', fullPage: true });
await b.close();
