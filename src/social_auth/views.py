"""Views

Notes:
    * Some views are marked to avoid csrf tocken check because they rely
      on third party providers that (if using POST) won't be sending csrf
      token back.
"""
from __future__ import absolute_import

from django.http import HttpResponseRedirect, HttpResponse
from django.contrib.auth import login, REDIRECT_FIELD_NAME
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import quote

from social_auth.utils import (
    sanitize_redirect, setting, backend_setting, clean_partial_pipeline)
from social_auth.decorators import dsa_view, disconnect_view


DEFAULT_REDIRECT = setting('SOCIAL_AUTH_LOGIN_REDIRECT_URL',
                           setting('LOGIN_REDIRECT_URL'))
LOGIN_ERROR_URL = setting('LOGIN_ERROR_URL', setting('LOGIN_URL'))
PIPELINE_KEY = setting('SOCIAL_AUTH_PARTIAL_PIPELINE_KEY', 'partial_pipeline')


@dsa_view(setting('SOCIAL_AUTH_COMPLETE_URL_NAME', 'socialauth_associate_complete'))
def auth(request, backend):
    """Start authentication process"""
    return auth_process(request, backend)


@csrf_exempt
@dsa_view()
def complete(request, backend, *args, **kwargs):
    """Authentication complete view, override this view if transaction
    management doesn't suit your needs."""
    if request.user.is_authenticated():
        return associate_complete(request, backend, *args, **kwargs)
    else:
        return complete_process(request, backend, *args, **kwargs)


@login_required
def associate_complete(request, backend, *args, **kwargs):
    """Authentication complete process"""
    # pop redirect value before the session is trashed on login()
    redirect_value = request.session.get(REDIRECT_FIELD_NAME, '')
    user = auth_complete(request, backend, request.user, *args, **kwargs)

    if not user:
        url = backend_setting(backend, 'LOGIN_ERROR_URL', LOGIN_ERROR_URL)
    elif isinstance(user, HttpResponse):
        return user
    else:
        url = (
            redirect_value or
            backend_setting(backend, 'SOCIAL_AUTH_NEW_ASSOCIATION_REDIRECT_URL') or
            DEFAULT_REDIRECT
        )
    return HttpResponseRedirect(url)


@login_required
@dsa_view()
@disconnect_view
def disconnect(request, backend, association_id=None):
    """Disconnects given backend from current logged in user."""
    backend.disconnect(request.user, association_id)
    url = (
        request.REQUEST.get(REDIRECT_FIELD_NAME, '') or
        backend_setting(backend, 'SOCIAL_AUTH_DISCONNECT_REDIRECT_URL') or
        DEFAULT_REDIRECT
    )
    return HttpResponseRedirect(url)


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
        if setting('SOCIAL_AUTH_SANITIZE_REDIRECTS', True):
            redirect = sanitize_redirect(request.get_host(), redirect)
        request.session[REDIRECT_FIELD_NAME] = redirect or DEFAULT_REDIRECT

    # Clean any partial pipeline info before starting the process
    clean_partial_pipeline(request)

    if backend.uses_redirect:
        return HttpResponseRedirect(backend.auth_url())
    else:
        return HttpResponse(backend.auth_html(),
                            content_type='text/html;charset=UTF-8')


def complete_process(request, backend, *args, **kwargs):
    """Authentication complete process"""
    # pop redirect value before the session is trashed on login()
    redirect_value = (
        request.session.get(REDIRECT_FIELD_NAME, '') or
        request.REQUEST.get(REDIRECT_FIELD_NAME, '')
    )
    user = auth_complete(request, backend, *args, **kwargs)

    if isinstance(user, HttpResponse):
        return user

    if not user and request.user.is_authenticated():
        return HttpResponseRedirect(redirect_value)

    msg = None
    if user:
        if getattr(user, 'is_active', True):
            # catch is_new flag before login() might reset the instance
            is_new = getattr(user, 'is_new', False)
            login(request, user)
            # user.social_user is the used UserSocialAuth instance defined
            # in authenticate process
            social_user = user.social_user
            if redirect_value:
                request.session[REDIRECT_FIELD_NAME] = (
                    redirect_value or DEFAULT_REDIRECT)

            if setting('SOCIAL_AUTH_SESSION_EXPIRATION', True):
                # Set session expiration date if present and not disabled by
                # setting. Use last social-auth instance for current provider,
                # users can associate several accounts with a same provider.
                expiration = social_user.expiration_datetime()
                if expiration:
                    try:
                        request.session.set_expiry(expiration)
                    except OverflowError:
                        # Handle django time zone overflow, set default expiry.
                        request.session.set_expiry(None)

            # store last login backend name in session
            request.session['social_auth_last_login_backend'] = social_user.provider

            # Remove possible redirect URL from session, if this is a new
            # account, send him to the new-users-page if defined.
            new_user_redirect = backend_setting(
                backend, 'SOCIAL_AUTH_NEW_USER_REDIRECT_URL')
            if new_user_redirect and is_new:
                url = new_user_redirect
            else:
                url = (
                    redirect_value or
                    backend_setting(backend, 'SOCIAL_AUTH_LOGIN_REDIRECT_URL') or
                    DEFAULT_REDIRECT
                )
        else:
            msg = setting('SOCIAL_AUTH_INACTIVE_USER_MESSAGE', None)
            url = backend_setting(backend, 'SOCIAL_AUTH_INACTIVE_USER_URL',
                                  LOGIN_ERROR_URL)
    else:
        msg = setting('LOGIN_ERROR_MESSAGE', None)
        url = backend_setting(backend, 'LOGIN_ERROR_URL', LOGIN_ERROR_URL)
    if msg:
        messages.error(request, msg)

    if redirect_value and redirect_value != url:
        redirect_value = quote(redirect_value)
        if '?' in url:
            url += '&%s=%s' % (REDIRECT_FIELD_NAME, redirect_value)
        else:
            url += '?%s=%s' % (REDIRECT_FIELD_NAME, redirect_value)
    return HttpResponseRedirect(url)


def auth_complete(request, backend, user=None, *args, **kwargs):
    """Complete auth process. Return authenticated user or None."""
    if user and not user.is_authenticated():
        user = None

    if request.session.get(PIPELINE_KEY):
        data = request.session.pop(PIPELINE_KEY)
        kwargs = kwargs.copy()
        if user:
            kwargs['user'] = user
        idx, xargs, xkwargs = backend.from_session_dict(data, request=request,
                                                        *args, **kwargs)
        if 'backend' in xkwargs and \
           xkwargs['backend'].name == backend.AUTH_BACKEND.name:
            return backend.continue_pipeline(pipeline_index=idx,
                                             *xargs, **xkwargs)
    return backend.auth_complete(user=user, request=request, *args, **kwargs)
