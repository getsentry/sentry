import {CSRF_COOKIE_NAME} from 'app/constants';
import getCookie from 'app/utils/getCookie';

function csrfSafeMethod(method?: string) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method ?? '');
}

export default function ajaxCsrfSetup(
  this: JQueryAjaxSettings,
  xhr: JQueryXHR,
  settings: JQueryAjaxSettings
) {
  if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
    xhr.setRequestHeader('X-CSRFToken', getCookie(CSRF_COOKIE_NAME) ?? '');
  }
}
