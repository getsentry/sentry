export async function loadPrismLanguage(
  language: string,
  onLoad?: () => void,
  onError?: (error) => void
) {
  try {
    await import(`prismjs/components/prism-${language}.min`);
    onLoad?.();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Cannot find Prism language file for \`${language}\`. Check the \`language\` argument passed to \`loadPrismLanguage()\`.`
    );
    onError?.(error);
  }
}
