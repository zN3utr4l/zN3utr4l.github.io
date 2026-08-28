#!/usr/bin/env node
/**
 * Genera `Carburo/prezzi/index.html` dalle medie regionali ufficiali del MIMIT.
 *
 * Perché HTML generato e non fetch dal browser:
 *  - i numeri finiscono DENTRO la pagina, quindi Google li indicizza senza
 *    dover eseguire JavaScript — che è tutto il punto di questa pagina;
 *  - il CSV del MIMIT non dichiara CORS, quindi un fetch dal browser
 *    fallirebbe comunque;
 *  - il file è di ~2,4 KB (medie regionali), non gli ~8 MB del dataset per
 *    distributore che l'app scarica: qui non serve nessuna pipeline pesante.
 *
 * Se il MIMIT non risponde o il CSV arriva vuoto lo script ESCE IN ERRORE senza
 * scrivere: meglio lasciare online la pagina di ieri, che porta la sua data in
 * chiaro, che pubblicarne una vuota.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const CSV_URL = 'https://www.mimit.gov.it/images/stories/carburanti/MediaRegionaleStradale.csv'
const OUT = 'Carburo/prezzi/index.html'
const PLAY = 'https://play.google.com/store/apps/details?id=io.github.zn3utr4l.carburo'

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
]

/** Le colonne che mostriamo, nell'ordine in cui interessano a chi cerca. */
const COLONNE = [
  { tipo: 'Benzina', erogazione: 'SELF', label: 'Benzina self' },
  { tipo: 'Gasolio', erogazione: 'SELF', label: 'Gasolio self' },
  { tipo: 'Benzina', erogazione: 'SERVITO', label: 'Benzina servito' },
  { tipo: 'Gasolio', erogazione: 'SERVITO', label: 'Gasolio servito' },
  { tipo: 'GPL', erogazione: 'SERVITO', label: 'GPL' },
  { tipo: 'Metano', erogazione: 'SERVITO', label: 'Metano' }
]

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

/**
 * Il CSV ha una riga di intestazione fuori formato («Aggiornamento 28-08-2026»),
 * poi `REGIONE;TIPOLOGIA;EROGAZIONE;PREZZO MEDIO`. Il separatore decimale è il
 * punto e il separatore di campo è il punto e virgola.
 */
export function parseMediaRegionale(csv) {
  const righe = csv.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
  const aggiornamento = (righe[0] ?? '').match(/(\d{2})-(\d{2})-(\d{4})/)
  const intestazione = righe.findIndex((r) => r.toUpperCase().startsWith('REGIONE;'))
  if (intestazione < 0) throw new Error('CSV senza intestazione REGIONE;…')

  const prezzi = new Map()
  for (const riga of righe.slice(intestazione + 1)) {
    const [regione, tipo, erogazione, prezzo] = riga.split(';').map((c) => (c ?? '').trim())
    const valore = Number.parseFloat(prezzo)
    if (!regione || !tipo || !Number.isFinite(valore) || valore <= 0) continue
    prezzi.set(`${regione}|${tipo}|${erogazione}`, valore)
  }
  if (prezzi.size === 0) throw new Error('CSV senza nessun prezzo valido')

  const regioni = [...new Set([...prezzi.keys()].map((k) => k.split('|')[0]))].sort(
    (a, b) => a.localeCompare(b, 'it')
  )
  return {
    data: aggiornamento
      ? new Date(Date.UTC(+aggiornamento[3], +aggiornamento[2] - 1, +aggiornamento[1]))
      : null,
    regioni,
    prezzo: (regione, tipo, erogazione) => prezzi.get(`${regione}|${tipo}|${erogazione}`) ?? null
  }
}

const fmt = (v) => (v == null ? '—' : v.toFixed(3).replace('.', ','))

function dataLunga(d) {
  if (!d) return 'oggi'
  return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Media nazionale semplice sulle regioni disponibili, per il sommario. */
function media(dataset, tipo, erogazione) {
  const valori = dataset.regioni
    .map((r) => dataset.prezzo(r, tipo, erogazione))
    .filter((v) => v != null)
  if (valori.length === 0) return null
  return valori.reduce((a, b) => a + b, 0) / valori.length
}

export function renderPagina(dataset) {
  const giorno = dataLunga(dataset.data)
  const iso = dataset.data ? dataset.data.toISOString().slice(0, 10) : ''
  const benzina = media(dataset, 'Benzina', 'SELF')
  const gasolio = media(dataset, 'Gasolio', 'SELF')

  const colonne = COLONNE.filter((c) =>
    dataset.regioni.some((r) => dataset.prezzo(r, c.tipo, c.erogazione) != null)
  )

  const righe = dataset.regioni.map((regione) => {
    const celle = colonne
      .map((c) => `<td>${fmt(dataset.prezzo(regione, c.tipo, c.erogazione))}</td>`)
      .join('')
    return `      <tr><th scope="row">${escape(regione)}</th>${celle}</tr>`
  }).join('\n')

  const descrizione = benzina && gasolio
    ? `Medie regionali ufficiali MIMIT del ${giorno}: benzina self ${fmt(benzina)} €/l, `
      + `gasolio self ${fmt(gasolio)} €/l. Tutte le regioni italiane, aggiornate ogni giorno.`
    : `Medie regionali ufficiali MIMIT del ${giorno} per tutte le regioni italiane.`

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(descrizione)}">
  <meta name="theme-color" content="#063f3a">
  <link rel="canonical" href="https://zn3utr4l.github.io/Carburo/prezzi/">
  <title>Prezzi benzina e gasolio oggi — medie regionali MIMIT</title>
  <link rel="stylesheet" href="../style.css">
  <script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Prezzi medi regionali dei carburanti in Italia',
    description: descrizione,
    temporalCoverage: iso,
    dateModified: iso,
    isBasedOn: CSV_URL,
    creator: { '@type': 'GovernmentOrganization', name: 'MIMIT — Osservaprezzi Carburanti' },
    license: 'https://www.mimit.gov.it/'
  }, null, 2)}
  </script>
