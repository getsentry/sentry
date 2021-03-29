import getCookie from 'app/utils/getCookie';

export default function getCsrfToken() {
  return getCookie(window.csrfCookieName ?? 'sc') ?? '';
}
