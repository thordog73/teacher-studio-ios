import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isNative = Capacitor.isNativePlatform();
function toB64(bytes) {
  let s = '';
  for(let i=0; i<bytes.length; i+=8192) {
    s += String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(s);
}

// Passphrase encryption is performed BEFORE this bridge is invoked by the existing storage.js.
// Never accept cleartext lesson files or student records here. No remote upload is performed.
async function shareEncryptedBackup(name, blob) {
  if(!isNative) throw Error('Native sharing is available in the installed app only.');
  if(!(blob instanceof Blob)) throw Error('An encrypted backup file is required.');
  if(blob.size < 60) throw Error('The encrypted backup is incomplete.');
  const filename = String(name).replace(/[^A-Za-z0-9_.-]/g,'_');
  if(!filename.endsWith('.tsbackup')) throw Error('Not a Teacher Studio backup file.');
  const path = 'TeacherStudioBackups/' + filename;
  // Filesystem saves user-initiated copy under Documents on iPhone, an app-owned path.
  // This is NOT a claim that a separate iCloud/Drive copy has been made.
  await Filesystem.writeFile({path, data:'', directory:Directory.Documents, recursive:true});
  const chunkSize=128*1024;
  try {
    for(let start=0;start<blob.size;start+=chunkSize){
      const bytes=new Uint8Array(await blob.slice(start,start+chunkSize).arrayBuffer());
      await Filesystem.appendFile({path, data:toB64(bytes), directory:Directory.Documents});
    }
    const {uri} = await Filesystem.getUri({path, directory:Directory.Documents});
    await Share.share({title:'Teacher Studio encrypted backup', files:[uri], dialogTitle:'Save backup outside this phone'});
  }catch(err){
    // Fail closed: the user is told the share did not finish, and no saved status is recorded.
    throw err;
  }
  return {preparedOnDevice:true, savedOutsideDevice:false};
}
window.TeacherNativeBackup=Object.freeze({available:isNative, share:shareEncryptedBackup});
