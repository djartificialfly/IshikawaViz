import { useEffect, useRef, useState } from 'react'
import vegaEmbed from 'vega-embed'
import { TransformWrapper, TransformComponent, MiniMap, useControls } from 'react-zoom-pan-pinch'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import InboxIcon from '@mui/icons-material/MoveToInbox'
import MailIcon from '@mui/icons-material/Mail'
import MenuIcon from '@mui/icons-material/Menu'
import MapIcon from '@mui/icons-material/Map'
import data from './data/example.json'
import './App.css'

function generateSpec(d, collapsed = {}, width, height) {
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
    const x1 = baseX - 50
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

function ClickableMiniMap(props) {
  const { setTransform, instance } = useControls()

  const handleClick = e => {
    if (!instance.wrapperComponent || !instance.contentComponent) return

    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const contentRect = instance.contentComponent.getBoundingClientRect()
    const contentWidth = contentRect.width / instance.transformState.scale
    const contentHeight = contentRect.height / instance.transformState.scale
    const scaleX = (props.width || 200) / contentWidth
    const scaleY = (props.height || 200) / contentHeight
    const miniScale = scaleY > scaleX ? scaleX : scaleY

    const contentX = mx / miniScale
    const contentY = my / miniScale

    const wrapperWidth = instance.wrapperComponent.offsetWidth
    const wrapperHeight = instance.wrapperComponent.offsetHeight
    const newX = wrapperWidth / 2 - contentX * instance.transformState.scale
    const newY = wrapperHeight / 2 - contentY * instance.transformState.scale

    setTransform(newX, newY, instance.transformState.scale, 200, 'easeOut')
  }

  return <MiniMap {...props} onClick={handleClick} />
}

function App() {
  const ref = useRef(null)
  const viewRef = useRef(null)
  const [collapsed, setCollapsed] = useState({})
  const [info, setInfo] = useState(null)
  const infoRef = useRef(null)
  const [hoveringInfo, setHoveringInfo] = useState(false)
  const [infoSize, setInfoSize] = useState({ width: 0, height: 0 })
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [showMiniMap, setShowMiniMap] = useState(true)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const resizeHandler = () => {
      const header = 64
      const drawerWidth = drawerOpen ? 240 : 60
      setDimensions({
        width: window.innerWidth - drawerWidth,
        height: window.innerHeight - header,
      })
    }
    resizeHandler()
    window.addEventListener('resize', resizeHandler)
    return () => window.removeEventListener('resize', resizeHandler)
  }, [drawerOpen])

  useEffect(() => {
    if (infoRef.current) {
      const { offsetWidth, offsetHeight } = infoRef.current
      setInfoSize({ width: offsetWidth, height: offsetHeight })
    }
  }, [info])

  useEffect(() => {
    const spec = generateSpec(data, collapsed, dimensions.width, dimensions.height)
    if (ref.current) ref.current.innerHTML = ''
    let view
    let clickHandler
    let hoverHandler
    let mouseOutHandler
    vegaEmbed(ref.current, spec, { actions: false }).then(res => {
      view = res.view
      viewRef.current = view
      clickHandler = (event, item) => {
        if (item && item.datum && item.datum.type === 'category') {
          setCollapsed(c => ({ ...c, [item.datum.text]: !c[item.datum.text] }))
        }
      }
      hoverHandler = (event, item) => {
        if (item && item.datum) {
          setInfo({ datum: item.datum, x: event.clientX, y: event.clientY })
        } else {
          setInfo(null)
        }
      }
      view.addEventListener('click', clickHandler)
      view.addEventListener('mousemove', hoverHandler)
      mouseOutHandler = () => {
        if (!hoveringInfo) setInfo(null)
      }
      view.addEventListener('mouseout', mouseOutHandler)
    })
    return () => {
      if (view) {
        view.removeEventListener('click', clickHandler)
        view.removeEventListener('mousemove', hoverHandler)
        view.removeEventListener('mouseout', mouseOutHandler)
      }
    }
  }, [collapsed, dimensions, hoveringInfo])

  const drawerWidth = drawerOpen ? 240 : 60

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <IconButton color="inherit" onClick={() => setDrawerOpen(!drawerOpen)}>
            <MenuIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setShowMiniMap(!showMiniMap)}>
            <MapIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            overflowX: 'hidden',
          },
        }}
      >
        <Toolbar />
        <List>
          {['Item 1', 'Item 2', 'Item 3'].map((text, index) => (
            <ListItem button key={text}>
              <ListItemIcon>{index % 2 === 0 ? <InboxIcon /> : <MailIcon />}</ListItemIcon>
              <ListItemText primary={text} sx={{ opacity: drawerOpen ? 1 : 0 }} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        className="diagram-container"
        sx={{ flexGrow: 1, mt: '64px', position: 'relative', height: `calc(100vh - 64px)` }}
      >
        <TransformWrapper limitToBounds={false}>
          {showMiniMap && <ClickableMiniMap />}
          <TransformComponent>
            <div ref={ref}></div>
          </TransformComponent>
        </TransformWrapper>
        {info && (
          <div
            className="info-box"
            ref={infoRef}
            onMouseEnter={() => setHoveringInfo(true)}
            onMouseLeave={() => setHoveringInfo(false)}
            style={{
              left: Math.min(info.x, dimensions.width - infoSize.width - 10),
              top: Math.min(info.y, dimensions.height - infoSize.height - 10),
            }}
          >
            <strong>{info.datum.text}</strong>
            {info.datum.raw?.status && <div>Status: {info.datum.raw.status}</div>}
            {info.datum.raw?.punkte && <div>Punkte: {info.datum.raw.punkte}</div>}
            {info.datum.raw?.prioritaet && (
              <div>Priorität: {info.datum.raw.prioritaet}</div>
            )}
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
      </Box>
    </Box>
  )
}

export default App
