import * as Sentry from '@sentry/react';
import * as moment from 'moment';
import * as qs from 'query-string';

import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import {Config} from 'sentry/types';

// zh-cn => zh_CN
function convertToDjangoLocaleFormat(language: string) {
  const [left, right] = language.split('-');
  return left + (right ? '_' + right.toUpperCase() : '');
}

async function getTranslations(language: string) {
  language = convertToDjangoLocaleFormat(language);

  // No need to load the english locale
  if (language === 'en') {
    return DEFAULT_LOCALE_DATA;
  }

  try {
    return await import(`sentry-locale/${language}/LC_MESSAGES/django.po`);
  } catch (e) {
    Sentry.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['sentry-locale-not-found']);
      scope.setExtra('locale', language);
      Sentry.captureException(e);
    });

    // Default locale if not found
    return DEFAULT_LOCALE_DATA;
  }
}

/**
 * Initialize locale
 *
 * This *needs* to be initialized as early as possible (e.g. before `app/locale` is used),
 * otherwise the rest of the application will fail to load.
 *
 * Priority:
 *
 * - URL params (`?lang=en`)
 * - User configuration options
 * - User's system language code (from request)
 * - "en" as default
 */
export async function initializeLocale(config: Config) {
  let queryString: qs.ParsedQuery = {};

  // Parse query string for `lang`
  try {
    queryString = qs.parse(window.location.search) || {};
  } catch {
    // ignore if this fails to parse
    // this can happen if we have an invalid query string
    // e.g. unencoded "%"
  }

  const queryStringLang = Array.isArray(queryString.lang)
    ? queryString.lang[0]
    : queryString.lang;
  const languageCode =
    queryStringLang || config.user?.options?.language || config.languageCode || 'en';

  try {
    const translations = await getTranslations(languageCode);
    setLocale(translations);

    // No need to import english
    if (languageCode !== 'en') {
      await import(`moment/locale/${languageCode}`);
      moment.locale(languageCode);
    }
  } catch (err) {
    Sentry.captureException(err);
  }
}
