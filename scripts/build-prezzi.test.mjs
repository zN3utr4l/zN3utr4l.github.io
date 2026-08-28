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
