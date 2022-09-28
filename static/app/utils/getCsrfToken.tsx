import Cookies from 'js-cookie';

export default function getCsrfToken() {
  return Cookies.get(window.csrfCookieName ?? 'sc') ?? '';
}
