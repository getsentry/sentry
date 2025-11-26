const FIGMA_FILE_URL =
  'https://www.figma.com/design/eTJz6aPgudMY9E6mzyZU0B/🐦-Components';

export function figmaNodeUrl(nodeId: string) {
  const url = new URL(FIGMA_FILE_URL);
  url.searchParams.set('node-id', nodeId);
  return url.toString();
}
