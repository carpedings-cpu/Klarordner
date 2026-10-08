// Erzeugt die App-Symbole: Blasen in den Grüntönen der Bereiche, in der Mitte das K auf Salbei.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const schrift = fs.readFileSync('app/schriften/fraunces-latin-600-normal.woff2').toString('base64');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const html = (s) => `<html><head><style>@font-face{font-family:F;src:url(data:font/woff2;base64,${schrift}) format("woff2")}</style></head><body style="margin:0"><div id="i" style="width:${s}px;height:${s}px;position:relative;overflow:hidden;background:#ffffff">
${[[.08, .1, .3, '#8a7a3a'], [.62, .06, .22, '#2f7a5c'], [.7, .6, .34, '#2b6f73'], [.05, .66, .22, '#6f8a4a'], [.42, .78, .14, '#5c6b3f'], [.78, .38, .12, '#3f7f6e']].map(([x, y, d, f]) => `<div style="position:absolute;left:${s * x}px;top:${s * y}px;width:${s * d}px;height:${s * d}px;border-radius:50%;background:${f};opacity:.85"></div>`).join('')}
<div style="position:absolute;left:${s * .22}px;top:${s * .22}px;width:${s * .56}px;height:${s * .56}px;border-radius:50%;background:#4a6b55;display:flex;align-items:center;justify-content:center;box-shadow:0 ${s * .02}px ${s * .06}px rgba(74,107,85,.35)">
<span style="font:600 ${s * .36}px F,Georgia,serif;color:#fff;margin-top:-${s * .02}px">K</span></div>
</div></body></html>`;
for (const [s, name] of [[180, 'app/icons/icon-180.png'], [192, 'app/icons/icon-192.png'], [512, 'app/icons/icon-512.png']]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(html(s));
  await p.evaluate(() => document.fonts.ready);
  await p.locator('#i').screenshot({ path: name });
}
await b.close();
