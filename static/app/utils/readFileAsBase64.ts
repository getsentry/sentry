export function readFileAsBase64(
  file: File,
  onLoad: (content: string | undefined) => void,
  onError?: () => void
) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    onLoad((reader.result as string).split(',')[1]);
  });
  if (onError) {
    reader.addEventListener('error', onError);
  }
  reader.readAsDataURL(file);
}
