/**
 * Test del parser del CSV MIMIT. Gira con `node --test scripts/` — `node:test` è
 * integrato, quindi questo repo resta senza dipendenze e senza package.json.
 *
 * Il parser è il pezzo rischioso: se il formato cambia, la pagina non deve
 * uscire vuota o con numeri sbagliati — deve rifiutarsi di essere scritta.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseMediaRegionale, renderPagina } from './build-prezzi.mjs'

const CSV = [
  'Aggiornamento 28-08-2026',
  'REGIONE;TIPOLOGIA;EROGAZIONE;PREZZO MEDIO',
  'Abruzzo;Gasolio;SELF;2.134',
  'Abruzzo;Benzina;SELF;2.016',
  'Abruzzo;GPL;SERVITO;0.769',
  'Lombardia;Benzina;SELF;2.009',
  'Lombardia;Gasolio;SELF;2.128',
  ''
].join('\r\n')

test('legge data, regioni e prezzi', () => {
  const d = parseMediaRegionale(CSV)

  assert.equal(d.data.toISOString().slice(0, 10), '2026-08-28')
  assert.deepEqual(d.regioni, ['Abruzzo', 'Lombardia'])
  assert.equal(d.prezzo('Abruzzo', 'Benzina', 'SELF'), 2.016)
  assert.equal(d.prezzo('Lombardia', 'GPL', 'SERVITO'), null)
})

test('rifiuta un CSV senza intestazione invece di produrre una pagina vuota', () => {
  assert.throws(() => parseMediaRegionale('qualcosa\naltro\n'), /intestazione/)
})

test('rifiuta un CSV con la sola intestazione', () => {
  assert.throws(
    () => parseMediaRegionale('Aggiornamento 28-08-2026\nREGIONE;TIPOLOGIA;EROGAZIONE;PREZZO MEDIO\n'),
    /nessun prezzo valido/
  )
})

test('scarta le righe con prezzo non numerico o a zero', () => {
  const d = parseMediaRegionale([
    'Aggiornamento 28-08-2026',
    'REGIONE;TIPOLOGIA;EROGAZIONE;PREZZO MEDIO',
    'Lazio;Benzina;SELF;n.d.',
    'Lazio;Gasolio;SELF;0',
    'Lazio;GPL;SERVITO;0.733'
  ].join('\n'))

  assert.equal(d.prezzo('Lazio', 'Benzina', 'SELF'), null)
  assert.equal(d.prezzo('Lazio', 'Gasolio', 'SELF'), null)
  assert.equal(d.prezzo('Lazio', 'GPL', 'SERVITO'), 0.733)
})

test('la pagina porta i numeri nel corpo, non in uno script', () => {
  // È tutto il punto della pagina: Google deve leggerli senza eseguire JS.
  const html = renderPagina(parseMediaRegionale(CSV))

  assert.match(html, /2,016/)
  assert.match(html, /28 agosto 2026/)
  assert.match(html, /<th scope="row">Lombardia<\/th>/)
})

test('una colonna senza nessun dato non compare in tabella', () => {
  // Il CSV del MIMIT pubblica benzina e gasolio solo in SELF: una colonna
  // «Benzina servito» sempre vuota sarebbe rumore.
  const html = renderPagina(parseMediaRegionale(CSV))

  assert.doesNotMatch(html, /Benzina servito/)
  assert.match(html, /Benzina self/)
})

test('le virgolette nei nomi non rompono l’HTML', () => {
  const html = renderPagina(parseMediaRegionale([
    'Aggiornamento 28-08-2026',
    'REGIONE;TIPOLOGIA;EROGAZIONE;PREZZO MEDIO',
    'Valle d<script>;Benzina;SELF;2.031'
  ].join('\n')))

  assert.doesNotMatch(html, /Valle d<script>/)
  assert.match(html, /Valle d&lt;script&gt;/)
})

test('i dati freschi riportano la data senza avvisi', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-28T12:00:00Z') })
  const html = renderPagina(parseMediaRegionale(CSV))

  for (const tag of ['<title>', '<h1>', '<meta name="description"']) {
    assert.match(html.slice(html.indexOf(tag)).split(/<\/(?:title|h1|p)>|\n  <meta name="theme-color"/)[0], /28 agosto 2026/)
  }
  assert.match(html, /<title>Prezzi benzina e gasolio/)
  assert.match(html, /<h1>Prezzi benzina e gasolio/)
  assert.doesNotMatch(html, /Dati non aggiornati|oggi/i)
})

test('i dati di dodici giorni prima sono segnalati come non aggiornati', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-09T00:00:00Z') })
  const html = renderPagina(parseMediaRegionale(CSV))

  for (const tag of ['<title>', '<h1>', '<meta name="description"', '<p class="callout">']) {
    const testo = html.slice(html.indexOf(tag)).split(/<\/(?:title|h1|p)>|\n  <meta name="theme-color"/)[0]
    assert.match(testo, /28 agosto 2026/)
    assert.match(testo, /Dati non aggiornati/)
  }
  assert.doesNotMatch(html, /oggi|aggiornate ogni giorno|adesso/i)
})

test('l’avviso scatta solo oltre due giorni dalla data del dataset', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-30T00:00:00Z') })
  const dataset = parseMediaRegionale(CSV)
  assert.doesNotMatch(renderPagina(dataset), /Dati non aggiornati/)
  t.mock.timers.tick(1)
  assert.match(renderPagina(dataset), /Dati non aggiornati/)
})

test('rifiuta date mancanti, illeggibili o impossibili', () => {
  for (const data of ['', 'data sconosciuta', '31-02-2026', '28-13-2026']) {
    assert.throws(() => parseMediaRegionale(CSV.replace('28-08-2026', data)), /data.*valida/i)
  }
})

test('il rendering rifiuta un dataset senza data valida', () => {
  for (const data of [null, new Date('non valida')]) {
    assert.throws(() => renderPagina({ ...parseMediaRegionale(CSV), data }), /data.*valida/i)
  }
})
