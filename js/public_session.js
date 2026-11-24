/* Public demo: starts a fresh session automatically, so anyone opening the link can run the task.
   Responses stay in this browser's localStorage and are never sent anywhere. */
(function () {
  'use strict';
  var STORE = window.PBCC_STORE, CORE = window.PBCC_CORE;
  var s = STORE.getActive();
  if (!s || s.state.phase === 'complete' || s.state.phase === 'done_by_researcher') {
    s = CORE.createSession({ kind: 'test', practice: 2, confidence: true });
    s.publicDemo = true;
    STORE.putSession(s); STORE.setActive(s.id);
  }
})();
