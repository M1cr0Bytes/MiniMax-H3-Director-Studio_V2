import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// This extension is ONLY for the H3 Director Studio node. It does not patch
// Motion Context, samplers, models, reference loaders, or installed custom nodes.
const TYPE = 'H3DirectorStudioV1';
const ID = { resolution: 73, baseSteps: 71, upscaleSteps: 135,
             upscaler: 101, baseSampler: 58, upscaleSampler: 136,
             seed: 63, chain: 150, load: 148, save: 149,
             preview: 173, final: 115 };
const HEADER = /^[ \t]*\[\s*SEGMENT\s+(\d+)\s*\][ \t]*$/gim;
const $ = (tag, css={}, txt=null) => {
  const el = document.createElement(tag);
  Object.assign(el.style, css);
  if (txt !== null) el.textContent = txt;
  return el;
};
const colors = {
  bg:'var(--h3-bg, #252c34)', panel:'var(--h3-card, #303946)',
  field:'var(--h3-field, #191f26)', line:'var(--h3-line, #525d6b)',
  fg:'var(--h3-fg, #f1f3f6)', sub:'var(--h3-sub, #abb7c5)',
  warn:'#ffd386', green:'#96e1ae'
};
const parseColor=(v)=>{
  const str=String(v??'').trim();
  if(/^#[0-9a-f]{3}$/i.test(str))return [1,2,3].map(i=>parseInt(str[i]+str[i],16));
  if(/^#[0-9a-f]{6}$/i.test(str))return [1,3,5].map(i=>parseInt(str.slice(i,i+2),16));
  const m=str.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
  return m?[m[1],m[2],m[3]].map(Number):null;
};
const mix=(a,b,t)=>`rgb(${a.map((v,i)=>Math.round(v*(1-t)+b[i]*t)).join(', ')})`;
function updateTheme(node,panel){
  // The custom HTML is not part of ComfyUI's built-in node painting.
  // Synchronize CSS properties when the native node palette changes.
  const key=`${node.bgcolor||''}|${node.color||''}`;
  if(panel.__h3ColorKey===key)return;
  panel.__h3ColorKey=key;
  const base=parseColor(node.bgcolor)||parseColor(node.color)||[37,44,52];
  const light=(base[0]*299+base[1]*587+base[2]*114)/1000>158;
  const other=light?[0,0,0]:[255,255,255];
  panel.style.setProperty('--h3-bg',mix(base,base,0));
  panel.style.setProperty('--h3-card',mix(base,other,light?0.045:0.095));
  panel.style.setProperty('--h3-field',mix(base,light?[255,255,255]:[0,0,0],light?0.18:0.30));
  panel.style.setProperty('--h3-button',mix(base,other,light?0.08:0.15));
  panel.style.setProperty('--h3-line',mix(base,other,light?0.28:0.34));
  panel.style.setProperty('--h3-fg',light?'#131820':'#f1f3f6');
  panel.style.setProperty('--h3-sub',light?'#424b57':'#bdc8d5');
}
// Keep the three output sockets usable but out of LiteGraph's default slot-flow,
// which otherwise reserves ~140px of empty header above the DOM panel.
function anchorOutputs(node){
  const width=node.size?.[0]??1050;
  node.outputs?.forEach((slot,i)=>{
    const pos=[width+1,45+i*22];
    if(!Array.isArray(slot.pos)||slot.pos[0]!==pos[0]||slot.pos[1]!==pos[1])slot.pos=pos;
  });
}
const S = {
  btn: {background:'var(--h3-button, #334454)',border:`1px solid ${colors.line}`,color:colors.fg,
    borderRadius:'5px',fontSize:'12px',padding:'6px 9px',cursor:'pointer'},
  input: {width:'100%',boxSizing:'border-box',minWidth:'0',padding:'6px 8px',
    borderRadius:'5px',background:colors.field,color:colors.fg,border:`1px solid ${colors.line}`,fontSize:'13px'},
  text: {width:'100%',boxSizing:'border-box',resize:'vertical',padding:'8px',
    background:colors.field,color:colors.fg,border:`1px solid ${colors.line}`,
    borderRadius:'5px',font:'13px/1.5 sans-serif'},
  caption: {fontSize:'11px',color:colors.sub},
};
function decode(raw) {
  const text = String(raw ?? '');
  const matches = [...text.matchAll(HEADER)];
  if (!matches.length || text.slice(0,matches[0].index).trim()) return null;
  const shots=[];
  for (let i=0;i<matches.length;i++) {
    if (Number(matches[i][1]) !== i+1) return null;
    const end = i+1<matches.length ? matches[i+1].index:text.length;
    shots.push(text.slice(matches[i].index+matches[i][0].length,end).trim());
  }
  return shots;
}
const encode = shots => shots.map((shot,i)=>`[SEGMENT ${i+1}]\n${shot??''}`).join('\n\n');
// Technical nodes are no longer in the canvas: virtual read/write adapters map
// the original Studio UI to persistent widgets on the integrated Director.
function widget(node,name,idx=null) {
  if (!node) return null;
  return node.widgets?.find(w=>w.name===name) ?? (idx===null?null:node.widgets?.[idx]) ?? null;
}
const button=(name, onclick, parent, style={})=>{
  const b=$('button',{...S.btn,...style},name);
  b.type='button'; b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onclick();});
  parent.append(b); return b;
};
const label=(name)=>$('div',{fontSize:'12px',color:colors.sub,marginBottom:'3px'},name);
function item(parent,name,control) {
  const box=$('div',{flex:'1 1 140px',minWidth:'115px'});
  box.append(label(name),control);parent.append(box);return box;
}
function line(parent) { parent.append($('div',{height:'1px',background:colors.line,margin:'8px 0'})); }
function headline(parent,title) {parent.append($('div',{color:colors.fg,fontSize:'14px',fontWeight:'bold',margin:'7px 0 6px'},title));}
const row=parent=>{const r=$('div',{display:'flex',gap:'9px',flexWrap:'wrap',alignItems:'end'});parent.append(r);return r;};
function input(type,min,max,step) {
  const el=$('input',S.input);el.type=type;
  if(min!=null)el.min=String(min);if(max!=null)el.max=String(max);
  if(step!=null)el.step=String(step);return el;
}
function select(options) {
  const el=$('select',S.input);
  for(const [value,text] of options) { const op=$('option',{},text);op.value=value;el.append(op); }
  return el;
}
function heading(parent,text) {parent.append($('div',{fontSize:'17px',fontWeight:'700',color:colors.fg},text));}
function mirror(node) {
  if (node.__h3studio) return;
  // Keep virtual controls local to this Director. Other workflow tabs can
  // contain another Director with the same virtual IDs.
  const studioVirtualNodes=new Map();
  const graphNode=id=>studioVirtualNodes.get(id) ?? null;
  function setNative(id,name,value,idx=null) {
    const n=graphNode(id), w=widget(n,name,idx);
    if(!w)return false;
    if(w.value!==value){
      w.value=value;
      try{w.callback?.(value,app.canvas,n);}
      catch(e){console.warn('[H3 Studio] Native widget callback:',id,name,e);}
      app.graph?.setDirtyCanvas?.(true,true);
    }
    return true;
  }
  const getNative=(id,name,idx=null)=>widget(graphNode(id),name,idx)?.value;
  const source={};
  for (const name of ['general_prompt','segments_text','project_key','production_mode',
    'render_mode','duration_s','ratio','megapixels','base_steps','refine_steps',
    'upscale_multiplier','clip_index','h3_rng_value','seed_mode',
    'base_sampler','base_scheduler','upscale_sampler','upscale_scheduler','upscaler_model','refine_denoise']) {
    source[name]=node.widgets?.find(w=>w.name===name);
    if (!source[name]) {console.warn('[H3 Studio] Missing persistent widget:',name);return;}
    // Keep the persistent backend value/serialization while removing the DOM canvas space.
    source[name].hidden=true;
    source[name].options??={};source[name].options.hidden=true;
    source[name].computeSize=()=>[0,-4];
    for(const key of ['element','inputEl'])if(source[name][key]?.style)source[name][key].style.display='none';
  }
  // Virtual widget bridge. All values are serialized ON the Studio node,
  // not synchronized into external sampler, scheduler or chain nodes.
  const valueWidget=(name,options=null,transform=null)=>{
    const w={name, options:{values:options??[]}};
    Object.defineProperty(w,'value',{
      get:()=>transform?.get ? transform.get() : source[name]?.value,
      set:v=>{ if(transform?.set) transform.set(v);
               else if(source[name]){source[name].value=v;source[name].callback?.(v);} },
    });
    return w;
  };
  const virtual=(id, entries)=>{
    const n={widgets:entries,mode:0};studioVirtualNodes.set(id,n);return n;
  };
  const RATIO_CHOICES=['1:1 (Square)','2:3 (Portrait Photo)','3:2 (Photo)',
    '3:4 (Portrait Standard)','4:3 (Standard)','9:16 (Portrait Widescreen)',
    '16:9 (Widescreen)','21:9 (Ultrawide)'];
  const SAMPLER_CHOICES=['euler','euler_ancestral','heun','dpm_2','dpm_2_ancestral',
    'lms','dpmpp_2m','dpmpp_2m_sde','res_multistep','uni_pc','ddim'];
  const SCHEDULERS=['simple','normal','karras','exponential','sgm_uniform','ddim_uniform','beta','linear_quadratic'];
  const UPSCALER_MODELS=[]; // Listado real de MinimaxH3LatentUpscaler3D, NO una lista fija.
  // H3 V1: Unlike the old fixed eleven-item list, mirror the native ComfyUI
  // KSamplerSelect and BasicScheduler definitions. Both choices update together.
  // This is FRONTEND ONLY: model graph, saved values and sampling engine unchanged.
  const replaceChoiceValues=(target,values)=>{
    const valid=Array.isArray(values) ? values.filter(v=>typeof v==='string' && v.trim()) : [];
    if(valid.length)target.splice(0,target.length,...new Set(valid));
  };
  const getNodeOptions=(defs,nodeName,inputName)=>{
    const input=defs?.[nodeName]?.input;
    const field=input?.required?.[inputName] ?? input?.optional?.[inputName];
    const names=Array.isArray(field) ? field[0] : null;
    return Array.isArray(names) ? names : [];
  };

  virtual(ID.resolution,[valueWidget('aspect_ratio',RATIO_CHOICES,{get:()=>source.ratio.value,set:v=>source.ratio.value=v}),
    valueWidget('megapixels',[],{get:()=>source.megapixels.value,set:v=>source.megapixels.value=v})]);
  virtual(ID.baseSteps,[valueWidget('scheduler',SCHEDULERS,{get:()=>source.base_scheduler.value,set:v=>source.base_scheduler.value=v}),
    valueWidget('steps',[],{get:()=>source.base_steps.value,set:v=>source.base_steps.value=v})]);
  virtual(ID.upscaleSteps,[valueWidget('scheduler',SCHEDULERS,{get:()=>source.upscale_scheduler.value,set:v=>source.upscale_scheduler.value=v}),
    valueWidget('steps',[],{get:()=>source.refine_steps.value,set:v=>source.refine_steps.value=v})]);
  virtual(ID.baseSampler,[valueWidget('sampler_name',SAMPLER_CHOICES,{get:()=>source.base_sampler.value,set:v=>source.base_sampler.value=v})]);
  virtual(ID.upscaleSampler,[valueWidget('sampler_name',SAMPLER_CHOICES,{get:()=>source.upscale_sampler.value,set:v=>source.upscale_sampler.value=v})]);
  virtual(ID.upscaler,[valueWidget('model_name',UPSCALER_MODELS,{get:()=>source.upscaler_model.value,set:v=>source.upscaler_model.value=v})]);
  virtual(ID.seed,[valueWidget('h3_rng_value',[],{get:()=>source.h3_rng_value.value,set:v=>source.h3_rng_value.value=v}),
    valueWidget('control_after_generate',['randomize','fixed'],{get:()=>source.seed_mode.value,set:v=>source.seed_mode.value=v})]);
  virtual(ID.load,[valueWidget('latent_path',[],{get:()=>source.project_key.value,set:v=>source.project_key.value=v}),
    valueWidget('clip_index',[],{get:()=>Math.max(0,Number(source.clip_index.value)-1),
      set:v=>source.clip_index.value=Number(v)+1})]);
  virtual(ID.save,[valueWidget('filename_prefix',[],{get:()=>`${source.project_key.value}/clip`,set:()=>{}}),
    valueWidget('clip_index',[],{get:()=>Number(source.clip_index.value),set:v=>source.clip_index.value=Number(v)})]);
  virtual(ID.preview,[]); virtual(ID.final,[]);
  const chainMeta={awaiting:false,chaining:false,remaining:0,releasingModels:false};
  virtual(ID.chain,[valueWidget('segments',[],{get:()=>chainMeta.remaining,set:v=>chainMeta.remaining=Number(v)})])._h3mc=chainMeta;
  let chainRunOwner=false;
  const ownerGraph=app.graph;
  let pendingJob=null;
  // The Studio becomes the source of truth; the on-disk latent slot remains
  // handled by the existing Motion Context plugin in the internal runtime graph.
  const hideNativeWidgets=()=>{
    for (const w of node.widgets ?? []) {
      if(w.name==='h3_full_director_panel')continue;
      if(w.element?.classList?.contains('h3-director-v7-ui'))continue;
      w.hidden=true;
      w.options??={};w.options.hidden=true;
      w.computeSize=()=>[0,-4];
      for(const key of ['element','inputEl'])if(w[key]?.style)w[key].style.display='none';
    }
  };
  hideNativeWidgets();
  const state=()=>Object.fromEntries(Object.keys(source).map(k=>[k,source[k].value]));
  function keep(name,v) {source[name].value=v;source[name].callback?.(v);app.graph?.setDirtyCanvas?.(true,true);}
  // Keep the panel inside the node's resize borders.  In V8 the DOM widget had
  // zero margin and occupied the entire canvas hit area, intercepting corner drags.
  const panel=$('div',{display:'flex',flexDirection:'column',gap:'6px',boxSizing:'border-box',
    padding:'11px',width:'100%',height:'100%',overflowY:'auto',borderRadius:'3px',
    position:'relative',minWidth:'0',minHeight:'0',
    background:colors.bg,fontFamily:'Arial, sans-serif',color:colors.fg});
  updateTheme(node,panel);
  anchorOutputs(node);
  const priorResize=node.onResize;
  node.onResize=function(){const r=priorResize?.apply(this,arguments);anchorOutputs(this);return r;};
  const title=$('div',{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'});
  const txt=$('div');heading(txt,'H3 DIRECTOR STUDIO');txt.append($('div',S.caption,'MiniMax H3 · Base + Upscale · Motion Context Chain'));
  title.append(txt,$('span',{...S.caption,color:colors.green},'Latent 3D Upscale'));panel.append(title);
  const warning=$('div',{fontSize:'12px',color:colors.warn,minHeight:'16px'});

  headline(panel,'PROJECT & CHAIN');
  let r=row(panel);
  const project=input('text');item(r,'Project / continuity folder',project);
  // Run/Re-roll generates one selected clip; Chain generates a sequence. No separate production mode dropdown.
  const count=$('span',{fontSize:'12px',color:colors.sub});
  const status=$('div',{fontSize:'12px',color:colors.green,marginTop:'2px'});
  const actions=row(panel);
  const fullRender=button('▶ Generate BASE + Upscale',async()=>{
    if(active()){warning.textContent='A clip is rendering; wait for it to finish.';return;}
    keep('render_mode','Final');
    syncControls();
    await queueOnce();
  },actions,{background:'#5a4478'});
  const renderBase=button('▶ Generate BASE',async()=>{
    if(active()){warning.textContent='A clip is rendering; wait for it to finish.';return;}
    keep('render_mode','Preview base');
    syncControls();
    await queueOnce();
  },actions,{background:'#285a74'});
  const acceptBase=button('✓ Accept BASE → Upscale',async()=>{
    if(active()){warning.textContent='A clip is rendering; wait for it to finish.';return;}
    const curr=Number(source.clip_index.value);
    try{
      if(!await slotExists(curr)){
        warning.textContent=`Clip ${curr} has no saved BASE latent. Generate and review BASE first.`;return;
      }
    }catch(e){warning.textContent=`Unable to verify BASE latent: ${e.message}`;return;}
    keep('render_mode','Upscale accepted base');
    syncControls();
    await queueOnce({randomizeSeed:false});
  },actions,{background:'#2b6b4d'});
  const approve=button('✓ Approve → next BASE',()=>dispatch('Approve'),actions);
  const chain=button('▶▶ Chain · BASE + Upscale',async()=>{
    if(chainMeta.chaining){await nativeAction('Stop');return;}
    if(active()){warning.textContent='A clip is rendering; wait for it to finish.';return;}
    keep('render_mode','Final');
    syncControls();
    await nativeAction('Chain');
  },actions,{background:'#235844'});
  button('Clear latents',()=>{
    if(window.confirm('Delete numbered latent files for the current project? This breaks existing continuity.') &&
       window.confirm('Confirm permanent deletion of numbered latent files.')) dispatch('Clear latents');
  },actions,{background:'#663b40'});
  const jump=row(panel);
  const clipPicker=select([]);
  item(jump,'Select clip to generate / re-roll',clipPicker);
  button('Set clip (no render)',()=>selectClip(),jump);
  const clipHint=$('span',{...S.caption,alignSelf:'center'},'For clip N, Load = N−1 / Save = N.');
  jump.append(clipHint);
  panel.append(status,count,warning);
  // H3_DIRECTOR_UI_CLEANUP_V1: BASE is reviewed as the finished output video.
  // No live preview, preview decoding, progress bar, or preview event listeners.
  const monitorBegin=()=>{};
  const monitorEnd=()=>{};
  node.__h3MonitorCleanup=()=>{};

  line(panel);headline(panel,'VIDEO · BASE PASS');
  r=row(panel);
  const duration=input('number',0.5,180,0.5);item(r,'Duration per clip · seconds',duration);
  const ratio=select([]);item(r,'Aspect ratio',ratio);
  const mp=input('number',0.05,4,0.05);item(r,'Base resolution · MP',mp);
  r=row(panel);
  const base=input('number',1,100,1);item(r,'Base steps',base);
  const seed=input('number',0,Number.MAX_SAFE_INTEGER,1);item(r,'Seed',seed);
  const seedMode=select([['randomize','Randomize'],['fixed','Fixed']]);item(r,'Seed behavior',seedMode);
  button('Lock current seed',()=>{
    const current=getNative(ID.seed,'h3_rng_value',0);
    if(current===undefined)return;
    if (!setNative(ID.seed,'control_after_generate','fixed',1)) {
      warning.textContent='Cannot lock seed: RandomNoise mode widget is missing.';return;
    }
    seed.value=String(current);seedMode.value='fixed';
  },r);
  line(panel);headline(panel,'UPSCALE & OUTPUT');
  r=row(panel);
  const refine=input('number',1,100,1);item(r,'Upscale steps',refine);
  const denoise=input('number',0,1,0.01);item(r,'Refine denoise · 2nd pass',denoise);
  denoise.title='Default 0.20. Higher values allow stronger changes during refinement.';
  const scale=input('number',1,3,0.05);item(r,'Latent 3D multiplier',scale);
  // ADVANCED SETTINGS: expose the existing native widgets, do not replace any of their nodes.
  // Each native widget is serialized by ComfyUI in its original node; this panel is only a mirror.
  line(panel);
  const advanced=$('details',{background:colors.panel,border:`1px solid ${colors.line}`,borderRadius:'7px',padding:'8px 10px'});
  const summary=$('summary',{cursor:'pointer',fontSize:'13px',fontWeight:'bold',padding:'5px 1px'},'ADVANCED SETTINGS · SAMPLERS, SCHEDULERS & UPSCALER');
  advanced.append(summary);
  const advDescription=$('div',{...S.caption,margin:'7px 0'},'Optional technical choices. These settings are stored inside the Director. Refine denoise is adjustable in UPSCALE & OUTPUT (default 0.20).');
  advanced.append(advDescription);
  const advancedRows=row(advanced);
  panel.append(advanced);
  const advancedFields=[
    {id:ID.baseSampler,name:'sampler_name',index:0,label:'Base sampler',fallback:['euler']},
    {id:ID.baseSteps,name:'scheduler',index:0,label:'Base scheduler',fallback:['simple']},
    {id:ID.upscaler,name:'model_name',index:0,label:'Latent 3D upscaler model',fallback:['minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors']},
    {id:ID.upscaleSampler,name:'sampler_name',index:0,label:'Upscale sampler',fallback:['res_multistep']},
    {id:ID.upscaleSteps,name:'scheduler',index:0,label:'Upscale scheduler',fallback:['simple']},
  ];
  for(const f of advancedFields){
    f.control=select([]);
    item(advancedRows,f.label,f.control);
    f.control.addEventListener('change',()=>{
      if(active()){
        warning.textContent='Wait until Motion Context Chain finishes before changing advanced settings.';
        refreshAdvanced();return;
      }
      const requested=f.control.value;
      if(!setNative(f.id,f.name,requested,f.index)){
        warning.textContent=`Cannot update ${f.label}: native node #${f.id} is unavailable.`;
        return;
      }
      // Read back the authoritative native widget: never silently claim
      // a changed sampler or scheduler if the backend widget rejected it.
      const actual=String(getNative(f.id,f.name,f.index)??'');
      if(actual!==requested){
        warning.textContent=`${f.label} did not synchronize with node #${f.id} (current: ${actual}).`;
        refreshAdvanced();return;
      }
      warning.textContent='';
    });
  }
  function refreshAdvanced(){
    for(const f of advancedFields){
      const w=widget(graphNode(f.id),f.name,f.index);
      if(!w)continue;
      const optionsRaw=w.options?.values;
      const choices=Array.isArray(optionsRaw)?optionsRaw:
        (Array.isArray(optionsRaw?.values)?optionsRaw.values:[]);
      const current=String(w.value??'');
      const names=[...new Set([...choices.map(String),...f.fallback,current].filter(Boolean))];
      const sig=names.join('\u0000');
      if(f.listSignature!==sig){
        f.control.replaceChildren();
        for(const name of names){const o=$('option',{},name);o.value=name;f.control.append(o);}
        f.listSignature=sig;
      }
      if(document.activeElement!==f.control)f.control.value=current;
    }
  }

  // H3_V1_SAMPLERS_LIVE_V2: native sampler/scheduler options, requested from
  // the ComfyUI server. Visible status prevents silent fallback to 11 values.
  const samplerStatus=$('div',{...S.caption,margin:'6px 0 2px'},
    'Samplers V1 v2 · consultando opciones de ComfyUI…');
  advanced.append(samplerStatus);
  const upscalerStatus=$('div',{...S.caption,margin:'2px 0 2px'},
    'Modelos UPSCALE · consultando ComfyUI…');
  advanced.append(upscalerStatus);
  const namesFrom=(data,nodeName,inputName)=>getNodeOptions(data,nodeName,inputName);
  let retrievingChoices=false;
  let hasFullSamplers=false;
  async function fetchDefinitions(url){
    if(typeof api.fetchApi!=='function')throw new Error('ComfyUI api.fetchApi is unavailable');
    const response=await api.fetchApi(url);
    if(!response?.ok)throw new Error(`${url}: HTTP ${response?.status??'unknown'}`);
    return await response.json();
  }
  async function loadNativeChoices(){
    if(retrievingChoices)return;
    retrievingChoices=true;
    if(!hasFullSamplers)samplerStatus.textContent='Samplers V1 v2 · consultando opciones de ComfyUI…';
    let samplers=[],schedulers=[];
    const errors=[];
    try{
      // Query the precise node route FIRST: getNodeDefs() can be partial or stale.
      // KSamplerSelect is exactly the node executed by the internal BASE/UPSCALE.
      for(const [url,nodeName] of [
        ['/object_info/KSamplerSelect','KSamplerSelect'],
        ['/object_info','KSamplerSelect'],
        ['/object_info/KSampler','KSampler'],
      ]){
        try{
          const defs=await fetchDefinitions(url);
          const found=namesFrom(defs,nodeName,'sampler_name');
          if(found.length>samplers.length)samplers=found;
          if(samplers.length>11)break;
        }catch(e){errors.push(String(e));}
      }
      for(const [url,nodeName] of [
        ['/object_info/BasicScheduler','BasicScheduler'],
        ['/object_info/KSampler','KSampler'],
      ]){
        try{
          const defs=await fetchDefinitions(url);
          const found=namesFrom(defs,nodeName,'scheduler');
          if(found.length>schedulers.length)schedulers=found;
          if(schedulers.length)break;
        }catch(e){errors.push(String(e));}
      }
      if((!samplers.length||!schedulers.length)&&typeof api.getNodeDefs==='function'){
        try{
          const defs=await api.getNodeDefs();
          if(!samplers.length)samplers=namesFrom(defs,'KSamplerSelect','sampler_name');
          if(!schedulers.length)schedulers=namesFrom(defs,'BasicScheduler','scheduler');
        }catch(e){errors.push(String(e));}
      }
      if(samplers.length){
        replaceChoiceValues(SAMPLER_CHOICES,samplers);
        hasFullSamplers=samplers.length>11;
      }
      if(schedulers.length)replaceChoiceValues(SCHEDULERS,schedulers);
      refreshAdvanced();
      const count=SAMPLER_CHOICES.length;
      samplerStatus.textContent=hasFullSamplers
        ? `Samplers V1 v2 · ${count} disponibles en ComfyUI · ${SCHEDULERS.length} schedulers`
        : `Samplers V1 v2 · solo ${count} disponibles; revisa la consola (F12). Al reabrir este panel se vuelve a consultar.`;
      if(!hasFullSamplers)console.warn('[H3 Studio V1 samplers v2] Incomplete options:',{samplers,schedulers,errors});
    }catch(error){
      samplerStatus.textContent='Samplers V1 v2 · error al consultar ComfyUI (F12 para detalles)';
      console.warn('[H3 Studio V1 samplers v2] Unexpected options error',error);
    }finally{retrievingChoices=false;}
  }
  advanced.addEventListener('toggle',()=>{if(advanced.open)void loadNativeChoices();});
  void loadNativeChoices();

  // H3_V1_UPSCALER_MODELS_LIVE_V2: same live-choice mechanism as the working
  // sampler controls, but queried independently, so sampler fetches cannot block it.
  // The model directory endpoint is queried FIRST and we also compare node defs;
  // never stop on the first nonempty result (it may contain just one model).
  let loadingUpscalerModels=false;
  async function loadUpscalerModels(){
    if(loadingUpscalerModels)return;
    loadingUpscalerModels=true;
    upscalerStatus.textContent='Modelos UPSCALE v2 · consultando ComfyUI…';
    const errors=[];
    const candidates=[];
    const acceptedModel=(value)=>typeof value==='string' && /\.(?:safetensors|pth)$/i.test(value.trim());
    const addNames=(values,sourceName)=>{
      if(!Array.isArray(values))return;
      const valid=values.map(v=>typeof v==='string'?v.trim():null).filter(acceptedModel);
      if(valid.length)candidates.push({names:[...new Set(valid)],source:sourceName});
    };
    try{
      // This is the ComfyUI registered 'latent_upscale_models' model folder,
      // shared with the actual MinimaxH3LatentUpscaler3D node.
      try{
        const list=await fetchDefinitions('/models/latent_upscale_models');
        addNames(Array.isArray(list)?list:(list?.models??list?.filenames),'/models/latent_upscale_models');
      }catch(e){errors.push('models: '+String(e));}
      for(const url of ['/object_info/MinimaxH3LatentUpscaler3D','/object_info']){
        try{
          const defs=await fetchDefinitions(url);
          addNames(namesFrom(defs,'MinimaxH3LatentUpscaler3D','model_name'),url);
        }catch(e){errors.push(url+': '+String(e));}
      }
      if(typeof api.getNodeDefs==='function'){
        try{
          const defs=await api.getNodeDefs();
          addNames(namesFrom(defs,'MinimaxH3LatentUpscaler3D','model_name'),'api.getNodeDefs');
        }catch(e){errors.push('getNodeDefs: '+String(e));}
      }
      // Combine the model names reported by all sources. A short cached
      // object_info response must not hide models returned by the folder API.
      const names=[...new Set(candidates.flatMap(group=>group.names))];
      if(names.length){
        replaceChoiceValues(UPSCALER_MODELS,names);
        refreshAdvanced();
        upscalerStatus.textContent=`Modelos UPSCALE v2 · ${UPSCALER_MODELS.length} disponibles en ComfyUI`;
        upscalerStatus.title=candidates.map(g=>`${g.source}: ${g.names.length}`).join(' · ');
        console.info('[H3 V1 UPSCALE v2] Modelos:',UPSCALER_MODELS.slice(),upscalerStatus.title);
      }else{
        upscalerStatus.textContent='Modelos UPSCALE v2 · consulta sin modelos (F12)';
        console.warn('[H3 V1 UPSCALE v2] No models returned. Check folder and ComfyUI restart.',errors);
      }
    }catch(error){
      upscalerStatus.textContent='Modelos UPSCALE v2 · fallo de consulta (F12)';
      console.warn('[H3 V1 UPSCALE v2] Query error',error);
    }finally{loadingUpscalerModels=false;}
  }
  advanced.addEventListener('toggle',()=>{if(advanced.open)void loadUpscalerModels();});
  void loadUpscalerModels();

  line(panel);
  const globalSection=$('details',{background:colors.panel,border:`1px solid ${colors.line}`,borderRadius:'7px',padding:'8px 10px'});
  globalSection.append($('summary',{cursor:'pointer',fontSize:'13px',fontWeight:'bold',padding:'5px 1px'},'GLOBAL PROMPT · SHARED'));
  const general=$('textarea',{...S.text,minHeight:'160px',maxHeight:'600px',marginTop:'8px'});
  general.placeholder='Subject definitions, setting, sound and shared directions for all clips...';
  globalSection.append(general);panel.append(globalSection);
  line(panel);
  const shotsSection=$('details',{background:colors.panel,border:`1px solid ${colors.line}`,borderRadius:'7px',padding:'8px 10px'});
  shotsSection.open=true;
  shotsSection.append($('summary',{cursor:'pointer',fontSize:'13px',fontWeight:'bold',padding:'5px 1px'},'MULTI-SHOT · SEGMENT PROMPTS'));
  const bar=$('div',{display:'flex',gap:'7px',alignItems:'center',flexWrap:'wrap'});
  const boxes=$('div',{display:'flex',flexDirection:'column',gap:'7px',marginTop:'3px'});
  const raw=$('textarea',{...S.text,minHeight:'120px',display:'none'});
  button('+ Add segment',()=>{
    if (invalid) return;
    shots.push(''); expanded=shots.length-1;persistSegments();renderShots();
    boxes.querySelector('textarea')?.focus();
  },bar,{background:'#2b5747'});
  button('Reset to 4',()=>{
    if(!window.confirm('Reset to four EMPTY segments? All segment prompts in this Studio node will be lost.'))return;
    invalid=false;shots=['','','',''];expanded=0;persistSegments();renderShots();
  },bar);
  bar.append($('span',{...S.caption,marginLeft:'auto'},'Add only the segments you need'));
  shotsSection.append(bar,boxes,raw);panel.append(shotsSection);
  let shots=[],expanded=0,invalid=false;
  const slug=(v)=>String(v??'').trim().replace(/[^a-zA-Z0-9_\-/]/g,'_').replace(/\.{2,}/g,'_').replace(/^\/+|\/+$/g,'').slice(0,120);
  let busy=false;
  const syncChainCount=()=>{
    const total=shots.length;
    if(!active())setNative(ID.chain,'segments',total,0);
    const current=clipPicker.value;
    clipPicker.replaceChildren();
    for(let i=1;i<=shots.length;i++){
      const o=$('option',{},`Clip ${i}`);o.value=String(i);clipPicker.append(o);
    }
    const selected=Number(current);
    const {save}=readIndices();
    clipPicker.value=String(selected>=1&&selected<=shots.length?selected:
      Math.min(Math.max(1,save||1),shots.length));
    count.textContent=`${shots.length} segment prompt(s) · up to ${total} clip(s) configured`;
  };
  const syncProject=()=>{
    if(active())return;
    const name=slug(source.project_key.value);
    if (!name) {warning.textContent='Enter a valid project name.';return;}
    setNative(ID.load,'latent_path',name,0);
    setNative(ID.save,'filename_prefix',`${name}/clip`,0);
  };
  const syncControls=()=>{
    if (busy || !app.graph?.getNodeById?.(node.id) || active()) return;
    busy=true;
    try{
      const v=state();
      // Duration flows DIRECTLY as a FLOAT edge from Studio to the frame-count expression.
      setNative(ID.resolution,'aspect_ratio',v.ratio,0);
      setNative(ID.resolution,'megapixels',Number(v.megapixels),1);
      setNative(ID.baseSteps,'steps',Number(v.base_steps),1);
      setNative(ID.upscaleSteps,'steps',Number(v.refine_steps),1);
      // Latent multiplier flows DIRECTLY as a FLOAT edge to the upscale math and node.
      // The persistent Studio seed widget is authoritative.
      // Do not write it here: doing so would reset a randomized seed when
      // unrelated controls (MP, duration, steps, etc.) are changed.
      // The pre-refine saver and the final saver are already wired.
      // Mute the unused OUTPUT node so ComfyUI prunes its upstream branch.
      const p=graphNode(ID.preview),f=graphNode(ID.final);
      if(p && f) {
        p.mode=v.render_mode==='Preview base'?0:4;
        f.mode=v.render_mode==='Preview base'?2:0;
      }
      syncChainCount();syncProject();
    }finally{busy=false;}
    app.graph?.setDirtyCanvas?.(true,true);
  };
  const persistSegments=()=>{keep('segments_text',encode(shots));syncChainCount();};
  function renderShots(){
    boxes.replaceChildren();
    if(invalid){
      const error=$('div',{color:colors.warn,fontSize:'12px'},'Unrecognized segment format. Edit the raw text without losing your content.');
      boxes.append(error);raw.style.display='block';raw.value=String(source.segments_text.value??'');return;
    }
    raw.style.display='none';
    shots.forEach((value,i)=>{
      const outer=$('section',{border:`1px solid ${colors.line}`,borderRadius:'5px',overflow:'hidden',background:colors.panel});
      const head=$('div',{display:'flex',gap:'5px',alignItems:'center',padding:'5px'});
      button(`${expanded===i?'▼':'▶'} SEGMENT ${i+1} · ${value.trim()?'ready':'empty'}`,()=>{
        expanded=expanded===i?-1:i;renderShots();
      },head,{border:'none',background:'transparent',textAlign:'left',flex:'1',fontWeight:'bold'});
      const remove=button('Remove',()=>{
        if(shots.length===1)return;
        if(value.trim() && !window.confirm(`Delete SEGMENT ${i+1} and renumber later segments?`))return;
        shots.splice(i,1);expanded=Math.min(i,shots.length-1);persistSegments();renderShots();
      },head,{background:'#623a42'});
      remove.disabled=shots.length===1;
      outer.append(head);
      if(expanded===i){
        const area=$('textarea',{...S.text,margin:'0 7px 8px',width:'calc(100% - 14px)',minHeight:'165px',maxHeight:'440px'});
        area.value=value;area.placeholder='[SHOT 1]\nAction, expressions, dialogue, camera...';
        area.addEventListener('input',()=>{shots[i]=area.value;persistSegments();});
        area.addEventListener('keydown',e=>e.stopPropagation());outer.append(area);
      }
      boxes.append(outer);
    });
  }
  async function releaseModels(reason){
    if(chainMeta.releasingModels)return;
    chainMeta.releasingModels=true;
    warning.textContent='Releasing loaded models and GPU memory…';
    try{
      const response=await api.fetchApi('/h3_director/release_models',{method:'POST'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      warning.textContent=`Models released after ${reason}.`;
    }catch(e){
      warning.textContent=`Could not release models automatically: ${e.message}`;
    }finally{
      chainMeta.releasingModels=false;
      refreshStatus();
    }
  }
  function active(){return Boolean(chainMeta.awaiting||chainMeta.chaining||chainMeta.releasingModels);}
  async function queueOnce({randomizeSeed=true}={}){
    if(chainMeta.awaiting)return false;
    if(app.graph!==ownerGraph || ownerGraph?.getNodeById?.(node.id)!==node){
      chainMeta.chaining=false;chainRunOwner=false;
      warning.textContent='Chain stopped: return to the original workflow tab before generating.';
      return false;
    }
    if(app.processingQueue || window.__h3DirectorSubmissionLock){
      chainMeta.chaining=false;chainRunOwner=false;
      warning.textContent='Chain stopped: another prompt is being submitted. Try again when it finishes.';
      return false;
    }
    if(!shots[Number(source.clip_index.value)-1]?.trim()){
      warning.textContent=`Segment ${source.clip_index.value} has no prompt.`;return false;
    }
    if(randomizeSeed && source.seed_mode.value==='randomize'){
      const values=new Uint32Array(2);crypto.getRandomValues(values);
      const next=(BigInt(values[0])<<32n)|BigInt(values[1]);
      // Use JS safe 53-bit precision, matching ComfyUI widget serialization.
      source.h3_rng_value.value=Number(next&((1n<<53n)-1n));
      seed.value=String(source.h3_rng_value.value);
    }
    const expectedIndex=Number(source.clip_index.value);
    const expectedProject=String(source.project_key.value);
    const expectedSegments=String(source.segments_text.value);
    const expectedMode=String(source.render_mode.value);
    const job={id:null,early:new Map()};pendingJob=job;
    chainMeta.awaiting=true;chainRunOwner=true;warning.textContent='';monitorBegin();
    const previousQueue=api.queuePrompt;
    if(typeof previousQueue!=='function'){
      pendingJob=null;chainMeta.awaiting=false;chainMeta.chaining=false;chainRunOwner=false;
      warning.textContent='Cannot track this ComfyUI queue safely.';return false;
    }
    window.__h3DirectorSubmissionLock=true;
    const tracked=async function(number,prompt,...rest){
      const input=prompt?.output?.[String(node.id)]?.inputs;
      if(app.graph!==ownerGraph || ownerGraph?.getNodeById?.(node.id)!==node ||
         !input || Number(input.clip_index)!==expectedIndex ||
         String(input.project_key)!==expectedProject ||
         String(input.segments_text)!==expectedSegments ||
         String(input.render_mode)!==expectedMode){
        throw Error('The queued workflow or Director settings do not match this clip. Nothing was submitted.');
      }
      const response=await previousQueue.call(this,number,prompt,...rest);
      if(!response?.prompt_id)throw Error('ComfyUI did not return a prompt ID; automatic Chain stopped.');
      job.id=String(response.prompt_id);
      return response;
    };
    api.queuePrompt=tracked;
    try{
      const accepted=await app.queuePrompt(0,1);
      if(accepted===false || !job.id)throw Error('Could not confirm the queued execution ID; automatic Chain stopped.');
      console.info(`[H3 Director Chain] queued clip ${expectedIndex}, prompt ${job.id}`);
      const early=job.early.get(job.id);
      if(early!==undefined)completeQueue(early,job.id);
      return true;
    }catch(e){
      if(pendingJob===job){pendingJob=null;chainMeta.awaiting=false;chainMeta.chaining=false;chainRunOwner=false;
        warning.textContent=`Cannot queue clip: ${e.message}`;monitorEnd(false);}
      return false;
    }finally{
      if(api.queuePrompt===tracked)api.queuePrompt=previousQueue;
      window.__h3DirectorSubmissionLock=false;
    }
  }
  function completeQueue(ok,promptId){
    if(!chainRunOwner||!chainMeta.awaiting||!pendingJob)return;
    const id=String(promptId??'');
    if(!id)return;
    if(!pendingJob.id){pendingJob.early.set(id,ok);return;}
    if(id!==pendingJob.id)return;
    pendingJob=null;
    chainMeta.awaiting=false;monitorEnd(ok);
    const acceptedPass=String(source.render_mode.value)==='Upscale accepted base';
    if(ok && acceptedPass){
      keep('render_mode','Preview base');syncControls();
      warning.textContent='BASE accepted and upscaled. Press Approve → next BASE to continue the chain.';
    }
    if(!ok){
      chainMeta.chaining=false;chainRunOwner=false;
      void releaseModels('an interrupted or failed render');return;
    }
    if(chainMeta.chaining){
      const next=Number(source.clip_index.value)+1;
      if(next<=shots.length){
        keep('clip_index',next);expanded=next-1;renderShots();refreshStatus();
        // Let the submission wrapper restore itself before scheduling the next clip.
        setTimeout(()=>void queueOnce(),0);return;
      }
      chainMeta.chaining=false;chainRunOwner=false;refreshStatus();
      void releaseModels('the completed chain');return;
    }
    chainRunOwner=false;refreshStatus();
    void releaseModels('the completed render');
  }
  const onSuccess=event=>completeQueue(true,event?.detail?.prompt_id);
  const onError=event=>completeQueue(false,event?.detail?.prompt_id);
  api.addEventListener('execution_success',onSuccess);
  api.addEventListener('execution_error',onError);
  api.addEventListener('execution_interrupted',onError);
  async function nativeAction(action){
    if(action==='Stop'||(action==='Chain'&&chainMeta.chaining)){
      chainMeta.chaining=false;warning.textContent='Chain stops after the current clip.';return true;
    }
    if(action==='Clear latents'){
      try{
        const response=await api.fetchApi('/h3_director/final_context/clear_latents',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({latent_path:source.project_key.value})});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const data=await response.json();source.clip_index.value=1;
        warning.textContent=`Removed ${data.removed??0} continuity slots.`;refreshStatus();return true;
      }catch(e){warning.textContent=`Cannot clear latents: ${e.message}`;return false;}
    }
    if(chainMeta.awaiting)return false;
    if(action==='Approve'){
      const curr=Number(source.clip_index.value);
      if(curr>=shots.length)return false;
      if(!await slotExists(curr)){
        warning.textContent=`Clip ${curr} has no saved BASE latent.`;return false;
      }
      source.clip_index.value=curr+1;expanded=curr;renderShots();refreshStatus();
      return queueOnce();
    }
    if(action==='Chain'){
      const curr=Number(source.clip_index.value);
      const exists=await slotExists(curr,'final');
      const first=exists?curr+1:curr;
      if(first>shots.length){warning.textContent='All segments already generated.';return false;}
      source.clip_index.value=first;expanded=first-1;renderShots();refreshStatus();
      chainMeta.chaining=true;return queueOnce();
    }
    return queueOnce();
  }
  async function slotExists(slot,stage='base'){
    const path=getNative(ID.load,'latent_path',0);
    const response=await api.fetchApi('/h3_director/final_context/slot_exists',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({latent_path:path||'h3_context',clip_index:slot,stage})
    });
    if(!response.ok)throw Error(`Slot check returned HTTP ${response.status}`);
    const data=await response.json();
    return Boolean(data.exists);
  }
  function readIndices(){
    return {load:Number(getNative(ID.load,'clip_index',1)),
            save:Number(getNative(ID.save,'clip_index',1))};
  }
  async function selectClip(){
    if(active()){warning.textContent='Stop the active Chain before selecting another clip.';return;}
    const clip=Number(clipPicker.value);
    if(!Number.isInteger(clip)||clip<1||clip>shots.length){
      warning.textContent='Choose an existing segment.';return;
    }
    if(clip>1){
      try{
        if(!await slotExists(clip-1)){
          warning.textContent=`Cannot select clip ${clip}: previous latent slot ${clip-1} is missing. Generate clip ${clip-1} first.`;
          return;
        }
      }catch(e){warning.textContent=`Unable to verify previous latent: ${e.message}. Indices unchanged.`;return;}
    }
    if(active()){warning.textContent='Chain started while checking latents. Indices unchanged.';return;}
    if(!setNative(ID.load,'clip_index',clip-1,1)||
       !setNative(ID.save,'clip_index',clip,1)){
      warning.textContent='Continuity controls are unavailable.';return;
    }
    expanded=clip-1;renderShots();
    warning.textContent=clip<shots.length
       ?`Clip ${clip} selected. Re-rolling it overwrites slot ${clip}; later clips still use older continuity until regenerated.`
       :`Clip ${clip} selected. Press Run/Re-roll to generate this clip.`;
    refreshStatus();
  }
  async function dispatch(action){
    if(action==='Chain'&&chainMeta.chaining){await nativeAction('Stop');return;}
    if(active()){warning.textContent='A clip is rendering; wait for it to finish.';return;}
    if((action==='Approve'||action==='Chain') && source.render_mode.value==='Upscale accepted base'){
      warning.textContent='Accept the current BASE first; then the Director returns to BASE review for the next clip.';return;
    }
    const {load,save}=readIndices();
    if(save!==load+1){warning.textContent='Continuity clip indices inconsistent.';return;}
    if(action==='Approve'&&save>=shots.length){warning.textContent='Last segment reached.';return;}
    await nativeAction(action);
  }
  const apply=(el,name,parser=(v)=>v,when=null,event='change')=>{
    el.addEventListener(event,()=>{
      const val=parser(el.value);
      if(val===null || Number.isNaN(val))return;
      keep(name,val);
      if(when)when(); else syncControls();
    });
  };
  const validNumber=(min,max,int=false)=>(v)=>{
    if(v==='')return null;
    let n=Number(v);if(!Number.isFinite(n)||n<min||n>max)return null;
    return int?Math.round(n):n;
  };
  apply(duration,'duration_s',validNumber(0.5,180));
  apply(ratio,'ratio');
  apply(mp,'megapixels',validNumber(0.05,4));
  apply(base,'base_steps',validNumber(1,100,true));
  apply(refine,'refine_steps',validNumber(1,100,true));
  denoise.addEventListener('change',()=>{
    const value=validNumber(0,1)(denoise.value);
    if(value===null){denoise.value=String(source.refine_denoise.value??0.20);return;}
    keep('refine_denoise',value);syncControls();
  });
  apply(scale,'upscale_multiplier',validNumber(1,3));
  seed.addEventListener('change',()=>{
    const val=validNumber(0,Number.MAX_SAFE_INTEGER,true)(seed.value);
    if(val===null){warning.textContent='Seed must be a nonnegative integer.';return;}
    if(!setNative(ID.seed,'h3_rng_value',val,0)){
      warning.textContent='RandomNoise seed widget is unavailable.';return;
    }
    seed.value=String(val);warning.textContent='';
  });
  seedMode.addEventListener('change',()=>{
    if(!setNative(ID.seed,'control_after_generate',seedMode.value,1))
      warning.textContent='RandomNoise seed mode widget is unavailable.';
    else warning.textContent='';
  });
  // Numeric/text production fields: Enter commits exactly like leaving the field.
  // Never bubble Enter to ComfyUI canvas shortcuts or trigger a render.
  for(const field of [project,duration,mp,base,refine,denoise,scale,seed]){
    field.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      e.preventDefault();e.stopPropagation();
      field.dispatchEvent(new Event('change',{bubbles:false}));
      field.blur();
    });
  }
  apply(project,'project_key',slug,()=>{
    // Never silently reset Load/Save; changing a project redirects future latents.
    if(Number(getNative(ID.load,'clip_index',1))>0){
      warning.textContent='Project changed during an active sequence. Select Clip 1 or clear temporary latents before generating in the new folder.';
    } else warning.textContent='';
    syncProject();
  });
  general.addEventListener('input',()=>keep('general_prompt',general.value));
  general.addEventListener('keydown',e=>e.stopPropagation());
  project.addEventListener('keydown',e=>e.stopPropagation());
  raw.addEventListener('input',()=>keep('segments_text',raw.value));
  raw.addEventListener('change',()=>{
    const parsed=decode(raw.value);if(parsed){shots=parsed;invalid=false;expanded=0;renderShots();syncChainCount();}
  });
  raw.addEventListener('keydown',e=>e.stopPropagation());
  // Prevent drag or keyboard shortcuts inside text/number inputs from editing the canvas.
  panel.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))e.stopPropagation();});

  const restore=()=>{
    const v=state();
    project.value=v.project_key??'';
    // Legacy serialized field is fixed to Chain; the user chooses Run or Chain using buttons.
    if(v.production_mode!=='Chain')keep('production_mode','Chain');
    duration.value=v.duration_s;mp.value=v.megapixels;
    base.value=v.base_steps;refine.value=v.refine_steps;scale.value=v.upscale_multiplier;
    denoise.value=v.refine_denoise??0.20;
    seed.value=String(getNative(ID.seed,'h3_rng_value',0)??'0');
    seedMode.value=String(getNative(ID.seed,'control_after_generate',1)??'randomize');
    general.value=String(v.general_prompt??'');
    ratio.replaceChildren();
    const available=widget(graphNode(ID.resolution),'aspect_ratio',0)?.options?.values;
    const options=Array.isArray(available)?available:(Array.isArray(available?.values)?available.values:[]);
    const names=options.length ? options.map(v=>String(v)) : [String(v.ratio??'16:9 (Widescreen)')];
    if(!names.includes(String(v.ratio)))names.unshift(String(v.ratio));
    for(const name of [...new Set(names)]) {let op=$('option',{},name);op.value=name;ratio.append(op);}
    ratio.value=String(v.ratio);
    shots=decode(v.segments_text)??[];
    invalid=decode(v.segments_text)===null;
    expanded=0;
    renderShots();
    refreshAdvanced();
    hideNativeWidgets();
    anchorOutputs(node);
    updateTheme(node,panel);
    // Defer mirroring until LiteGraph has restored all original nodes.
    Promise.resolve().then(()=>syncControls());
  };
  // Manual size grip stays accessible even if a ComfyUI frontend build
  // intercepts canvas node resize handles under custom DOM widgets.
  // Coordinates are screen pixels, while node sizes are in graph units.
  const grip=$('div',{
    position:'sticky',bottom:'2px',alignSelf:'flex-end',marginTop:'auto',
    padding:'5px 10px',border:`1px solid ${colors.line}`,borderRadius:'5px',
    background:colors.panel,color:colors.sub,fontSize:'12px',fontWeight:'bold',
    cursor:'nwse-resize',touchAction:'none',userSelect:'none',zIndex:'5',
  },'↘ Resize');
  grip.title='Drag to resize the Director width and height';
  panel.append(grip);
  grip.addEventListener('pointerdown',event=>{
    if(event.button !== undefined && event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const pointerId=event.pointerId;
    const x=event.clientX,y=event.clientY;
    const [w,h]=Array.isArray(node.size)?[...node.size]:[1050,1220];
    const scale=Math.max(0.05,Number(app.canvas?.ds?.scale)||1);
    const move=ev=>{
      if(ev.pointerId!==pointerId)return;
      ev.preventDefault();ev.stopPropagation();
      const nw=Math.max(490,Math.round(w+(ev.clientX-x)/scale));
      const nh=Math.max(440,Math.round(h+(ev.clientY-y)/scale));
      // LiteGraph setSize updates the graph layout, output ports and DOM widget.
      node.setSize?.([nw,nh]);
      anchorOutputs(node);
      // Some frontend releases cache a DOM widget's width instead of tracking
      // the parent node's width. Clear only this Studio widget's cached width.
      if(ui)ui.width=undefined;
      app.graph?.setDirtyCanvas?.(true,true);
    };
    const finish=ev=>{
      if(ev.pointerId!==pointerId)return;
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',finish,true);
      window.removeEventListener('pointercancel',finish,true);
      try{grip.releasePointerCapture?.(pointerId);}catch{}
      app.graph?.setDirtyCanvas?.(true,true);
    };
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',finish,true);
    window.addEventListener('pointercancel',finish,true);
    try{grip.setPointerCapture?.(pointerId);}catch{}
  });

  // Keep source widgets serialized, and hide only their canvas widget rendering.
  // No maxHeight: the panel must be able to grow beyond 1600px when expanded.
  const ui=node.addDOMWidget('h3_full_director_panel','h3_director_studio_ui',panel,{
    getMinHeight:()=>360,hideOnZoom:false,margin:11,
    serialize:false,getValue:()=>'',setValue:()=>{},
    afterResize:()=>{anchorOutputs(node);ui.width=undefined;},
  });
  ui.serialize=false;ui.options??={};ui.options.serialize=false;
  panel.classList.add('h3-director-v1-ui');
  window.setTimeout(()=>window.__h3DirectorStudioV2Enhance?.(node,panel),0);
  hideNativeWidgets();
  node.__h3studio={restore,syncControls};
  // Do not force node.size: respect the saved JSON geometry and manual resizing.
  restore();
  function refreshStatus(){
    const {load,save}=readIndices();
    clipPicker.value=String(save);
    status.textContent=`Continuity · Load ${load} / Save ${save} · Clip ${load+1}`;
  }
  refreshStatus();
  const timer=window.setInterval(()=>{
    if(!app.graph?._nodes?.includes(node)){window.clearInterval(timer);return;}
    const load=Number(getNative(ID.load,'clip_index',1)??0);
    const save=Number(getNative(ID.save,'clip_index',1)??1);
    status.textContent=`Continuity · Load ${load} / Save ${save} · Clip ${load+1}`;
    // Important: DO NOT rewrite Load/Save indices while Chain is running.
    chain.disabled=false;
    chain.textContent=graphNode(ID.chain)?._h3mc?.chaining?'■ Stop':'▶▶ Chain';
    if(advanced.open)refreshAdvanced();
    updateTheme(node,panel);
    anchorOutputs(node);
    // RandomNoise itself randomizes seeds on queue; don't overwrite them here.
    if(document.activeElement!==seedMode)
      seedMode.value=String(getNative(ID.seed,'control_after_generate',1)??'randomize');
    if(getNative(ID.seed,'control_after_generate',1)==='randomize' && document.activeElement!==seed){
      const current=getNative(ID.seed,'h3_rng_value',0);
      if(current!==undefined)seed.value=String(current);
    }
  },1500);
}
app.registerExtension({
  name:'h3.director.studio.v1.integrated',
  async beforeRegisterNodeDef(nodeType,nodeData){
    if(nodeData.name!==TYPE)return;
    const origCreated=nodeType.prototype.onNodeCreated;
    const origConfigure=nodeType.prototype.onConfigure;
    const origRemoved=nodeType.prototype.onRemoved;
    nodeType.prototype.onNodeCreated=function(){const x=origCreated?.apply(this,arguments);mirror(this);return x;};
    nodeType.prototype.onConfigure=function(){const x=origConfigure?.apply(this,arguments);this.__h3studio?.restore();return x;};
    nodeType.prototype.onRemoved=function(){this.__h3MonitorCleanup?.();return origRemoved?.apply(this,arguments);};
  },
  loadedGraphNode(node){
    if(node.comfyClass===TYPE||node.type===TYPE){
      if(!node.__h3studio)mirror(node);
      node.__h3studio?.restore();
    }
  },
});

