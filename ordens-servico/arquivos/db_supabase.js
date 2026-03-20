
const SUPABASE_URL =
  (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) ||
  (typeof window.SUPABASE_URL !== 'undefined' ? window.SUPABASE_URL : '') ||
  '';

const SUPABASE_ANON_KEY =
  (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) ||
  (typeof window.SUPABASE_ANON_KEY !== 'undefined' ? window.SUPABASE_ANON_KEY : '') ||
  '';

const CHANNEL_NAME = 'pcm_operador_channel';
const STRUCTURE_TAG = 'base_online_supabase_v1';
const POLL_INTERVAL_MS = 4000;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

const DEFAULT_LISTS = {
  prioridade: ['ALTA','MÉDIA','BAIXA'],
  local: [
    'GRAO 02','SECADOR 01','GRAO 01','UBS 02','UBS 03','OFICINA','SECADOR 06','BALANCA',
    'FATURAMENTO','UBS 01','UBS 04','SECADOR 07','SECADOR 03','SECADOR 04','SECADOR 02',
    'LIMPEZA DE BAG','GRAO','SECADOR 09','CLASSIFICACAO','SECADOR 05','SECADOR 08','SEDE',
    'LABORATORIO','TRILHADEIRA','PORTARIA','UBS 06','AR 06','LAVADOR EMPILHADEIRA','LOGISTICA',
    'AR 01','AR 02','SUBSTACAO','REFEITORIO','AR 05','AR 14','AR 13','UBS 05','ARMAZEM REFRIGERADOS',
    'AR 09','AR 20','AR 03','AR 04','SECADORES','ALMOXARIFADO','GALPAO DE LONA','AR 07','AR 24',
    'TSI','PMS','AR 17','SECADOR 11','AR 23','POSTO DE COMBUSTIVEL','LIMPEZA DE CACAMBA','AR 21',
    'PATIO','SALA DE PRODUCAO','AR TSI','AR 12','PIT STOP','SALA CAMPO','PRODUCAO','CONTROLE DE QUALIDADE',
    'ESCOLA','ALOJAMENTO','AR 19','SALA DE CAMPO','SERRALHERIA','SALA DE REUNIAO','AR 22','AMBULATORIO',
    'AR 10','PCP','LAVADOR DE EPIS','SALA BRIGADA','AR 15','AR 11','AR 18','AR 16','DOIS MARCOS',
    'ADMINISTRATIVO','COMERCIAL','ARMAZENS ANTI CAMARA','AR 08','SECADOR 10','SUCATA','HIDRANTE','SALA TI'
  ],
  equipamento: [
    'MOEGA','PRE LIMPEZA','ELEVADOR 01','ELEVADOR 02','ELEVADOR 03','ELEVADOR 04','ELEVADOR 05',
    'ELEVADOR 06','ELEVADOR 07','ELEVADOR 08','ELEVADOR 09','ELEVADOR 10','SILO PULMAO 01',
    'SILO PULMAO 02','SILO PULMAO 03','SILO PULMAO 04','SECADOR MEGA','SILO SECADOR 01',
    'SILO SECADOR 02','SILO SECADOR 03','SILO SECADOR 04','SILO SECADOR 05','SILO SECADOR 06',
    'SILO EXPEDICAO 01','SILO EXPEDICAO 02','SILO EXPEDICAO 03','SILO EXPEDICAO 04',
    'FITA TRANSPORTADORA 01','FITA TRANSPORTADORA 02','FITA TRANSPORTADORA 03','FITA TRANSPORTADORA 04',
    'FITA TRANSPORTADORA 05','ROSCA 01','ROSCA 02','ROSCA 03','ROSCA 04','ROSCA 05','ROSCA 06',
    'ROSCA 07','ROSCA 08','ROSCA 09','ROSCA 10','PAINEL ELETRICO','ESPIRAIS','PADRONIZADOR 01',
    'PADRONIZADOR 02','PADRONIZADOR 03','PADRONIZADOR 04','MESA DENSIMETRICA 01','MESA DENSIMETRICA 02',
    'MESA DENSIMETRICA 03','MESA DENSIMETRICA 04','MESA DENSIMETRICA 05','MESA DENSIMETRICA 06',
    'MESA DENSIMETRICA 07','MESA DENSIMETRICA 08','MESA DENSIMETRICA 09','MESA DENSIMETRICA 10',
    'MESA DENSIMETRICA 11','MESA DENSIMETRICA 12','CAIXA DE ENSAQUE 01','CAIXA DE ENSAQUE 02',
    'ENSACADEIRA 01','ENSACADEIRA 02','BALANCA DE PISO'
  ],
  componente: [
    'EIXO','POLIA','MANCAL','MANGOTE','ROLAMENTO','CORREIA','CORRENTE','ENGRENAGEM','REDUTOR','MOTOR',
    'ACOPLAMENTO','RETENTOR','PINHAO','CHAVETA','BUCHA','PARAFUSO','PORCA','ARRUELA','CANECA','TAMBOR',
    'ROLETE','SENSOR','CONTATOR','DISJUNTOR','CABO','VALVULA','CILINDRO','PISTAO','VEDACAO','JUNTA',
    'EMENDA','TENSIONADOR','PENEIRA','HELICE','VENTILADOR','SUPORTE','MOLA','MANGUEIRA','TERMINAL',
    'FUSIVEL','BOTAO','RELE','INVERSOR'
  ],
  tipo: ['PREVENTIVA','CORRETIVA','MELHORIA'],
  executores: [],
  solicitante: []
};

