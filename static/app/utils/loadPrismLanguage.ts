import prismComponents from 'prismjs/components';

/**
 * A mapping object containing all Prism languages/aliases that can be loaded using
 * `loadPrismLanguage`. Maps language aliases (`js`) to the full language name
 * (`javascript`).
 */
export const prismLanguageMap: Record<string, string> = Object.fromEntries(
  Object.entries(prismComponents.languages)
    .map(([lang, value]) => {
      if (!value.alias) {
        return [[lang, lang]]; // map the full language name to itself
      }

      return [
        [lang, lang], // map the full language name to itself
        ...(Array.isArray(value.alias) // map aliases to full language name
          ? value.alias.map(alias => [alias, lang])
          : [[value.alias, lang]]),
      ];
    })
    .flat(1)
);

/**
 * Loads the specified Prism language (aliases like `js` for `javascript` also work).
 * Will log a warning if a) the language doesn't exist (unless `suppressExistenceWarning`
 * is true) or b) there was a problem downloading the grammar file.
 */
export async function loadPrismLanguage(
  lang: string,
  {
    onError,
    onLoad,
    suppressExistenceWarning,
  }: {
    onError?: (error) => void;
    onLoad?: () => void;
    suppressExistenceWarning?: boolean;
  }
) {
  try {
    const language = prismLanguageMap[lang];

    // If Prism doesn't have any grammar file available for the language
    if (!language) {
      if (!suppressExistenceWarning) {
        // eslint-disable-next-line no-console
        console.warn(
          `No Prism grammar file for \`${lang}\` exists. Check the \`lang\` argument passed to \`loadPrismLanguage()\`.`
        );
      }

      return;
    }

    await import(`prismjs/components/prism-${language.toLowerCase()}.min`);
    onLoad?.();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Cannot download Prism grammar file for \`${lang}\`. Check the internet connection, and the \`lang\` argument passed to \`loadPrismLanguage()\`.`
    );
    onError?.(error);
  }
}