// H3_DIRECTOR_REFINE_DENOISE_V1

// H3_DIRECTOR_BASE_REVIEW_ACCEPT_V3

// H3_DIRECTOR_MODEL_RELEASE_V3

// H3_DIRECTOR_STUDIO_V2_UI_THEME_AUTOHEIGHT
// Visual layer only. It rearranges the existing Director controls without
// changing any sampler, Motion Context, latent, audio, queue, or prompt logic.
(() => {
  const TYPE='H3DirectorStudioV1';
  const STYLE_ID='h3-director-studio-v2-theme';
  const actionColors={
    generate:'#087c98', keep:'#61419e', approve:'#50368e',
    chain:'#236f45', reset:'#185f78', clear:'#7c3d4d', utility:'#2b5968'
  };
  const text=el=>String(el?.textContent??'').trim();
  const all=(root,selector)=>Array.from(root.querySelectorAll(selector));
  const buttonBy=(panel,prefix)=>all(panel,'button').find(b=>text(b).startsWith(prefix));
  const el=(tag,className='',label='')=>{
    const out=document.createElement(tag);
    if(className)out.className=className;
    if(label)out.textContent=label;
    return out;
  };
  const wait=fn=>{requestAnimationFrame(()=>requestAnimationFrame(fn));};

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style'); style.id=STYLE_ID;
    style.textContent=`
      .h3-director-v1-ui.h3-v2-ui{
        --h3v2-amber:#d18325; --h3v2-amber-soft:rgba(209,131,37,.52);
        --h3v2-card:#22363a; --h3v2-field:#16272b; --h3v2-text:#edf4f1;
        --h3v2-sub:#b6c6bf; overflow-y:auto !important; gap:9px !important;
      }
      .h3-director-v1-ui.h3-v2-ui input:not([type="checkbox"]),
      .h3-director-v1-ui.h3-v2-ui select,
      .h3-director-v1-ui.h3-v2-ui textarea{
        border:1px solid var(--h3v2-amber-soft) !important;
        background:var(--h3v2-field) !important; color:var(--h3v2-text) !important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025) !important;
      }
      .h3-director-v1-ui.h3-v2-ui input:not([type="checkbox"]):focus,
      .h3-director-v1-ui.h3-v2-ui select:focus,
      .h3-director-v1-ui.h3-v2-ui textarea:focus{
        outline:none !important; border-color:var(--h3v2-amber) !important;
        box-shadow:0 0 0 2px rgba(209,131,37,.18) !important;
      }
      .h3-director-v1-ui.h3-v2-ui details,
      .h3-director-v1-ui.h3-v2-ui section{
        border-color:var(--h3v2-amber-soft) !important;
      }
      .h3-director-v1-ui.h3-v2-ui summary{color:var(--h3v2-text) !important;}
      .h3v2-group{
        display:flex; flex-direction:column; gap:9px; box-sizing:border-box;
        border:2px solid var(--h3v2-amber); border-radius:10px; padding:10px 12px;
        background:rgba(12,30,32,.28); box-shadow:0 0 11px rgba(209,131,37,.10);
      }
      .h3v2-group-title{
        color:var(--h3v2-text); font-weight:800; font-size:14px; letter-spacing:.25px;
        display:flex; align-items:center; gap:9px;
      }
      .h3v2-group-title::before{
        content:''; display:block; width:6px; height:22px; border-radius:4px;
        background:var(--h3v2-amber); box-shadow:0 0 7px rgba(209,131,37,.34);
      }
      .h3v2-actions{display:flex; flex-wrap:wrap; align-items:end; gap:9px;}
      .h3v2-action{
        min-height:38px !important; padding:7px 12px !important; border-radius:6px !important;
        border:1px solid rgba(255,255,255,.20) !important; color:#f7fbfa !important;
        font-weight:700 !important; letter-spacing:.05px; flex:1 1 180px;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(0,0,0,.28),
                   0 2px 0 rgba(0,0,0,.45), 0 4px 8px rgba(0,0,0,.18) !important;
        transition:transform .08s ease, box-shadow .08s ease, filter .12s ease;
      }
      .h3v2-action:hover{filter:brightness(1.08);}
      .h3v2-action:active{
        transform:translateY(2px); box-shadow:inset 0 2px 4px rgba(0,0,0,.30),
                   0 1px 0 rgba(0,0,0,.38) !important;
      }
      .h3v2-mode{min-width:135px; flex:0 0 135px; display:flex; flex-direction:column; gap:5px;}
      .h3v2-mode-label{color:var(--h3v2-text); font-size:12px; font-weight:800; letter-spacing:.25px;}
      .h3v2-switch{
        appearance:none; width:58px; height:27px; margin:0; cursor:pointer; border-radius:18px;
        position:relative; background:#3a2b18; border:1px solid var(--h3v2-amber) !important;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.45),0 0 5px rgba(209,131,37,.18);
      }
      .h3v2-switch::after{
        content:''; position:absolute; top:3px; left:3px; width:19px; height:19px; border-radius:50%;
        background:#f1f4ef; box-shadow:0 1px 2px rgba(0,0,0,.55); transition:left .14s ease;
      }
      .h3v2-switch:checked{background:var(--h3v2-amber);}
      .h3v2-switch:checked::after{left:33px;}
      .h3v2-status{
        border:1px solid rgba(83,198,125,.55); border-radius:6px; padding:4px 8px;
        background:rgba(28,95,52,.24); color:#a7e6b8 !important; width:max-content;
      }
      .h3v2-set-clip{background:#2b5968 !important; flex:0 0 auto !important; min-height:32px !important;}
      .h3-director-v1-ui.h3-v2-ui > div:last-child{border-color:var(--h3v2-amber-soft) !important;}
    `;
    document.head.append(style);
  }

  function scheduleApply(node,attempt=0){
    wait(()=>{
      const widget=node.widgets?.find(w=>w.name==='h3_full_director_panel');
      const panel=widget?.element ?? widget?.inputEl;
      if(panel && panel.classList?.contains('h3-director-v1-ui'))enhance(node,panel);
      else if(attempt<12)setTimeout(()=>scheduleApply(node,attempt+1),60);
    });
  }

  function enhance(node,panel){
    if(panel.__h3DirectorStudioV2)return;
    const full=buttonBy(panel,'▶ Generate BASE + Upscale');
    const base=all(panel,'button').find(b=>text(b)==='▶ Generate BASE');
    const keep=buttonBy(panel,'✓ Accept BASE');
    const approve=buttonBy(panel,'✓ Approve');
    const originalChain=buttonBy(panel,'▶▶ Chain');
    const clear=buttonBy(panel,'Clear latents');
    const clipSelect=all(panel,'select').find(s=>all(s,'option').some(o=>/^Clip\s+\d+$/i.test(text(o))));
    if(!full||!base||full===base||!keep||!approve||!originalChain||!clear||!clipSelect)return;

    const oldActions=full.parentElement;
    const clipRow=clipSelect.parentElement?.parentElement;
    if(!oldActions||!clipRow)return;
    panel.__h3DirectorStudioV2=true; addStyles(); panel.classList.add('h3-v2-ui');
    const anchor=oldActions;
    const manual=el('section','h3v2-group');
    const chainGroup=el('section','h3v2-group');
    manual.append(el('div','h3v2-group-title','MANUAL CLIP WORKFLOW'));
    chainGroup.append(el('div','h3v2-group-title','AUTOMATED SEQUENCE'));
    anchor.before(manual); manual.after(chainGroup);
    manual.append(clipRow);
    const setClip=buttonBy(clipRow,'Set clip');
    if(setClip){setClip.textContent='Set active clip';setClip.classList.add('h3v2-action','h3v2-set-clip');}

    const manualActions=el('div','h3v2-actions');
    const mode=el('div','h3v2-mode');
    const modeLabel=el('div','h3v2-mode-label');
    const toggle=el('input','h3v2-switch'); toggle.type='checkbox'; toggle.setAttribute('aria-label','Generate BASE or final pass');
    const renderMode=node.widgets?.find(w=>w.name==='render_mode');
    toggle.checked=String(renderMode?.value??'Preview base')==='Final';
    const clipNumber=()=>Number(clipSelect.value)||1;
    const updateActionText=()=>{
      modeLabel.textContent=toggle.checked?'GENERATE FINAL':'GENERATE BASE';
      full.textContent=`▶ GENERATE CLIP ${clipNumber()}`;
    };
    updateActionText();
    toggle.addEventListener('change',()=>{
      if(renderMode){
        renderMode.value=toggle.checked?'Final':'Preview base';
        try{renderMode.callback?.(renderMode.value);}catch{}
      }
      updateActionText();
    });
    clipSelect.addEventListener('change',updateActionText);
    // Capture before the original button listener. BASE mode forwards to the
    // existing, proven BASE button; Final keeps the original exact handler.
    full.addEventListener('click',event=>{
      if(toggle.checked)return;
      event.preventDefault(); event.stopImmediatePropagation(); base.click();
    },true);
    mode.append(modeLabel,toggle);
    manualActions.append(mode,full,keep,approve); manual.append(manualActions);
    base.style.display='none';
    full.classList.add('h3v2-action'); full.style.background=actionColors.generate;
    keep.textContent='✓ KEEP BASE → UPSCALE';keep.classList.add('h3v2-action');keep.style.background=actionColors.keep;
    approve.textContent='✓ APPROVE FINAL → NEXT CLIP';approve.classList.add('h3v2-action');approve.style.background=actionColors.approve;

    const chainActions=el('div','h3v2-actions');
    const chain=el('button','h3v2-action','▶▶ RUN CHAIN'); chain.type='button';chain.style.background=actionColors.chain;
    chain.addEventListener('click',event=>{event.preventDefault();originalChain.click();setTimeout(refreshChain,40);});
    originalChain.style.display='none';
    clear.textContent='CLEAR TEMPORARY LATENTS';clear.classList.add('h3v2-action');clear.style.background=actionColors.clear;
    chainActions.append(chain,clear);chainGroup.append(chainActions);
    oldActions.remove();

    const status=all(panel,'div').find(d=>text(d).startsWith('Continuity · Load'));
    if(status)status.classList.add('h3v2-status');
    function refreshChain(){
      const running=text(originalChain).startsWith('■');
      chain.textContent=running?'■ STOP AFTER CURRENT CLIP':`▶▶ RUN CHAIN FROM CLIP ${clipNumber()}`;
      updateActionText();
    }
    const titleTimer=setInterval(refreshChain,450); refreshChain();

    // Keep the user's node dimensions. Prompt sections scroll inside the
    // Director instead of expanding/shrinking the canvas node automatically.
    const oldCleanup=node.__h3V2Cleanup;
    node.__h3V2Cleanup=()=>{clearInterval(titleTimer);oldCleanup?.();};
  }

  window.__h3DirectorStudioV2Enhance=enhance;

  app.registerExtension({
    name:'h3.director.studio.v2.ui',
    beforeRegisterNodeDef(nodeType,nodeData){
      if(nodeData.name!==TYPE)return;
      const previousCreated=nodeType.prototype.onNodeCreated;
      const previousRemoved=nodeType.prototype.onRemoved;
      nodeType.prototype.onNodeCreated=function(){const out=previousCreated?.apply(this,arguments);scheduleApply(this);return out;};
      nodeType.prototype.onRemoved=function(){this.__h3V2Cleanup?.();return previousRemoved?.apply(this,arguments);};
    },
    loadedGraphNode(node){
      if(node.comfyClass===TYPE||node.type===TYPE)scheduleApply(node);
    },
  });
})();
// H3_DIRECTOR_STUDIO_V2_UI_DIRECT_HOOK_V1
// H3_DIRECTOR_STUDIO_V2_UI_DIRECT_HOOK_V2
