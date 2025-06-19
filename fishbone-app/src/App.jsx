import { useEffect, useRef, useState } from 'react'
import vegaEmbed from 'vega-embed'
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch'
import data from './data/example.json'
import './App.css'

function generateSpec(d, collapsed = {}) {
  const width = 800
  const height = 400
  const midY = height / 2
  const catSpacing = (width - 200) / d.kategorien.length
  const lines = []
  const labels = []
  const categories = d.kategorien.map(c => c.name)

  // main spine
  lines.push({ x1: 50, y1: midY, x2: width - 100, y2: midY, category: 'main' })
  labels.push({ x: width - 90, y: midY - 10, text: d.fehler, category: 'main', align: 'left', type: 'root', link: d.link, raw: d })

  d.kategorien.forEach((cat, i) => {
    const baseX = 50 + (i + 1) * catSpacing
    const orientation = i % 2 === 0 ? -1 : 1
    const x1 = baseX - 30
    const y1 = midY
    const x2 = baseX
    const y2 = midY + orientation * 60
    lines.push({ x1, y1, x2, y2, category: cat.name })
    labels.push({ x: x2 + 5, y: y2, text: cat.name, category: cat.name, align: 'left', type: 'category', link: cat.link, raw: cat })
    if (!collapsed[cat.name]) {
      cat.ursachen.forEach((cause, j) => {
        const cx2 = x2
        const cy2 = y2 + orientation * (j + 1) * 20
        const cx1 = cx2 - 30
        const cy1 = cy2
        lines.push({ x1: cx1, y1: cy1, x2: cx2, y2: cy2, category: cat.name })
        labels.push({ x: cx1 - 5, y: cy1, text: cause.name, category: cat.name, align: 'right', type: 'cause', link: cause.link, raw: cause })
      })
    }
  })

  return {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width,
    height,
    padding: 5,
    data: [
      { name: 'lines', values: lines },
      { name: 'labels', values: labels }
    ],
    scales: [
      {
        name: 'color',
        type: 'ordinal',
        domain: categories,
        range: { scheme: 'category10' }
      }
    ],
    marks: [
      {
        type: 'rule',
        from: { data: 'lines' },
        encode: {
          update: {
            x: { field: 'x1' },
            y: { field: 'y1' },
            x2: { field: 'x2' },
            y2: { field: 'y2' },
            strokeWidth: { value: 2 },
            stroke: [
              { test: "datum.category === 'main'", value: 'black' },
              { scale: 'color', field: 'category' }
            ]
          }
        }
      },
      {
        type: 'text',
        from: { data: 'labels' },
        encode: {
          update: {
            x: { field: 'x' },
            y: { field: 'y' },
            align: { field: 'align', default: 'left' },
            baseline: { value: 'middle' },
            fill: [
              { test: "datum.category === 'main'", value: 'black' },
              { scale: 'color', field: 'category' }
            ],
            fontSize: { value: 12 },
            text: { field: 'text' },
            href: { field: 'link' }
          }
        }
      }
    ]
  }
}

function App() {
  const ref = useRef(null)
  const viewRef = useRef(null)
  const [collapsed, setCollapsed] = useState({})
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const spec = generateSpec(data, collapsed)
    if (ref.current) ref.current.innerHTML = ''
    let view
    let handler
    vegaEmbed(ref.current, spec, { actions: false }).then(res => {
      view = res.view
      viewRef.current = view
      handler = (event, item) => {
        if (item && item.datum) {
          if (item.datum.type === 'category') {
            setCollapsed(c => ({ ...c, [item.datum.text]: !c[item.datum.text] }))
          }
          setInfo({ datum: item.datum, x: event.clientX, y: event.clientY })
        }
      }
      view.addEventListener('click', handler)
    })
    return () => {
      if (view) {
        view.removeEventListener('click', handler)
      }
    }
  }, [collapsed])

  return (
    <div className="diagram-container">
      <h1>Fishbone Diagram</h1>
      <TransformWrapper>
        <MiniMap />
        <TransformComponent>
          <div ref={ref}></div>
        </TransformComponent>
      </TransformWrapper>
      {info && (
        <div className="info-box" style={{ left: info.x, top: info.y }}>
          <strong>{info.datum.text}</strong>
          {info.datum.raw?.status && <div>Status: {info.datum.raw.status}</div>}
          {info.datum.raw?.punkte && <div>Punkte: {info.datum.raw.punkte}</div>}
          {info.datum.raw?.prioritaet && <div>Priorität: {info.datum.raw.prioritaet}</div>}
          {info.datum.link && (
            <div>
              <a href={info.datum.link} target="_blank" rel="noreferrer">
                Link
              </a>
            </div>
          )}
          <button onClick={() => setInfo(null)}>Schließen</button>
        </div>
      )}
    </div>
  )
}

export default App
