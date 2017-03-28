import cookies from './cookies';

export default {
  signOut: function () {
    let form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', '/auth/logout/');
    let input = document.createElement('input');
    input.setAttribute('name', 'csrfmiddlewaretoken');
    input.setAttribute('value', cookies.get(window.csrfCookieName || 'sc'));
    input.setAttribute('type', 'hidden');
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }
};
