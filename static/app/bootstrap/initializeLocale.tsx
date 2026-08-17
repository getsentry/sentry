import * as Sentry from '@sentry/react';
import * as moment from 'moment-timezone';
import * as qs from 'query-string';

import {DEFAULT_LOCALE_DATA, setLocale} from 'sentry/locale';
import type {Config} from 'sentry/types/system';
import {setUwuEnabled, UWU_LANGUAGE_CODE} from 'sentry/utils/uwu';

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
 * The generated catalog already holds uwu-ified strings, so the runtime
 * transform has to stay off when it loads or every string is transformed twice.
 * It is only a fallback for a build that skipped `pnpm gen:uwu-catalog`.
 */
async function initializeUwuLocale() {
  try {
    setLocale(await import(`sentry-locale/${UWU_LANGUAGE_CODE}/LC_MESSAGES/django.po`));
  } catch {
    setLocale(DEFAULT_LOCALE_DATA);
    setUwuEnabled(true);
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
    if (languageCode === UWU_LANGUAGE_CODE) {
      await initializeUwuLocale();
    } else if (languageCode === 'en') {
      const translations = await getTranslations(languageCode);
      setLocale(translations);
    } else {
      const [translations, momentLocaleLoaded] = await Promise.all([
        getTranslations(languageCode),
        import(`moment/locale/${languageCode}`).then(
          () => true,
          () => false
        ),
      ]);
      setLocale(translations);
      if (momentLocaleLoaded) {
        moment.locale(languageCode);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
  }
}
