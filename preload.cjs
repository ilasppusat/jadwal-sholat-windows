/* Jembatan aman renderer ↔ main process (contextIsolation aktif). */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** Koordinat dari layanan lokasi Windows → { lat, lon } atau { error }. */
  locate: () => ipcRenderer.invoke('desktop:locate'),
  /** Notifikasi native Windows (tetap tampil walau jendela tersembunyi di tray). */
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  /** Teks tooltip ikon tray (mis. hitung mundur). */
  setTrayTitle: (text) => ipcRenderer.send('desktop:title', text),
});
