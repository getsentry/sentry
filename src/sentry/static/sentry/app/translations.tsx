import * as Sentry from '@sentry/react';

// zh-cn => zh_CN
function convertToDjangoLocaleFormat(language: string) {
  const [left, right] = language.split('-');
  return left + (right ? '_' + right.toUpperCase() : '');
}

export function getTranslations(language: string) {
  language = convertToDjangoLocaleFormat(language);

  try {
    return require(`sentry-locale/${language}/LC_MESSAGES/django.po`);
  } catch (e) {
    Sentry.withScope(scope => {
      scope.setLevel(Sentry.Severity.Warning);
      scope.setFingerprint(['sentry-locale-not-found']);
      scope.setExtra('locale', language);
      Sentry.captureException(e);
    });

    // Default locale if not found
    return require('sentry-locale/en/LC_MESSAGES/django.po');
  }
}
