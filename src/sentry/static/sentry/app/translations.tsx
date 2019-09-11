import * as Sentry from '@sentry/browser';

// zh-cn => zh_CN
function convertToDjangoLocaleFormat(language: string): string {
  const [left, right] = language.split('-');
  return left + (right ? '_' + right.toUpperCase() : '');
}

// TODO(ts): The any return type should be the parsed PO object type
export function getTranslations(language: string): any {
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
