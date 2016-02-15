export function getTranslations(language) {
  return language === 'en'
    ? {'':{domain:'sentry'}}
    : require('sentry-locale/' + language + '/LC_MESSAGES/django.po');
}

export function translationsExist(language) {
  try {
    require('sentry-locale/' + language + '/LC_MESSAGES/django.po');
  } catch (e) {
    return false;
  }
  return true;
}
