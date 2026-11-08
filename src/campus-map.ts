import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

let activeMap: L.Map | undefined
let lines: L.Polyline[] = []

const sites: L.LatLngTuple[] = [[290,140],[287,475],[107,405]]
const station: L.LatLngTuple = [124,125]

export function clearCampusMap() {
  if (activeMap) {

    activeMap.remove()
    activeMap = undefined
  }
}

const buildings = [
  '<path class="wall" d="M10 25h63v37H10z"/><path class="roof" d="m10 25 14-13h63L73 25z"/><path class="side" d="m73 25 14-13v37L73 62z"/><path class="window" d="M16 35h13v9H16z M55 35h13v9H55z"/><path fill="#ad473e" d="M40 31h5v18h-5z M34 37h17v5H34z"/><path fill="#41677a" d="M31 52h24v5H31z"/>',
  '<path class="wall" d="M8 34h70v29H8z"/><path fill="#a5593e" d="m4 35 18-20h65L78 35z"/><path class="side" d="m78 35 9-20v34l-9 14z"/><path class="window" d="M15 42h19v12H15z M42 42h28v12H42z"/><path fill="#faf0cd" d="M8 37h70v4H8z"/><path stroke="#987352" stroke-width="3" d="M13 70h25m10 0h24"/>',
  '<path class="wall" d="M10 17h66v48H10z"/><path class="roof" d="m10 17 13-10h66L76 17z"/><path class="side" d="m76 17 13-10v48L76 65z"/><path class="window" d="M17 25h11v7H17z M37 25h11v7H37z M58 25h11v7H58z M17 39h11v7H17z M37 39h11v7H37z M58 39h11v7H58z M17 53h11v7H17z M37 53h11v7H37z M58 53h11v7H58z"/>',
]
export function mountCampusMap(host: HTMLElement, evening = false, settled = false) {
  const bounds = L.latLngBounds([0,0],[390,610])
  const map = L.map(host, { crs: L.CRS.Simple, zoomSnap: .25, minZoom: -2, maxZoom: 1.5,
    attributionControl: false, zoomControl: false, scrollWheelZoom: false, maxBounds: bounds.pad(.35) })
  host.classList.toggle('evening',evening)
  L.control.zoom({position:'topright'}).addTo(map)
  activeMap = map
  const sidebar = 0
  map.fitBounds(bounds, { paddingTopLeft:[12,12], paddingBottomRight:[sidebar+12,48] })

  L.rectangle(bounds,{stroke:false,fillColor:evening?'#53605e':'#e1ecd9',fillOpacity:1}).addTo(map)
  const grass = (a:L.LatLngTuple,b:L.LatLngTuple) => L.rectangle([a,b],{color:'#a6c3a0',weight:1,fillColor:'#b6d9aa',fillOpacity:.63,interactive:false}).addTo(map)
  grass([41,190],[161,340]); grass([237,220],[351,383]); grass([38,465],[160,576])
  const road = (path:L.LatLngTuple[]) => {
    L.polyline(path,{color:'#bdc9c3',weight:18,interactive:false}).addTo(map)
    L.polyline(path,{color:'#fbfdfa',weight:15,interactive:false}).addTo(map)
  }
  road([[190,20],[190,585]])
  road([[25,177],[350,177],[350,565],[25,565]])
  for (const [y,x] of [[320,194],[308,207],[255,199],[223,399],[211,415],[220,432],[87,225],[67,250],[85,300],[62,510],[90,524],[104,545],[321,527],[315,545]]) {
    L.circleMarker([y,x],{radius:5,color:'#38594c',weight:1,fillColor:'#6b8e66',fillOpacity:1,interactive:false}).addTo(map)
  }
  L.rectangle([[249,237],[331,366]],{color:'#f1ead5',weight:2,fillColor:'#819671',fillOpacity:.9,interactive:false}).addTo(map)
  L.polyline([[290,237],[290,366]],{color:'#f1ead5',weight:1,interactive:false}).addTo(map)
  const paths: L.LatLngTuple[][] = [
    [station,[124,157],[290,157],sites[0]],
    [station,[124,157],[181,157],[181,475],sites[1]],
    [station,[107,125],sites[2]],
  ]
  lines = paths.map(path=>L.polyline(path,{weight:3,interactive:false}).addTo(map))
  function mark(point:L.LatLngTuple, html:string, anchor:L.PointTuple) {
    L.marker(point,{interactive:false,keyboard:false,icon:L.divIcon({className:'campus-marker',html,iconSize:undefined,iconAnchor:anchor})}).addTo(map)
  }
  mark(station,'<b class="map-label">变电站</b>',[28,15])
  const labels=['医院','食堂','宿舍']
  const roofs=['clinic','dining','dorm']
  sites.forEach((point,i)=>{
    mark(point,`<button type="button" class="site ${roofs[i]}" id="building-${i}" ${settled?'disabled':''} aria-pressed="false"><svg class="building-art" viewBox="0 0 96 76" aria-hidden="true"><ellipse cx="48" cy="66" rx="44" ry="7" fill="#21271f" opacity=".19"/>${buildings[i]}</svg><b>${labels[i]}</b><span></span></button>`,[44,37])
  })
}

export function showCampusPower(mask:number, loads:number[], overloaded:boolean, settled = false) {
  lines.forEach((line,i)=>{
    const selected=Boolean(mask & (1<<i))
    line.setStyle({color:selected ? (overloaded ? '#a52b21' : (settled?'#ffca69':'#26725b')) : '#6d7062',dashArray:selected ? undefined : '5 5'})
    const button=document.getElementById('building-'+i)
    button?.setAttribute('aria-pressed',String(selected))
    button?.classList.toggle('lit',settled && selected)
    if(button) button.querySelector('span')!.textContent=`${selected?(overloaded?'缺电':settled?'已供电':'待送电'):'停供'} · ${loads[i]} 格`
  })
}

