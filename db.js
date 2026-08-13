// My Workboard V7 database bootstrap
// My Workboard V6 database bootstrap
// My Workboard V5 database bootstrap
// My Workboard V4 database bootstrap

const DB_NAME='my_workboard_db', DB_VERSION=5; let db;
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv',{keyPath:'key'})};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
function dbSet(key,value){return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put({key,value});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function dbGet(key){return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readonly'),r=tx.objectStore('kv').get(key);r.onsuccess=()=>resolve(r.result?.value);r.onerror=()=>reject(r.error)})}
