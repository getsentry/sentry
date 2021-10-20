"""Views

Notes:
    * Some views are marked to avoid csrf token check because they rely
      on third party providers that (if using POST) won't be sending csrf
      token back.
"""


from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect
from django.utils.http import is_safe_url
from django.views.decorators.csrf import csrf_exempt

from social_auth.decorators import dsa_view
from social_auth.exceptions import AuthException
from social_auth.utils import backend_setting, clean_partial_pipeline, setting

DEFAULT_REDIRECT = setting("SOCIAL_AUTH_LOGIN_REDIRECT_URL", setting("LOGIN_REDIRECT_URL"))
ASSOCIATE_ERROR_URL = setting("SOCIAL_AUTH_ASSOCIATE_ERROR_URL")
PIPELINE_KEY = setting("SOCIAL_AUTH_PARTIAL_PIPELINE_KEY", "partial_pipeline")


@dsa_view(setting("SOCIAL_AUTH_COMPLETE_URL_NAME", "socialauth_associate_complete"))
def auth(request, backend):
    """Authenticate using social backend"""
    data = request.POST if request.method == "POST" else request.GET

    # Save extra data into session.
    for field_name in setting("SOCIAL_AUTH_FIELDS_STORED_IN_SESSION", []):
        if field_name in data:
            request.session[field_name] = data[field_name]

    # Save any defined next value into session
    if REDIRECT_FIELD_NAME in data:
        # Check and sanitize a user-defined GET/POST next field value
        redirect = data[REDIRECT_FIELD_NAME]
        # NOTE: django-sudo's `is_safe_url` is much better at catching bad
        # redirections to different domains than social_auth's
        # `sanitize_redirect` call.
        if not is_safe_url(redirect, allowed_hosts=(request.get_host(),)):
            redirect = DEFAULT_REDIRECT
        request.session[REDIRECT_FIELD_NAME] = redirect or DEFAULT_REDIRECT

    # Clean any partial pipeline info before starting the process
    clean_partial_pipeline(request)

    if backend.uses_redirect:
        return HttpResponseRedirect(backend.auth_url())
    else:
        return HttpResponse(backend.auth_html(), content_type="text/html;charset=UTF-8")


@csrf_exempt
@login_required
@dsa_view()
def complete(request, backend, *args, **kwargs):
    """Authentication complete process"""
    # pop redirect value before the session is trashed on login()
    redirect_value = request.session.get(REDIRECT_FIELD_NAME, "")

    backend_name = backend.AUTH_BACKEND.name

    try:
        user = auth_complete(request, backend, request.user, *args, **kwargs)
    except AuthException as exc:
        messages.add_message(request, messages.ERROR, str(exc))
        user = None
    else:
        messages.add_message(
            request,
            messages.SUCCESS,
            "You have linked your account with {}.".format(
                settings.AUTH_PROVIDER_LABELS.get(backend_name, backend_name)
            ),
        )

    if not user:
        url = redirect_value or ASSOCIATE_ERROR_URL or DEFAULT_REDIRECT
    elif isinstance(user, HttpResponse):
        return user
    else:
        url = (
            redirect_value
            or backend_setting(backend, "SOCIAL_AUTH_NEW_ASSOCIATION_REDIRECT_URL")
            or DEFAULT_REDIRECT
        )
    return HttpResponseRedirect(url)


def auth_complete(request, backend, user, *args, **kwargs):
    """Complete auth process. Return authenticated user or None."""
    if request.session.get(PIPELINE_KEY):
        data = request.session.pop(PIPELINE_KEY)
        kwargs = kwargs.copy()
        if user:
            kwargs["user"] = user
        idx, xargs, xkwargs = backend.from_session_dict(data, request=request, *args, **kwargs)
        if "backend" in xkwargs and xkwargs["backend"].name == backend.AUTH_BACKEND.name:
            return backend.continue_pipeline(pipeline_index=idx, *xargs, **xkwargs)
    return backend.auth_complete(user=user, request=request, *args, **kwargs)
