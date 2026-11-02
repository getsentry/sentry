import Prism from 'prismjs';
import prismComponents from 'prismjs/components.js';

type PrismLanguageDefinition = {
  alias?: string | string[];
  require?: string | string[];
};

const prismLanguages = prismComponents.languages as Record<
  string,
  PrismLanguageDefinition
>;

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
  Object.entries(prismLanguages).flatMap(([lang, value]) => {
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
  rabl: 'ruby',

  // JS
  cjs: 'javascript',
  mjs: 'javascript',
  jsbundle: 'javascript',
  bundle: 'javascript',
  astro: 'javascript',
  vue: 'javascript',
  svelte: 'javascript',
  'js?': 'javascript',
  'ts?': 'typescript',
  'tsx?': 'tsx',
  mts: 'typescript',

  // Clojure
  clj: 'clojure',
  cljc: 'clojure',
  cljs: 'clojure',

  // Php
  php5: 'php',
  phtml: 'php',

  // Various
  // Flutter ARB file .arb is a JSON file
  arb: 'json',
  ps1: 'powershell',
  jinja: 'jinja2',
  // Godot Script - e.g: "file": "res://script_with_errors.gd"
  gd: 'gdscript',
};

export const getPrismLanguage = (lang: string) => {
  const language = lang.toLowerCase();

  const aliased = EXTRA_LANGUAGE_ALIASES[language];

  return PRISM_LANGUAGE_MAP[aliased ?? language];
};

// Grammars attach themselves to Prism's shared registry. Load dependencies first
// and share in-flight imports when several snippets request the same language.
const pendingGrammars = new Map<string, Promise<void>>();

function loadGrammar(language: string): Promise<void> {
  if (Prism.languages[language]) {
    return Promise.resolve();
  }

  const pending = pendingGrammars.get(language);
  if (pending) {
    return pending;
  }

  const load = async () => {
    const required = prismLanguages[language]?.require;
    const dependencies = Array.isArray(required) ? required : required ? [required] : [];
    for (const dependency of dependencies) {
      await loadGrammar(dependency);
    }
    await import(`prismjs/components/prism-${language}.min.js`);
  };
  const promise = load().finally(() => pendingGrammars.delete(language));
  pendingGrammars.set(language, promise);
  return promise;
}

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
    onError?: (error: unknown) => void;
    onLoad?: () => void;
    suppressExistenceWarning?: boolean;
  }
) {
  try {
    const language = getPrismLanguage(lang);

    // Short-circuit if language already loaded
    if (language && Prism.languages[language]) {
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
      // to make sure the async call gets resolved and unformatted text shows up instead of hanging
      onError?.(new Error(`No Prism grammar file for \`${lang}\` exists.`));
      return;
    }

    await loadGrammar(language);

    onLoad?.();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Cannot download Prism grammar file for \`${lang}\`. Check the internet connection, and the \`lang\` argument passed to \`loadPrismLanguage()\`.`
    );
    onError?.(error);
  }
}
