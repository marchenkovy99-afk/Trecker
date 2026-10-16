(() => {
  'use strict';

  // Only the old cloud login is retired; all local records and pending edits stay intact.
  const projectRef = 'qwnkigorqsgugcctnfmj';
  if (localStorage.getItem('lawyerCloudProject') !== projectRef) {
    localStorage.removeItem('lawyerCloudSession');
    localStorage.setItem('lawyerCloudProject', projectRef);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      document.head.append(script);
    });
  }

  async function loadCloudCoreWithoutCalendar() {
    const calendarKey = LS.calendarEvents;
    LS.calendarEvents = `${calendarKey}__cloud-disabled`;
    try {
      await loadScript('sync-core.js?v=20261016-new-cloud-1');
    } finally {
      LS.calendarEvents = calendarKey;
    }
  }

  // Cloud modules are isolated so a network or Supabase failure cannot disable local UI modules.
  loadScript('sync-recovery.js?v=20261016-new-cloud-1')
    .then(() => window.lawyerCloudRecoveryReady || Promise.resolve())
    .then(() => loadScript('sync-diagnostic.js?v=20261016-new-cloud-1'))
    .then(() => loadCloudCoreWithoutCalendar())
    .then(() => loadScript('calendar-cloud-bridge.js?v=20260831-calendar-cloud-1'))
    .catch(error => console.error('Cloud sync module loading failed', error));
})();
