import Cookies from 'js-cookie';

export function getCsrfToken() {
  return Cookies.get(globalThis.csrfCookieName ?? 'sc') ?? '';
}
