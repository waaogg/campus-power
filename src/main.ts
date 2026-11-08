import { clearCampusMap, mountCampusMap, showCampusPower } from './campus-map'
import './style.css'

const events = [
  ['错峰午餐',6,3,'云层正在变厚，下一轮最多发 4 格。'],
  ['阴天',4,4,'晚饭人多，下一轮食堂要 5 格。'],
  ['晚饭高峰',6,5,'晚自习快结束了，医院和宿舍合计要 8 格。'],
  ['晚自习结束',6,4,'清晨检修，下一轮最多发 5 格。'],
  ['清晨检修',5,4,'最后一轮，结算后查看值班报告。'],
] as const
const buildings = ['医院','食堂','宿舍']
const key = 'campus-power-v1'
type Record = { generation:number; used:number; end:number; drawn:number; spill:number; mask:number }
type Phase = 'dispatch'|'receipt'|'report'
let history: Record[] = []
let phase: Phase = 'dispatch'
let home = true
let warning = false
try {
  const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
  if (saved && Array.isArray(saved.history) && saved.history.length <= 5 &&
      ['dispatch','receipt','report'].includes(saved.phase) &&
      (saved.phase === 'dispatch' ? saved.history.length < 5 : saved.history.length > 0)) {
    history = saved.history
    phase = saved.phase
  }
} catch { /* Storage is optional. */ }
let generation = events[Math.min(history.length,4)][1] as number
let mask = 1
const app = document.querySelector<HTMLDivElement>('#app')!
function save() {
  try { sessionStorage.setItem(key,JSON.stringify({history,phase})) } catch { /* Play continues in memory. */ }
}
function reset() {
  history = []
  phase = 'dispatch'
  home = false
  warning = false
  generation = 6
  mask = 1
  save()
  render()
}
function render(focus?:string) {
  const round = phase === 'dispatch' ? history.length : Math.max(0,history.length-1)
  const [event, cap, dining, forecast] = events[round]
  const start = history[round-1]?.end ?? 0
  const loads = [3,dining,5]
  const used = loads.reduce((sum,load,index)=>sum+((mask & (1<<index)) ? load : 0),0)
  const row = history[round]
  const hospital = history.filter(entry=>entry.mask & 1).length
  const meals = history.filter((entry,index)=>(index===0 || index===2 || index===4) && (entry.mask & 2)).length
  const nights = history.filter((entry,index)=>index>=3 && (entry.mask & 4)).length
  const passed = hospital===5 && meals>0 && nights>0
  const missed = history.findIndex(entry=>!(entry.mask & 1))
  const goals = [Boolean(history[2]?.mask & 2),Boolean(history[3]?.mask & 4),Boolean(history[4]?.mask & 2)]
  const heading = '<header><span class="signal"></span> 校园电力调度站 <span class="edition">值班模拟 / 01</span></header>'
  let body:string
  if (home) {
    body = '<section class="hero"><div class="hero-copy"><p class="label">五轮校园供电挑战</p><h1>假如校园<br>只剩一半的电<span>。</span></h1><p>今晚由你值班。医院五轮都要亮灯，食堂至少保障一顿饭，宿舍至少保障一次夜间供电。</p><button id="start" class="primary">'+(history.length ? '继续值班' : '开始值班')+'</button>'+(history.length ? ' <button id="reset">重新开始</button>' : '')+'</div><div class="hero-map"><div id="campus-map"></div></div></section>'
  } else if (phase === 'dispatch') {
    body = `<main class="dispatch"><nav class="rounds" aria-label="五轮进度"><span>01 午餐</span><span>02 阴天</span><span>03 晚饭</span><span>04 夜间</span><span>05 清晨</span></nav><div class="event-card"><section class="event"><p class="label">第 ${round+1} / 5 轮</p><h1 tabindex="-1" id="title">${event}</h1><p>${forecast}</p><p class="round-note">${round===0||round===2||round===4?'本轮可完成食堂饭点保障。':'本轮食堂属于普通时段。'} ${round>=3?'本轮可完成宿舍夜间保障。':'宿舍夜间保障从第 4 轮开始。'}</p></section>
    <div class="service" aria-label="保障目标"><span>医院 ${hospital}/5 轮</span><span>食堂饭点 ${meals?'已保障':'待保障'}</span><span>宿舍夜间 ${nights?'已保障':'待保障'}</span></div></div>
    <figure class="map-sheet"><figcaption class="map-instructions">校园地图 · 点选建筑安排供电</figcaption><div id="campus-map" aria-label="校园配电地图"></div><div class="legend">实线 · 计划送电　虚线 · 停供　红线 · 电量不足</div></figure>
    <section class="console"><label for="generation">发电量 <output id="output">${generation}</output> / ${cap} 格</label><input id="generation" type="range" min="0" max="${cap}" step="1" value="${generation}">
    <div class="meters"><span>期初储能 <b>${start}</b> / 3 格</span><span>计划用电 <b id="used">${used}</b> 格</span><span id="balance" role="status"></span></div>
    <button class="primary" id="confirm">确认供电</button>
    ${warning?'<div class="warning" role="alert">本轮医院将停电，本局无法达成五轮连续供电。 <button id="cancel">返回调整</button> <button id="proceed">确认医院停电</button></div>':''}
    </section></main>`
  } else if (phase === 'receipt') {
    const egg = round===3 && (row.mask & 4) ? '宿管留言「灯亮了，热水器排队也是包的。」' : ''
    const zero = row.end===0 && history.findIndex(entry=>entry.end===0)===round ? '调度员手记「就这么水灵灵地用到 0 格了。」' : ''
    body = `<section class="panel"><p class="label">第 ${round+1} / 5 轮 · 已结算</p><h1 id="title" tabindex="-1">本轮回执</h1>
      <figure class="map-sheet"><figcaption>本轮供电实况</figcaption><div id="campus-map" aria-label="已结算的校园供电地图"></div></figure><p>${buildings.map((name,index)=>name+((row.mask & (1<<index))?'已供电':'停电')).join(' · ')}</p>
      <dl>${[['发电',row.generation],['用电',row.used],['动用存电',row.drawn],['期末储能',row.end],['未存下的电量',row.spill]].map(([name,value])=>`<div><dt>${name}</dt><dd>${value} 格</dd></div>`).join('')}</dl>
      ${[egg,zero].filter(Boolean).map(line=>`<p class="egg">${line}</p>`).join('')}
      <button id="next" class="primary">${round===4?'查看值班报告':'下一轮'}</button></section>`
  } else {
    body = `<section class="panel"><p class="label">五轮值班结束</p><h1 id="title" tabindex="-1">值班报告</h1><p class="result">${passed?'通关':'未通关'} · 医院供电 ${hospital}/5${missed>=0?' · 首次断电在第 '+(missed+1)+' 轮':''}</p>
    <p>基本保障 · 食堂饭点 ${meals?'已完成':'未完成'} · 宿舍夜间 ${nights?'已完成':'未完成'}</p><ul class="goals">${['晚饭供电','宿舍供电','早餐供电'].map((name,index)=>`<li>${name} <b>${goals[index]?'已完成':'未完成'}</b></li>`).join('')}</ul>
    ${passed && goals[0] && goals[2]?'<p class="egg">校园电量管家 · 晚饭和早餐都安排上了。</p>':''}
    <table><caption>五轮供电记录 · 电量单位为格</caption><thead><tr><th scope="col">轮</th><th scope="col">供电建筑</th><th scope="col">发电</th><th scope="col">用电</th><th scope="col">存电</th></tr></thead><tbody>${history.map((entry,index)=>`<tr><th scope="row">${index+1}</th><td>${buildings.filter((_,bit)=>entry.mask & (1<<bit)).join('、') || '全部停电'}</td><td>${entry.generation}</td><td>${entry.used}</td><td>${entry.end}</td></tr>`).join('')}</tbody></table>
    <p>复盘题 · 如果下一轮会少发 1 格，你会改掉哪一次供电决定？</p><button class="primary" id="reset">再值一班</button></section>`
  }
  clearCampusMap()
  app.innerHTML = heading+body+'<footer>校园供电课堂实验 · 模拟电量以「格」计</footer>'
  const click = (id:string, action:()=>void)=>document.getElementById(id)?.addEventListener('click',action)
  click('start',()=>{home=false;save();render('title')})
  click('reset',reset)
  click('next',()=>{
    if(phase!=='receipt')return
    phase = history.length===5?'report':'dispatch'
    if(phase==='dispatch'){generation=events[history.length][1];mask=1}
    save();render('title')
  })
  if (home) { mountCampusMap(document.getElementById('campus-map')!,false,true); showCampusPower(7,[3,4,5],false,true) }
  if (!home && phase==='receipt') {
    mountCampusMap(document.getElementById('campus-map')!,round===3,true)
    showCampusPower(row.mask,loads,false,true)
  }
  if(!home && phase==='dispatch'){
    mountCampusMap(document.getElementById('campus-map')!,round===3)
    const update = ()=>{
      const total = loads.reduce((sum,load,index)=>sum+((mask & (1<<index))?load:0),0)
      const remaining = generation+start-total
      document.getElementById('output')!.textContent=String(generation)
      document.getElementById('used')!.textContent=String(total)
      document.getElementById('balance')!.textContent=remaining<0?`还差 ${-remaining} 格`:`预计储能 ${Math.min(3,remaining)} / 3 格${total>generation?' · 动用存电 '+(total-generation)+' 格':''}`
      showCampusPower(mask,loads,remaining<0)
      ;(document.getElementById('confirm') as HTMLButtonElement).disabled=remaining<0
    }
    update()
    document.getElementById('generation')!.addEventListener('input',event=>{generation=Number((event.target as HTMLInputElement).value);update()})
    buildings.forEach((_,index)=>click('building-'+index,()=>{mask^=1<<index;if(warning){warning=false;render('building-'+index)}else update()}))
    const settle=()=>{
      if(phase!=='dispatch')return
      const demand=loads.reduce((sum,load,index)=>sum+((mask & (1<<index))?load:0),0)
      const remaining=generation+start-demand
      if(remaining<0)return
      history.push({generation,used:demand,end:Math.min(3,remaining),drawn:Math.max(0,demand-generation),spill:Math.max(0,remaining-3),mask})
      phase='receipt';warning=false;save();render('title')
    }
    click('confirm',()=>{if(mask & 1)settle();else{warning=true;render('cancel')}})
    click('cancel',()=>{warning=false;render('confirm')})
    click('proceed',settle)
  }
  if(focus)document.getElementById(focus)?.focus()
}
render()

