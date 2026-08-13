
const DB_NAME = 'my_workboard_db';
const DB_VERSION = 1;
let db;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e=>{
      const d = e.target.result;
      if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv',{keyPath:'key'});
    };
    req.onsuccess = ()=>{ db=req.result; resolve(db); };
    req.onerror = ()=>reject(req.error);
  });
}
function dbSet(key,value){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('kv','readwrite');
    tx.objectStore('kv').put({key,value});
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
function dbGet(key){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('kv','readonly');
    const req=tx.objectStore('kv').get(key);
    req.onsuccess=()=>resolve(req.result?.value);
    req.onerror=()=>reject(req.error);
  });
}
function dbAll(){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('kv','readonly');
    const req=tx.objectStore('kv').getAll();
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function dbClear(){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('kv','readwrite');
    tx.objectStore('kv').clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
