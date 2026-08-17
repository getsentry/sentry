import {localStorageWrapper} from 'sentry/utils/localStorage';

export const UWU_LANGUAGE_CODE = 'uwu';

const UWU_STORAGE_KEY = 'uwu';

const UWU_MAP: Array<[RegExp, string]> = [
  [/(?:r|l)/g, 'w'],
  [/(?:R|L)/g, 'W'],
  [/n([aeiou])/g, 'ny$1'],
  [/N([aeiou])/g, 'Ny$1'],
  [/N([AEIOU])/g, 'Ny$1'],
  [/ove/g, 'uv'],
];

/**
 * Must stay stable: a given input always maps to the same output. Every rule is
 * an unconditional replacement, so nothing here may consult a random source.
 */
export function uwuify(text: string): string {
  return UWU_MAP.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text
  );
}

function readUwuEnabled(): boolean {
  if (localStorageWrapper.getItem(UWU_STORAGE_KEY) === '1') {
    return true;
  }

  try {
    return new URLSearchParams(window.location.search).get('lang') === UWU_LANGUAGE_CODE;
  } catch {
    return false;
  }
}

export const UWU_ENABLED = readUwuEnabled();

export function toggleUwu() {
  const next = localStorageWrapper.getItem(UWU_STORAGE_KEY) !== '1';
  localStorageWrapper.setItem(UWU_STORAGE_KEY, next ? '1' : '0');
  window.location.reload();
}
