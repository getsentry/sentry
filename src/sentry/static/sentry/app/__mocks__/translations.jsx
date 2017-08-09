export function getTranslations(language) {
  return {
    '': {
      domain: 'the_domain',
      lang: 'en',
      plural_forms: 'nplurals=2; plural=(n != 1);',
    },
  };
}

export function translationsExist(language) {
  return true; // no translations for tests
}
