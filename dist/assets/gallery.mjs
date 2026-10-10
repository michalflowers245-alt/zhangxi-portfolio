// Progressive enhancement: native figures and links remain usable without this module.
import { restoreReadingFocus } from './reading-state.mjs?v=67253512da1cc3a2';
export function initGalleries(signal) {
  const controllers = new Map();
  const dialog = document.querySelector('.lightbox');
  const modalImage = dialog?.querySelector('[data-lightbox-image]');
  const modalError = dialog?.querySelector('.lightbox-error');
  const modalArea = dialog?.querySelector('.lightbox-image-area');
  const fitButton = dialog?.querySelector('[data-lightbox-fit]');
  const modeButtons = [...(dialog?.querySelectorAll('[data-lightbox-mode]') || [])];
  const focusButton = dialog?.querySelector('[data-lightbox-focus]');
  const focusNote = dialog?.querySelector('[data-lightbox-focus-note]');
  let focusRegion=null;
  let actualCenter=null;
  const compactImage=matchMedia('(max-width: 600px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null, trigger = null, originY = 0, previousOverflow = '';
  let openingAnimation = null;
  let modalRevision = 0;
  const on = (el,type,fn,options={}) => el?.addEventListener(type,fn,{...options,signal});
  function isPlainImageClick(event){
    const link=event.currentTarget;
    return !event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!link.hasAttribute('download')&&(!link.target||link.target.toLowerCase()==='_self');
  }
  function cancelOpening(){openingAnimation?.cancel();openingAnimation=null;}
  on(reduced,'change',()=>{if(reduced.matches)cancelOpening();});
  signal.addEventListener('abort',cancelOpening,{once:true});

  function hideModalError(){
    // Move focus before hiding its retry button; do not disturb a newer action.
    if(dialog.open&&modalError.contains(document.activeElement))modalArea.focus({preventScroll:true});
    modalError.hidden=true;
  }

  function renderModal() {
    if (!active) return;
    modalRevision++;
    const slide=active.slides[active.index], img=slide.querySelector('img');
    hideModalError();
    modalImage.src=slide.querySelector('[data-lightbox]').href; modalImage.alt=img.alt;
    // img.width is its rendered preview size, not the factual image dimensions.
    modalImage.width=Number(img.getAttribute('width'));
    modalImage.height=Number(img.getAttribute('height'));
    modalImage.style.setProperty('--image-width',`${modalImage.width}px`);
    dialog.dataset.imageKind=slide.dataset.kind;
    focusRegion=readFocus(slide);
    setZoom(false);
    dialog.querySelector('[data-lightbox-caption]').textContent=slide.querySelector('figcaption').textContent;
    dialog.querySelector('[data-lightbox-count]').textContent=`${active.index+1} / ${active.slides.length}`;
    dialog.querySelector('[data-lightbox-prev]').disabled=active.index===0;
    dialog.querySelector('[data-lightbox-next]').disabled=active.index===active.slides.length-1;
  }
  function syncModeControls() {
    // These are explicit modes, not toggles whose labels change meaning.
    // A focus-only control must not disappear while still owning focus.
    if(!focusRegion&&document.activeElement===focusButton)fitButton.focus({preventScroll:true});
    focusButton.hidden=!focusRegion;
    for(const button of modeButtons)button.setAttribute('aria-pressed',String(button.dataset.lightboxMode===dialog.dataset.zoom));
    modalArea.setAttribute('aria-label',dialog.dataset.zoom==='actual'
      ? '原尺寸图片，可横向、纵向滚动查看'
      : dialog.dataset.zoom==='focus' ? '图片重点区域' : '完整原图，按窗口显示');
  }
  function setZoom(actual) {
    // Preserve the region the reader was examining when entering native scale.
    const center=actual&&dialog.dataset.zoom==='focus'&&focusRegion
      ? {x:focusRegion.x+focusRegion.width/2,y:focusRegion.y+focusRegion.height/2} : null;
    actualCenter=center;
    for(const prop of ['width','height','left','top','clip-path'])modalImage.style.removeProperty(prop);
    dialog.dataset.zoom=actual?'actual':'fit';
    syncModeControls();
    focusNote.textContent=actual?'原尺寸 · 可横向、纵向滚动查看':'完整原图 · 按窗口显示';
    focusNote.hidden=false;
    modalArea.scrollTo({left:0,top:0,behavior:'instant'});
    if(center){
      centerActualImage();
    }
  }
  function readFocus(slide){
    const data=(compactImage.matches&&slide?.dataset.focusMobile)||slide?.dataset.focus;
    return data?JSON.parse(data):null;
  }
  function centerActualImage(){
    if(!actualCenter||!dialog.open||dialog.dataset.zoom!=='actual')return;
    modalArea.scrollTo({left:actualCenter.x*modalImage.width-modalArea.clientWidth/2,top:actualCenter.y*modalImage.height-modalArea.clientHeight/2,behavior:'instant'});
  }
  // A late full-resolution image load may adjust the center, but never after
  // the reader starts panning, typing or pointing somewhere else.
  for(const type of ['wheel','touchstart','pointerdown','keydown'])on(modalArea,type,()=>{actualCenter=null;},{passive:true});
  on(compactImage,'change',()=>{
    if(!active)return;
    focusRegion=readFocus(active.slides[active.index]);
    if(dialog.dataset.zoom==='focus')focusDetail();
  });
  // A viewport onto the exact original pixels; never a redrawn or exported crop.
  function layoutFocus(){
    if(!dialog.open||dialog.dataset.zoom!=='focus'||!focusRegion||!active)return;
    const image=active.slides[active.index].querySelector('img');
    const width=Number(image.getAttribute('width')),height=Number(image.getAttribute('height'));
    const {x,y,width:w,height:h}=focusRegion;
    dialog.dataset.focusLayout=(width*w)/(height*h)>1.2?'wide':'tall';
    const areaWidth=modalArea.clientWidth,areaHeight=modalArea.clientHeight;
    const scale=Math.min(areaWidth/(width*w),areaHeight/(height*h),1);
    modalImage.style.width=`${width*scale}px`;modalImage.style.height=`${height*scale}px`;
    modalImage.style.left=`${(areaWidth-width*w*scale)/2-x*width*scale}px`;
    modalImage.style.top=`${(areaHeight-height*h*scale)/2-y*height*scale}px`;
    modalImage.style.clipPath=`inset(${y*100}% ${(1-x-w)*100}% ${(1-y-h)*100}% ${x*100}%)`;
    // A detail viewport is not pannable; error-button focus must not offset it.
    modalArea.scrollTo({left:0,top:0,behavior:'instant'});
  }
  function focusDetail(){
    if(!focusRegion)return;
    setZoom(false);dialog.dataset.zoom='focus';
    syncModeControls();
    focusNote.textContent=`重点区域 · ${focusRegion.label}`;
    focusNote.hidden=false;layoutFocus();
  }
  function open(controller, source) {
    if (!dialog?.showModal) return false;
    if(dialog.open)return true;
    cancelOpening();
    active=controller; trigger=source; originY=scrollY;
    previousOverflow=document.documentElement.style.overflow;
    renderModal(); dialog.showModal();
    document.documentElement.style.overflow='hidden';
    document.body.classList.add('is-lightbox-open');
    dialog.querySelector('[data-lightbox-close]').focus();
    if(!reduced.matches&&typeof dialog.animate==='function'){
      openingAnimation=dialog.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
      const animation=openingAnimation;
      animation.addEventListener('finish',()=>{if(openingAnimation===animation)openingAnimation=null;},{once:true});
    }
    return true;
  }
  function finishClose(){
    if(dialog.open||!active)return;
    modalRevision++;
    actualCenter=null;
    cancelOpening();
    document.documentElement.style.overflow=previousOverflow;
    document.body.classList.remove('is-lightbox-open');
    window.scrollTo({top:originY,behavior:'instant'});
    restoreReadingFocus(trigger);active=null;trigger=null;
    window.dispatchEvent(new Event('gallery:closed'));
  }
  function close() {
    if(!dialog?.open)return;
    cancelOpening();
    // Native dialog focus restoration runs before the asynchronous close event.
    // Mark the trigger first so that it cannot be mistaken for keyboard entry.
    trigger?.setAttribute('data-reading-focus-restore','');
    dialog.close();
    // Do not wait for the queued close event to unlock the page. A rapid reopen
    // must not be cleared by a close event belonging to the previous opening.
    finishClose();
  }
  on(dialog,'close',finishClose);
  on(dialog?.querySelector('[data-lightbox-close]'),'click',close);
  on(dialog,'cancel',event=>{event.preventDefault();close();});
  on(dialog,'click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  on(dialog?.querySelector('[data-lightbox-prev]'),'click',()=>{active.select(active.index-1);renderModal();});
  on(dialog?.querySelector('[data-lightbox-next]'),'click',()=>{active.select(active.index+1);renderModal();});
  for(const button of modeButtons)on(button,'click',()=>{
    const mode=button.dataset.lightboxMode;
    // Reselecting the active mode must not reset the reader's native-size pan.
    if(mode===dialog.dataset.zoom)return;
    if(mode==='focus')focusDetail();else setZoom(mode==='actual');
  });
  const focusObserver=new ResizeObserver(layoutFocus);
  if(modalArea)focusObserver.observe(modalArea);
  signal.addEventListener('abort',()=>focusObserver.disconnect(),{once:true});
  on(dialog,'keydown',event=>{
    if(event.target===modalArea&&dialog.dataset.zoom==='actual')return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();active.select(active.index+(event.key==='ArrowRight'?1:-1));renderModal();}
  });
  on(modalImage,'error',()=>{if(active)modalError.hidden=false;});
  on(modalImage,'load',()=>{hideModalError();modalImage.width=modalImage.naturalWidth;modalImage.height=modalImage.naturalHeight;modalImage.style.setProperty('--image-width',`${modalImage.naturalWidth}px`);layoutFocus();centerActualImage();});
  on(dialog?.querySelector('[data-lightbox-retry]'),'click',()=>{
    if(!active||!dialog.open)return;
    const src=modalImage.src,revision=++modalRevision;
    hideModalError();modalImage.removeAttribute('src');
    requestAnimationFrame(()=>{
      // A pending retry must not replace the next image or a newly opened gallery.
      if(!signal.aborted&&dialog.open&&active&&revision===modalRevision)modalImage.src=src;
    });
  });

  document.querySelectorAll('[data-gallery]').forEach(root=>{
    const track=root.querySelector('.gallery-track'), slides=[...root.querySelectorAll('.gallery-slide')];
    const previous=root.querySelector('[data-previous]'), next=root.querySelector('[data-next]');
    const thumbs=[...root.querySelectorAll('[data-image-select]')];
    const focusEntry=root.querySelector('.gallery-focus-entry');
    function syncFocusLabel(){
      if(!focusEntry)return;
      const focus=readFocus(slides[index]);
      focusEntry.hidden=!focus;
      if(focus)focusEntry.querySelector('[data-focus-label]').textContent=focus.label;
    }
    on(compactImage,'change',syncFocusLabel);
    function fitTrack(){
      if(root.classList.contains('gallery-detail')){
        root.style.setProperty('--gallery-height',`${slides[index].offsetHeight}px`);
        if(track.scrollTop)track.scrollTop=0;
      }
    }
    let index=0, frame=0, syncedIndex=-1;
    const controller={root,slides,get index(){return index;},get imageId(){return slides[index].dataset.imageId;},select(value){
      const n=typeof value==='string'?slides.findIndex(s=>s.dataset.imageId===value):value;
      if(n<0)return;
      const target=Math.max(0,Math.min(slides.length-1,n));
      track.scrollTo({left:slides[target].offsetLeft,behavior:'instant'}); sync();
    }};
    function sync(){
      frame=0;
      index=slides.reduce((best,s,i)=>Math.abs(s.offsetLeft-track.scrollLeft)<Math.abs(slides[best].offsetLeft-track.scrollLeft)?i:best,0);
      if(index===syncedIndex)return;
      syncedIndex=index;
      previous.disabled=index===0; next.disabled=index===slides.length-1;
      root.querySelector('[data-gallery-count]').textContent=`${index+1} / ${slides.length}`;
      root.dataset.currentImage=slides[index].dataset.imageId;
      syncFocusLabel();
      fitTrack();
      thumbs.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      // Keep the selected thumbnail in its own strip without moving page scroll.
      const thumbnail=thumbs[index], strip=thumbnail?.parentElement;
      if(strip){
        const item=thumbnail.getBoundingClientRect(), bounds=strip.getBoundingClientRect();
        if(item.left<bounds.left+4)strip.scrollLeft-=bounds.left+4-item.left;
        else if(item.right>bounds.right-4)strip.scrollLeft+=item.right-bounds.right+4;
      }
      // Offscreen slides remain in the document. Their links are skipped only while enhanced.
      slides.forEach((slide,i)=>{for(const target of slide.querySelectorAll('a,button'))target.tabIndex=i===index?0:-1;});
      root.dispatchEvent(new CustomEvent('gallery:change',{bubbles:true}));
    }
    on(track,'scroll',()=>{if(!frame)frame=requestAnimationFrame(sync);},{passive:true});
    on(previous,'click',()=>controller.select(index-1));
    on(next,'click',()=>controller.select(index+1));
    thumbs.forEach((button,i)=>on(button,'click',()=>controller.select(i)));
    on(root.querySelector('[data-enlarge]'),'click',event=>open(controller,event.currentTarget));
    slides.forEach((slide,i)=>{
      const img=slide.querySelector('img'), error=slide.querySelector('.media-error');
      const fail=()=>{error.hidden=false;slide.dataset.loadState='error';};
      on(img,'error',fail);
      on(img,'load',()=>{error.hidden=true;slide.dataset.loadState='loaded';fitTrack();});
      if(img.complete&&!img.naturalWidth)fail();
      on(slide.querySelector('[data-retry]'),'click',()=>{
        error.hidden=true;slide.dataset.loadState='loading';
        const src=img.getAttribute('src'),srcset=img.getAttribute('srcset');
        img.removeAttribute('srcset');img.removeAttribute('src');
        requestAnimationFrame(()=>{if(srcset)img.setAttribute('srcset',srcset);img.src=src;});
      });
      on(slide.querySelector('[data-lightbox]'),'click',event=>{
        if(!isPlainImageClick(event))return;
        controller.select(i);if(open(controller,event.currentTarget))event.preventDefault();
      });
    });
    root.querySelector('.gallery-controls').hidden=false;
    if(slides.length===1){previous.hidden=true;next.hidden=true;}
    if(root.querySelector('.gallery-thumbs'))root.querySelector('.gallery-thumbs').hidden=false;
    root.dataset.enhanced='true';
    const observer=new ResizeObserver(()=>{track.scrollTo({left:slides[index].offsetLeft,behavior:'instant'});fitTrack();});
    observer.observe(track);slides.forEach(slide=>observer.observe(slide));
    signal.addEventListener('abort',()=>{observer.disconnect();cancelAnimationFrame(frame);},{once:true});
    controllers.set(root.dataset.gallery,controller); sync();
  });
  // Case introductions may point into the one existing gallery. They are real
  // original-image links first, not a second hidden track or selection state.
  document.querySelectorAll('a[data-gallery-preview][data-gallery-image]').forEach(link=>{
    on(link,'click',event=>{
      if(!isPlainImageClick(event)||!dialog?.showModal)return;
      const controller=controllers.get(link.dataset.galleryPreview);
      const slide=controller?.slides.find(item=>item.dataset.imageId===link.dataset.galleryImage);
      if(!slide||slide.querySelector('[data-lightbox]').href!==link.href)return;
      controller.select(link.dataset.galleryImage);
      if(open(controller,link))event.preventDefault();
    });
  });
  return controllers;
}
