const FILE_EXTENSION_TO_PLATFORM = {
  jsx: 'react',
  tsx: 'react',
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
  h: 'apple',
  m: 'apple',
  mm: 'apple',
  M: 'apple',
  cs: 'csharp',
  ex: 'elixir',
  exs: 'elixir',
  fs: 'fsharp',
};

/**
 * Takes in path (/Users/test/sentry/something.jsx) and returns file extension (jsx)
 */
export function getFileExtension(fileName: string): string | undefined {
  // this won't work for something like .spec.jsx
  return fileName.split('.').pop();
}

/**
 * Takes in file extension and returns a platform string that can be passed into platformicons
 */
export function fileExtensionToPlatform(fileExtension: string): string | undefined {
  return FILE_EXTENSION_TO_PLATFORM[fileExtension];
}
