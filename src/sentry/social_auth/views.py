from __future__ import absolute_import, print_function


from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.http import is_safe_url

from social_auth.decorators import dsa_view, disconnect_view
from social_auth.utils import setting, backend_setting, clean_partial_pipeline


DEFAULT_REDIRECT = setting('SOCIAL_AUTH_LOGIN_REDIRECT_URL',
                           setting('LOGIN_REDIRECT_URL'))


@login_required
@dsa_view()
@disconnect_view
def disconnect(request, backend, association_id=None):
    """Disconnects given backend from current logged in user."""
    backend.disconnect(request.user, association_id)
    data = request.REQUEST
    if REDIRECT_FIELD_NAME in data:
        redirect = data[REDIRECT_FIELD_NAME]
        # NOTE: Django's `is_safe_url` is much better at catching bad
        # redirections to different domains than social_auth's
        # `sanitize_redirect` call.
        if not is_safe_url(redirect, host=request.get_host()):
            redirect = DEFAULT_REDIRECT
    else:
        redirect = backend_setting(backend, 'SOCIAL_AUTH_DISCONNECT_REDIRECT_URL')
        if not redirect:
            redirect = DEFAULT_REDIRECT
    return HttpResponseRedirect(redirect)


@dsa_view(setting('SOCIAL_AUTH_COMPLETE_URL_NAME', 'socialauth_complete'))
def auth(request, backend):
    """Start authentication process"""
    return auth_process(request, backend)


def auth_process(request, backend):
    """Authenticate using social backend"""
    data = request.POST if request.method == 'POST' else request.GET

    # Save extra data into session.
    for field_name in setting('SOCIAL_AUTH_FIELDS_STORED_IN_SESSION', []):
        if field_name in data:
            request.session[field_name] = data[field_name]

    # Save any defined next value into session
    if REDIRECT_FIELD_NAME in data:
        # Check and sanitize a user-defined GET/POST next field value
        redirect = data[REDIRECT_FIELD_NAME]
        # NOTE: Django's `is_safe_url` is much better at catching bad
        # redirections to different domains than social_auth's
        # `sanitize_redirect` call.
        if not is_safe_url(redirect, host=request.get_host()):
            redirect = DEFAULT_REDIRECT
        request.session[REDIRECT_FIELD_NAME] = redirect or DEFAULT_REDIRECT

    # Clean any partial pipeline info before starting the process
    clean_partial_pipeline(request)

    if backend.uses_redirect:
        return HttpResponseRedirect(backend.auth_url())
    else:
        return HttpResponse(backend.auth_html(),
                            content_type='text/html;charset=UTF-8')