</head>
<body>
  <header class="nav wrap">
    <a class="brand" href="../" aria-label="Carburo home"><span class="drop">C</span> Carburo</a>
    <nav><a href="../">L&rsquo;app</a><a href="../privacy.html">Privacy</a><a href="mailto:giuseppe.chirico.gc1@gmail.com?subject=%5BCarburo%5D%20Prezzi">Supporto</a></nav>
  </header>

  <main class="legal">
    <p class="eyebrow">DATI UFFICIALI MIMIT</p>
    <h1>Prezzi benzina e gasolio oggi</h1>
    <p class="updated">Medie regionali del ${escape(giorno)} &middot; fonte: Osservaprezzi Carburanti del MIMIT</p>

    <article>
      <p class="callout">
        ${benzina && gasolio
    ? `Oggi la media italiana &egrave; <strong>${fmt(benzina)} &euro;/l</strong> per la benzina self e `
        + `<strong>${fmt(gasolio)} &euro;/l</strong> per il gasolio self. Sotto trovi la tua regione.`
    : 'Sotto trovi le medie regionali pubblicate oggi.'}
      </p>

      <h2>Medie per regione (&euro;/litro)</h2>
      <div class="prices-scroll">
        <table class="prices">
          <thead>
            <tr><th scope="col">Regione</th>${colonne.map((c) => `<th scope="col">${escape(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
${righe}
          </tbody>
        </table>
      </div>
      <p class="micro">GPL e metano sono in &euro;/kg o &euro;/litro secondo la rilevazione del MIMIT. Un trattino significa che per quella regione il dato non &egrave; stato pubblicato oggi.</p>

      <h2>Che cosa sono queste medie</h2>
      <p>Il MIMIT raccoglie i prezzi che ogni gestore &egrave; obbligato a comunicare e ne pubblica ogni giorno la media per regione, distinguendo self e servito. Sono quindi <strong>prezzi ufficiali</strong>, non stime: la stessa fonte che usa l&rsquo;app.</p>
      <p>Una media regionale serve a capire se stai pagando sopra o sotto il mercato, non a scegliere dove fermarti: fra due distributori della stessa citt&agrave; la differenza arriva facilmente a dieci centesimi al litro.</p>

      <h2>Il prezzo del singolo distributore</h2>
      <p>Per vedere quanto costa <em>adesso</em> il distributore sotto casa, e quanto stai pagando in pi&ugrave; o in meno della media della tua zona, serve il dato per impianto. Carburo lo mostra su una mappa con gli stessi dati ufficiali, calcola il tuo consumo reale pieno a pieno e tiene il conto di quanto ti costa davvero l&rsquo;auto.</p>
      <p><a class="button primary" href="${PLAY}">Scarica Carburo su Google Play</a></p>
      <p class="micro">Gratis &middot; nessun account &middot; i dati restano sul telefono</p>
    </article>
  </main>

  <footer class="wrap">
    <span>&copy; ${dataset.data ? dataset.data.getUTCFullYear() : new Date().getUTCFullYear()} Giuseppe Chirico</span>
    <span><a href="../">Carburo</a> &middot; <a href="../privacy.html">Privacy</a></span>
  </footer>
</body>
</html>
`
}

async function main() {
  const risposta = await fetch(CSV_URL, { redirect: 'follow' })
  if (!risposta.ok) throw new Error(`MIMIT ha risposto ${risposta.status}`)
  const dataset = parseMediaRegionale(await risposta.text())
  const html = renderPagina(dataset)
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, html, 'utf8')
  console.log(
    `scritto ${OUT}: ${dataset.regioni.length} regioni, aggiornamento ${dataLunga(dataset.data)}`
  )
}

// ⚠️ `pathToFileURL`, non un `file://` costruito a mano: su Windows l'URL ha
// tre slash e il confronto fatto a mano non combaciava, quindi lo script non
// generava niente e non lo diceva. La guardia serve perche' i test importano
// questo modulo, e senza di lei l'import faceva una fetch di rete.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