function pad2(n){ return String(n).padStart(2,'0'); }
function nowBR(){ const d = new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function parseBR(str){ if(!str) return null; const m = String(str).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/); if(!m) return null; return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]); }
function elapsedHHMM(start,end=new Date()){ const s=parseBR(start); if(!s) return '-'; const diff=Math.max(0,Math.floor((end-s)/60000)); return `${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`; }
function escapeHtml(v){ return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function priorityClass(p){ return p==='ALTA'?'high':p==='MÉDIA'?'medium':'low'; }
function structured(v){ return JSON.parse(JSON.stringify(v)); }

function requireConfig(){
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
    throw new Error('Configuração ausente. Preencha o arquivo config.js.');
  }
}

function baseHeaders(extra={}){
  return {
    'apikey': SUPABASE_ANON_KEY,
    ...extra
  };
}

async function parseResponse(res){
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch(_) { data = text; }
  if(!res.ok){
    const message = data && data.message ? data.message : `Erro HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function rest(path, options={}){
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: baseHeaders(options.headers || {}),
    body: options.body
  });
  return parseResponse(res);
}

async function rpc(name, payload={}){
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type':'application/json' }),
    body: JSON.stringify(payload)
  });
  return parseResponse(res);
}

async function initDB(){
  requireConfig();
  await ensureStructure();
  await ensureLists();
}

async function ensureStructure(){
  const structure = await getMetaRecord('structure_version');
  if(!structure){
    await upsertMeta({ id:'structure_version', value: STRUCTURE_TAG, updated_at: nowBR(), mode:'online' });
  } else if(structure.value !== STRUCTURE_TAG) {
    await upsertMeta({ ...structure, value: STRUCTURE_TAG, updated_at: nowBR(), mode:'online' });
  }
}

async function ensureLists(){
  const rec = await getListRecord();
  if(!rec){
    await rest('listas', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'Prefer':'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ id:'default', lists: structured(DEFAULT_LISTS), updated_at: nowBR() })
    });
  }
}

async function getMetaRecord(id){
  const rows = await rest(`meta?id=eq.${encodeURIComponent(id)}&select=*`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertMeta(record){
  const rows = await rest('meta', {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'Prefer':'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(record)
  });
  return rows && rows[0] ? rows[0] : null;
}

async function getListRecord(){
  const rows = await rest('listas?id=eq.default&select=*');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getLists(){
  const rec = await getListRecord();
  return structured(rec?.lists || DEFAULT_LISTS);
}

async function setLists(lists){
  const rows = await rest('listas', {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'Prefer':'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ id:'default', lists: structured(lists), updated_at: nowBR() })
  });
  notifyChange();
  return rows && rows[0] ? rows[0] : null;
}

async function getAllOrders(){
  const rows = await rest('ordens?select=*&order=id_os.desc');
  return Array.isArray(rows) ? rows : [];
}
async function getOrder(id){
  const rows = await rest(`ordens?id_os=eq.${Number(id)}&select=*`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function addOrder(data, silent=false){
  const next = await rpc('next_os_number');
  const ordem = {
    id_os: Number(next),
    status:'ABERTA',
    data_abertura: nowBR(),
    data_inicio:'',
    data_fim:'',
    prioridade:data.prioridade,
    local:data.local,
    equipamento:data.equipamento,
    tipo_manutencao:data.tipo_manutencao,
    executores: structured(data.executores || []),
    solicitante:data.solicitante,
    observacao_abertura:data.observacao_abertura || '',
    causa_raiz:'',
    componente:'',
    observacao_fechamento:'',
    o_que_feito:'',
    o_que_falta: data.o_que_falta || '',
    os_origem: data.os_origem || null,
    pendente: !!data.pendente
  };
  const rows = await rest('ordens', {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'Prefer':'return=representation' },
    body: JSON.stringify(ordem)
  });
  if(!silent) notifyChange();
  return rows && rows[0] ? rows[0] : ordem;
}
async function updateOrder(ordem, silent=false){
  const rows = await rest(`ordens?id_os=eq.${Number(ordem.id_os)}`, {
    method:'PATCH',
    headers: { 'Content-Type':'application/json', 'Prefer':'return=representation' },
    body: JSON.stringify(structured(ordem))
  });
  if(!silent) notifyChange();
  return rows && rows[0] ? rows[0] : ordem;
}
async function startOrder(id){
  const ordem = await getOrder(id);
  if(!ordem) throw new Error('OS não encontrada.');
  ordem.status = 'ANDAMENTO';
  ordem.data_inicio = nowBR();
  return updateOrder(ordem);
}
async function finishOrder(id, payload={}){
  const ordem = await getOrder(id);
  if(!ordem) throw new Error('OS não encontrada.');
  ordem.status = payload.status || 'FINALIZADA';
  ordem.data_fim = nowBR();
  ordem.causa_raiz = payload.causa_raiz || ordem.causa_raiz || '';
  ordem.componente = payload.componente || ordem.componente || '';
  ordem.observacao_fechamento = payload.observacao_fechamento || ordem.observacao_fechamento || '';
  ordem.o_que_feito = payload.o_que_feito || ordem.o_que_feito || '';
  ordem.o_que_falta = payload.o_que_falta || ordem.o_que_falta || '';
  ordem.pendente = !!payload.pendente;
  ordem.os_origem = payload.os_origem || ordem.os_origem || null;
  return updateOrder(ordem);
}
async function deleteOrder(id){
  await rest(`ordens?id_os=eq.${Number(id)}`, { method:'DELETE' });
  notifyChange();
}
async function exportBackup(){
  return {
    exported_at: nowBR(),
    structure: STRUCTURE_TAG,
    lists: await getLists(),
    ordens: await getAllOrders()
  };
}
async function importBackup(backup){
  if(backup?.lists) await setLists(backup.lists);
  if(Array.isArray(backup?.ordens)){
    for(const ordem of backup.ordens){
      const exists = await getOrder(ordem.id_os);
      if(exists){
        await updateOrder(ordem, true);
      } else {
        await rest('ordens', {
          method:'POST',
          headers: { 'Content-Type':'application/json', 'Prefer':'return=representation' },
          body: JSON.stringify(ordem)
        });
      }
    }
    notifyChange();
  }
}
function notifyChange(){
  if(channel){
    try { channel.postMessage({ type:'changed', at: Date.now() }); } catch(_) {}
  }
}
function onExternalChange(cb){
  if(channel){
    channel.onmessage = (event)=>{
      if(event?.data?.type === 'changed') cb?.();
    };
  }
  setInterval(()=>cb?.(), POLL_INTERVAL_MS);
}

window.PCMDB = {
  initDB,
  getLists,
  setLists,
  getAllOrders,
  getOrder,
  addOrder,
  updateOrder,
  startOrder,
  finishOrder,
  deleteOrder,
  exportBackup,
  importBackup,
  notifyChange,
  onExternalChange,
  subscribeChanges: onExternalChange,
  nowBR,
  elapsedHHMM,
  escapeHtml,
  priorityClass
};
