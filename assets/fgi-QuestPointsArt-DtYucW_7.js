const t={antwort:25,fragen:8,halbzeit:50,komplett:50,registrierung:100,faktor:2},i=(()=>{const o=t.antwort*t.fragen+t.halbzeit+t.komplett,r=o+t.registrierung,l=r*t.faktor;return{fragebogen:o,vorBonus:r,voranmeldung:l}})(),s=`<defs>
<radialGradient id="f" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#fff4b8"/><stop offset=".42" stop-color="#ffd23d"/><stop offset="1" stop-color="#f0960c"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a76e0"/><stop offset="1" stop-color="#55399a"/></linearGradient>
<linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset="1" stop-color="#ffcd28"/></linearGradient>
</defs>`,e="M-13 -15H2A11 11 0 0 1 2 7H-3V15H-13ZM-3 -7H1A3 3 0 0 1 1 -1H-3Z",a=`<circle cy="6" r="50" fill="#fff"/><circle r="50" fill="#fff"/>
<circle cy="6" r="46" fill="#bf760a"/><circle r="46" fill="url(#f)"/>
<circle r="39" fill="none" stroke="#ffeaa3" stroke-width="3"/><circle r="35.5" fill="none" stroke="#c9820c" stroke-width="2" opacity=".75"/>
<circle r="31" fill="url(#m)"/>
<path d="${e}" transform="translate(0 2.6)" fill="#24173f" fill-rule="evenodd" opacity=".55"/>
<path d="${e}" fill="url(#p)" fill-rule="evenodd"/>
<path d="M-35 -10A37 37 0 0 1 -10 -35" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>`,f='<path d="M0 -14C1.5 -3 3 -1.5 14 0C3 1.5 1.5 3 0 14C-1.5 3 -3 1.5 -14 0C-3 -1.5 -1.5 -3 0 -14Z" fill="#fff"/>',n=o=>`data:image/svg+xml,${encodeURIComponent(o)}`,c=n(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${s}
<g transform="translate(56 58)">${a}</g>
<g transform="translate(101 19)">${f}</g>
<g transform="translate(14 101) scale(.5)">${f}</g>
</svg>`);export{c as P,i as S,t as a};
