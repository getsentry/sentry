import getCookie from 'sentry/utils/getCookie';

export default function getCsrfToken() {
  return getCookie(window.csrfCookieName ?? 'sc') ?? '';
}
