import Prism from 'prismjs';
import prismComponents from 'prismjs/components';

/**
 * Without this, Prism will call highlightAll() automatically on page load.
 * We call highlightElement() when necessary so this is both unnecessary and
 * can lead to issues when loading a page in a background tab.
 *
 * See https://prismjs.com/docs/Prism.html#.manual
 */
Prism.manual = true;

/**
 * A mapping object containing all Prism languages/aliases that can be loaded using
 * `loadPrismLanguage`. Maps language aliases (`js`) to the full language name
 * (`javascript`).
 */
const PRISM_LANGUAGE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(prismComponents.languages).flatMap(([lang, value]) => {
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
);

// Aliases that don't already exist in Prism.js
// https://prismjs.com/#supported-languages
const EXTRA_LANGUAGE_ALIASES: Record<string, string> = {
  cc: 'cpp',
  erl: 'erlang',
  ex: 'elixir',
  h: 'c',
  m: 'objectivec',
  pl: 'perl',
  pm: 'perl',
  pyx: 'python',
  rs: 'rust',

  // Ruby
  jbuilder: 'ruby',
  ru: 'ruby',
  rake: 'ruby',

  // JS
  cjs: 'javascript',
  mjs: 'javascript',
  jsbundle: 'javascript',
  bundle: 'javascript',
  vue: 'javascript',
  svelte: 'javascript',
  'js?': 'javascript',

  // Clojure
  clj: 'clojure',
  cljc: 'clojure',
  cljs: 'clojure',
};

export const getPrismLanguage = (lang: string) => {
  const language = lang.toLowerCase();

  const aliased = EXTRA_LANGUAGE_ALIASES[language];

  return PRISM_LANGUAGE_MAP[aliased ?? language];
};

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
    const language: string | undefined = getPrismLanguage(lang);

    // Short-circuit if language already loaded
    if (Prism.languages[language!]) {
      onLoad?.();
      return;
    }

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

    // Check for dependencies (e.g. `php` requires `markup-templating`) & download them
    const deps: string[] | string | undefined =
      prismComponents.languages[language].require;
    const depsArray = Array.isArray(deps) ? deps : [deps];
    await Promise.all(
      depsArray.map(dep => {
        if (!dep) {
          return Promise.resolve();
        }

        return import(`prismjs/components/prism-${dep}.min`);
      })
    );

    // Download language grammar file
    await import(`prismjs/components/prism-${language}.min`);

    onLoad?.();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Cannot download Prism grammar file for \`${lang}\`. Check the internet connection, and the \`lang\` argument passed to \`loadPrismLanguage()\`.`
    );
    onError?.(error);
  }
}
