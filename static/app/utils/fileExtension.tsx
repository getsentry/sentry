const FILE_EXTENSION_TO_PLATFORM = {
  jsx: 'javascript-react',
  tsx: 'javascript-react',
  js: 'javascript',
  ts: 'javascript',
  php: 'php',
  py: 'python',
  vue: 'vue',
  go: 'go',
  java: 'java',
  perl: 'perl',
  rb: 'ruby',
  rs: 'rust',
  rlib: 'rust',
  swift: 'swift',
  m: 'apple',
  mm: 'apple',
  M: 'apple',
  ex: 'elixir',
  exs: 'elixir',
  cs: 'csharp',
  fs: 'fsharp',
  vb: 'visualbasic',
  ps1: 'powershell',
  psd1: 'powershell',
  psm1: 'powershell',
  kt: 'kotlin',
  dart: 'dart',
  sc: 'scala',
  scala: 'scala',
  clj: 'clojure',
};

/**
 * Takes in path (/Users/test/sentry/something.jsx) and returns file extension (jsx)
 */
export function getFileExtension(fileName: string): string | undefined {
  // this won't work for something like .spec.jsx
  const segments = fileName.split('.');
  if (segments.length > 1) {
    return segments.pop();
  }
  return undefined;
}

/**
 * Takes in file extension and returns a platform string that can be passed into platformicons
 */
export function fileExtensionToPlatform(fileExtension: string): string | undefined {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return FILE_EXTENSION_TO_PLATFORM[fileExtension];
}
