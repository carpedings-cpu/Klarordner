// Erzeugt die App-Symbole: ein Salbeiblatt mit Tautropfen auf dunkelgrünem Grund.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const html = (s) => `<html><body style="margin:0"><div id="i" style="width:${s}px;height:${s}px;position:relative;overflow:hidden;background:#4a6b55">
<div style="position:absolute;left:${s * .18}px;top:${s * .2}px;width:${s * .62}px;height:${s * .62}px;background:linear-gradient(135deg,#9fb48c,#6f8a4a);border-radius:0 50% 0 50%;transform:rotate(-10deg)"></div>
<div style="position:absolute;left:${s * .22}px;top:${s * .5}px;width:${s * .55}px;height:${s * .012}px;background:rgba(74,107,85,.55);transform:rotate(-45deg);transform-origin:left"></div>
<div style="position:absolute;left:${s * .5}px;top:${s * .36}px;width:${s * .17}px;height:${s * .17}px;background:linear-gradient(160deg,#ffffff,#cfe0d6);border-radius:0 50% 50% 50%;transform:rotate(45deg);opacity:.9;box-shadow:0 ${s * .01}px ${s * .03}px rgba(0,0,0,.2)"></div>
</div></body></html>`;
for (const [s, name] of [[180, 'app/icons/icon-180.png'], [192, 'app/icons/icon-192.png'], [512, 'app/icons/icon-512.png']]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(html(s));
  await p.locator('#i').screenshot({ path: name });
}
await b.close();
