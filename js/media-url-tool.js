import { auth, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const $ = id => document.getElementById(id);
const fileInput = $('media-file');
const uploadButton = $('media-upload-button');
const resetButton = $('media-reset-button');
const output = $('media-url-output');
const copyButton = $('media-copy-url');
const status = $('media-status');
const previewWrap = $('media-preview-wrap');
const imagePreview = $('media-image-preview');
const videoPreview = $('media-video-preview');
let currentFile = null;
let signedIn = false;
let previewObjectUrl = '';

function setStatus(message, error = false) {
  if (!status) return;
  status.textContent = message;
  status.style.color = error ? '#a32222' : '';
}

function clearPreview() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
  imagePreview.hidden = true;
  videoPreview.hidden = true;
  imagePreview.removeAttribute('src');
  videoPreview.removeAttribute('src');
  previewWrap.hidden = true;
}

function reset() {
  currentFile = null;
  fileInput.value = '';
  $('media-filename').value = '';
  output.value = '';
  copyButton.disabled = true;
  uploadButton.disabled = !signedIn;
  clearPreview();
  setStatus(signedIn ? 'Choose a file to get started.' : 'Sign in to the admin panel to upload media.');
}

function safeFileName(name) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'media-file';
}

fileInput?.addEventListener('change', () => {
  clearPreview();
  output.value = '';
  copyButton.disabled = true;
  currentFile = fileInput.files?.[0] || null;
  if (!currentFile) {
    setStatus('Choose a file to get started.');
    return;
  }
  if (!(currentFile.type.startsWith('image/') || currentFile.type.startsWith('video/'))) {
    currentFile = null;
    fileInput.value = '';
    setStatus('Please choose an image or video file.', true);
    return;
  }
  if (currentFile.size > 50 * 1024 * 1024) {
    currentFile = null;
    fileInput.value = '';
    setStatus('This file is over 50 MB. Please compress it or choose a smaller file.', true);
    return;
  }
  previewObjectUrl = URL.createObjectURL(currentFile);
  previewWrap.hidden = false;
  if (currentFile.type.startsWith('video/')) {
    videoPreview.src = previewObjectUrl;
    videoPreview.hidden = false;
  } else {
    imagePreview.src = previewObjectUrl;
    imagePreview.hidden = false;
  }
  $('media-filename').value = currentFile.name.replace(/\.[^.]+$/, '');
  setStatus('Ready: ' + currentFile.name + ' (' + (currentFile.size / (1024 * 1024)).toFixed(2) + ' MB).');
});

uploadButton?.addEventListener('click', async () => {
  if (!currentFile) {
    setStatus('Choose an image or video file first.', true);
    return;
  }
  if (!auth.currentUser || !signedIn) {
    setStatus('Your admin session is not signed in. Sign in again and retry.', true);
    return;
  }
  const file = currentFile;
  const baseName = $('media-filename').value.trim() || file.name.replace(/\.[^.]+$/, '');
  const extension = (file.name.match(/\.([a-zA-Z0-9]{1,8})$/) || [])[1] || (file.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  const storedName = safeFileName(baseName) + '-' + Date.now() + '.' + safeFileName(extension);
  const storagePath = 'media/' + auth.currentUser.uid + '/' + storedName;
  uploadButton.disabled = true;
  resetButton.disabled = true;
  fileInput.disabled = true;
  copyButton.disabled = true;
  setStatus('Uploading… 0%');
  try {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: { originalName: file.name, uploadedFor: 'Jija Studio admin media URL converter' }
    });
    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { task.cancel(); } catch {}
        reject(new Error('Upload made no confirmed progress for 45 seconds. Check Firebase Storage setup, security rules, billing/quota, and your internet connection.'));
      }, 45000);
      task.on('state_changed',
        snapshot => {
          const percent = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
          setStatus('Uploading… ' + percent + '%');
        },
        error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error);
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
      );
    });
    const url = await getDownloadURL(task.snapshot.ref);
    output.value = url;
    copyButton.disabled = false;
    setStatus('Upload complete! Copy the URL and paste it into any image or video URL field.');
  } catch (error) {
    console.error('Media upload failed:', error);
    let message = error.code || error.message || 'Unknown upload error';
    if (String(error.message || '').includes('45 seconds')) {
      message = error.message + ' If Storage has never been enabled, open Firebase Console → Build → Storage → Get started and create the bucket first.';
    } else if (error.code === 'storage/unauthorized' || error.code === 'storage/unauthenticated') {
      message = 'Firebase Storage blocked this upload. Update Firebase Storage rules to allow write access for your signed-in admin UID, then retry.';
    } else if (error.code === 'storage/bucket-not-found') {
      message = 'Firebase Storage bucket was not found. Open Firebase Console → Storage and finish setting up the Storage bucket for this project.';
    } else if (error.code === 'storage/quota-exceeded') {
      message = 'Firebase Storage quota has been exceeded. Check the project billing and Storage usage.';
    }
    setStatus('Upload failed: ' + message, true);
  } finally {
    uploadButton.disabled = !signedIn;
    resetButton.disabled = false;
    fileInput.disabled = false;
  }
});

copyButton?.addEventListener('click', async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    setStatus('URL copied. Paste it into any Jija Studio image or video URL field.');
  } catch {
    output.focus();
    output.select();
    const copied = document.execCommand('copy');
    setStatus(copied ? 'URL copied. Paste it into any image or video URL field.' : 'Select the URL in the box and copy it manually.', !copied);
  }
});

resetButton?.addEventListener('click', reset);
onAuthStateChanged(auth, user => {
  signedIn = Boolean(user);
  if (uploadButton && !uploadButton.dataset.uploading) uploadButton.disabled = !signedIn;
  if (!signedIn) setStatus('Sign in to the admin panel to upload media.');
});
