export function initFolio(signal) {
  const root=document.querySelector('[data-folio]');
  if(!root)return null;
  const sheets=[...root.querySelectorAll('.folio-sheet')], panels=sheets.map(s=>s.querySelector('.folio-panel'));
  const anchors=[...root.querySelectorAll('.folio-anchor')], links=[...root.querySelectorAll('.folio-index a')];
  const toolbar=root.querySelector('.folio-toolbar'), header=document.querySelector('.site-header');
  const countLabel=root.querySelector('[data-folio-count]'),titleLabel=root.querySelector('[data-folio-title]');
  const titles=sheets.map(sheet=>sheet.querySelector('h3').textContent);
  let renderedIndex=-1;
  const scrollRoot=document.documentElement, initialScrollPadding=scrollRoot.style.scrollPaddingTop;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let metrics=[],top=146,frame=0,measureFrame=0,resumeFrame=0,paused=false,keyboard=false,current=0,zone=null;
  const on=(el,type,fn,options={})=>el?.addEventListener(type,fn,{...options,signal});
  function update(){
    frame=0;if(paused||document.hidden||!metrics.length)return;
    const position=scrollY+top+2;
    const nextZone=position<metrics[0].y-innerHeight?'before':position>metrics.at(-1).y+metrics.at(-1).height?'after':'inside';
    if(nextZone!=='inside'&&nextZone===zone)return;
    zone=nextZone;
    current=Math.max(0,metrics.findLastIndex(m=>m.y<=position));
    if(renderedIndex!==current){
      renderedIndex=current;
      root.dataset.currentProject=sheets[current].dataset.project;
      countLabel.textContent=`${String(current+1).padStart(2,'0')} / ${String(sheets.length).padStart(2,'0')}`;
      titleLabel.textContent=titles[current];
      links.forEach((a,i)=>{if(i===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    }
    panels.forEach((panel,i)=>{
      if(root.dataset.stack!=='on'){if(panel.style.transform)panel.style.removeProperty('transform');return;}
      const following=metrics[i+1];
      const progress=following?Math.max(0,Math.min(1,(position+metrics[i].height-following.y)/metrics[i].height)):0;
      const transform=progress?`scale(${1-progress*.02})`:'';
      if(panel.style.transform!==transform)panel.style.transform=transform;
    });
  }
  function measure({preservePosition=false}={}){
    measureFrame=0;if(paused||document.hidden||document.querySelector('.lightbox[open]'))return;
    const oldMode=root.dataset.stack, oldVisible=sheets[current]?.getBoundingClientRect().top;
    const headerHeight=header.getBoundingClientRect().height;
    const stickyTop=headerHeight+toolbar.getBoundingClientRect().height+18;
    const heights=panels.map(p=>p.offsetHeight);
    const canStack=innerWidth>=1024&&!keyboard&&!reduced.matches&&heights.every(h=>h<=innerHeight-stickyTop-24);
    const keepToolbar=keyboard&&innerWidth>=1024&&stickyTop<innerHeight/2;
    root.dataset.stack=canStack?'on':'off';
    top=canStack||keepToolbar?stickyTop:headerHeight+16;
    root.style.setProperty('--folio-top',`${top}px`);
    toolbar.style.top=`${headerHeight}px`;
    toolbar.style.position=keepToolbar?'sticky':'';
    toolbar.style.zIndex=keepToolbar?'12':'';
    // Native Tab scrolling must not try to move an already-visible sticky index
    // below the generic anchor padding (90px); use its actual header clearance.
    scrollRoot.style.scrollPaddingTop=keepToolbar?`${headerHeight+8}px`:initialScrollPadding;
    // Keep a focused desktop index in view while its cards become normal flow.
    // Narrow/reduced-height fallbacks use a shorter reading offset instead.
    if(!preservePosition&&oldMode==='on'&&!canStack&&oldVisible>=headerHeight&&oldVisible<innerHeight&&current>0){
      const delta=sheets[current].getBoundingClientRect().top-top;
      if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
    }
    metrics=anchors.map((a,i)=>({y:a.getBoundingClientRect().top+scrollY,height:heights[i]}));
    zone=null;update();
  }
  function queueMeasure(){if(!paused&&!document.hidden&&!measureFrame)measureFrame=requestAnimationFrame(()=>measure());}
  function suspend(){
    paused=true;
    cancelAnimationFrame(frame);cancelAnimationFrame(measureFrame);cancelAnimationFrame(resumeFrame);
    frame=0;measureFrame=0;resumeFrame=0;
  }
  function resume(){
    suspend();
    // BFCache/visibility transitions can temporarily change media-query matches.
    // Do not treat that transient preference as a reader-requested fallback.
    resumeFrame=requestAnimationFrame(()=>{
      resumeFrame=requestAnimationFrame(()=>{
        resumeFrame=0;if(document.hidden)return;
        paused=false;measure({preservePosition:true});
      });
    });
  }
  on(window,'scroll',()=>{if(!frame)frame=requestAnimationFrame(update);},{passive:true});
  on(window,'resize',queueMeasure,{passive:true});on(window.visualViewport,'resize',queueMeasure,{passive:true});
  on(reduced,'change',queueMeasure);on(window,'gallery:closed',queueMeasure);
  on(document,'visibilitychange',()=>{if(document.hidden)suspend();else resume();});
  on(window,'pagehide',suspend);
  on(document,'keydown',event=>{
    if(event.key==='Tab'&&!document.querySelector('.lightbox[open]')){keyboard=true;measure();}
  },{capture:true});
  on(root,'focusin',event=>{
    if(event.target.hasAttribute('data-reading-focus-restore'))return;
    if(event.target.matches(':focus-visible')&&!keyboard){keyboard=true;measure();}
    if(event.target.matches(':focus-visible'))requestAnimationFrame(()=>{
      const r=event.target.getBoundingClientRect();
      if(r.top<header.offsetHeight+8||r.bottom>innerHeight-8)event.target.scrollIntoView({block:'center',behavior:'instant'});
    });
  });
  links.forEach((link,i)=>on(link,'click',event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(location.hash!==link.hash){
      window.dispatchEvent(new Event('reading:checkpoint'));
      history.pushState(null,'',link.hash);
      window.dispatchEvent(new Event('reading:new-entry'));
    }
    window.scrollTo({top:metrics[i].y-top,behavior:'instant'});update();
  }));
  const observer=new ResizeObserver(queueMeasure);panels.forEach(p=>observer.observe(p));observer.observe(header);observer.observe(toolbar);
  document.fonts?.ready.then(queueMeasure);on(window,'pageshow',resume);
  signal.addEventListener('abort',()=>{observer.disconnect();suspend();scrollRoot.style.scrollPaddingTop=initialScrollPadding;},{once:true});
  measure();
  return {measure,suspend, get keyboard(){return keyboard;}, get current(){return sheets[current].dataset.project;}};
}
