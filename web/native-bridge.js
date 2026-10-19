/* Browser-only preview fallback. `npm run build` replaces this with the bundled native Capacitor bridge. */
window.TeacherNativeBackup={available:false,share:async()=>{throw Error('Native sharing requires the installed iPhone app.')}};
