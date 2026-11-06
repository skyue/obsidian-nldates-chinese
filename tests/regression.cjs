const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moment = require('moment');
global.window = {moment};
const controls = new Proxy({}, {get:(_target,key)=> key==='then'?undefined:(...args)=>{ if(typeof args[0]==='function') args[0](controls); return controls; }});
class Setting { constructor(){ return controls; } }
class PluginSettingTab { constructor(){this.containerEl={empty(){}};} }
class EditorSuggest { constructor(){this.scope={register(){}};} setInstructions(){} close(){} }
const cache = new Map();
function load(file){
 file=path.resolve(file); if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const code=ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017,esModuleInterop:true});
 const localRequire=id=> id==='obsidian'?{moment,EditorSuggest,Setting,PluginSettingTab,normalizePath:x=>x}:id.startsWith('src/')?load(id+'.ts'):id.startsWith('.')?load(path.resolve(path.dirname(file),id)+'.ts'):require(id);
 new Function('require','exports',code)(localRequire,exports);return exports;
}
const {parseHoliday}=load('src/holidays.ts');
let checks=0;const ymd=d=>moment(d).format('YYYY-MM-DD');
for(const [input,expected] of [['2024年春节','2024-02-10'],['2025年除夕','2025-01-28'],['2024年除夕','2024-02-09'],['2024年端午节','2024-06-10'],['2024年中秋','2024-09-17'],['2024年清明','2024-04-04'],['2024年冬至','2024-12-21'],['2027年春節','2027-02-06']]){assert.equal(ymd(parseHoliday(input).date),expected);checks++;}
for(let year=1900;year<=2100;year++)for(const name of ['春节','元宵','端午','七夕','中秋','重阳','腊八','除夕','清明','冬至']){const value=parseHoliday(`${year}年${name}`);if (!Number.isNaN(value.date.getTime())) assert.equal(value.date.getFullYear(),year,`${year}${name}`); else assert.equal(name,"腊八");checks++;}
const Parser=load('src/parser.ts').default;const parser=new Parser();
for(const [input,offset] of [['今天',0],['明天',1],['昨天',-1],['后天',2],['大前天',-3],['3天后',3]]){assert.equal(ymd(parser.getParsedDate(input,'monday')),moment().add(offset,'days').format('YYYY-MM-DD'));checks++;}
const {getDateCandidates}=load('src/suggest/date-candidates.ts');
const ref=new Date(2026,10,1);
assert.deepEqual(getDateCandidates('周二',ref,1).map(x=>ymd(x.date)),['2026-10-27','2026-11-03','2026-10-20']);
assert.equal(getDateCandidates('31号',ref,1).length,2);assert.equal(getDateCandidates('2月30日',ref,1).length,0);
const Suggest=load('src/suggest/date-suggest.ts').default;
const app={vault:{getConfig:()=>false}};const plugin={settings:{weekStart:'monday',format:'YYYY-MM-DD',autosuggestToggleLink:true},parseDate:s=>({date:parser.getParsedDate(s,'monday')})};
const suggest=new Suggest(app,plugin);
for(const query of ['今天','明天','下周二','3天后','中秋','2027年春节']){const values=suggest.getSuggestions({query});assert.ok(values.length);for(const value of values){let rendered='';suggest.renderSuggestion(value,{setText:s=>rendered=s});assert.ok(rendered.includes(ymd(value.date)));let inserted='';suggest.context={query,start:{},end:{},editor:{replaceRange:s=>inserted=s}};suggest.selectSuggestion(value,{shiftKey:false});assert.equal(inserted,`[[${ymd(value.date)}|${query}]]`);suggest.selectSuggestion(value,{shiftKey:true});assert.equal(inserted,`[[${ymd(value.date)}]]`);checks+=3;}}
const {NLDSettingsTab,DEFAULT_SETTINGS}=load('src/settings.ts');
const settingsTab=new NLDSettingsTab(app,{settings:{...DEFAULT_SETTINGS},saveSettings:async()=>{}});
assert.equal(settingsTab.getSettingDefinitions().length,8);
settingsTab.display(); checks+=2;
console.log(`${checks} regression checks passed`);
