/* Local-only data storage (browser localStorage). Nothing is sent over the network. */
(function (root) {
  'use strict';
  var KEY = 'pbcc_experiment_v3b_skyblue';   // separate namespace: Version 1/2 data are never read or modified
  function empty() { return { version: 1, sessions: {}, activeSessionId: null }; }
  function load() {
    try { var raw = root.localStorage.getItem(KEY); if (!raw) return empty(); var db = JSON.parse(raw); if (!db.sessions) return empty(); return db; }
    catch (e) { console.error('Could not read stored data', e); return empty(); }
  }
  function save(db) {
    try { root.localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { console.error('Could not save data', e); alert('Warning: the browser refused to save data (storage full or blocked). Please tell the researcher.'); return false; }
  }
  function getSession(id) { var db = load(); return db.sessions[id] || null; }
  function getActive() { var db = load(); return db.activeSessionId ? db.sessions[db.activeSessionId] || null : null; }
  function putSession(s) { var db = load(); db.sessions[s.id] = s; return save(db); }
  function setActive(id) { var db = load(); db.activeSessionId = id; return save(db); }
  function deleteSession(id) { var db = load(); delete db.sessions[id]; if (db.activeSessionId === id) db.activeSessionId = null; return save(db); }
  function deleteTestSessions() {
    var db = load(), n = 0;
    Object.keys(db.sessions).forEach(function (id) { if (db.sessions[id].kind !== 'real') { delete db.sessions[id]; n++; if (db.activeSessionId === id) db.activeSessionId = null; } });
    save(db); return n;
  }
  function all() { var db = load(); return Object.keys(db.sessions).map(function (k) { return db.sessions[k]; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }); }
  function exportAll() { return JSON.stringify(load(), null, 1); }
  root.PBCC_STORE = { KEY: KEY, load: load, save: save, getSession: getSession, getActive: getActive, putSession: putSession, setActive: setActive,
    deleteSession: deleteSession, deleteTestSessions: deleteTestSessions, all: all, exportAll: exportAll };
})(window);
