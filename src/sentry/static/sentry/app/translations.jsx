// zh-cn => zh_CN
function convertToDjangoLocaleFormat(language) {
  let [left, right] = language.split('-');
  return left + (
    right ? '_' + right.toUpperCase() : ''
  );
}

export function getTranslations(language) {
  language = convertToDjangoLocaleFormat(language);
  return require('sentry-locale/' + language + '/LC_MESSAGES/django.po');
}

export function translationsExist(language) {
  language = convertToDjangoLocaleFormat(language);
  try {
    require('sentry-locale/' + language + '/LC_MESSAGES/django.po');
  } catch (e) {
    return false;
  }
  return true;
}
