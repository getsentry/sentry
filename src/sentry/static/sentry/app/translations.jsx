export const translations = (function() {
  let ctx = require.context('../../../locale/', true, /\.po$/);
  let rv = {};
  ctx.keys().forEach((translation) => {
    let langCode = translation.match(/([a-zA-Z_]+)/)[1];
    rv[langCode] = ctx(translation);
  });
  return rv;
})();

export function getTranslations(language) {
  return translations[language] || translations.en;
}

export function translationsExist(language) {
  return translations[language] !== undefined;
}
