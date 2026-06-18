const KEY = 'treasure-collection';

export function loadTreasures() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTreasures(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Storage full:', err);
  }
}

export async function toPersistableUrl(url) {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function persistTreasure(url) {
  const dataUrl = await toPersistableUrl(url);
  const list = loadTreasures();
  list.push(dataUrl);
  saveTreasures(list);
  return { count: list.length, dataUrl };
}

export function clearTreasures() {
  localStorage.removeItem(KEY);
}