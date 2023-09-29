from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from importlib import import_module
from typing import TYPE_CHECKING, Any, Dict, Type
from urllib.parse import parse_qs as urlparse_parse_qs
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import urlopen

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Model

LEAVE_CHARS = getattr(settings, "SOCIAL_AUTH_LOG_SANITIZE_LEAVE_CHARS", 4)


if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.usersocialauth.model import RpcUserSocialAuth
    from social_auth.backends import SocialAuthBackend

    from .models import UserSocialAuth


def get_backend(instance: UserSocialAuth | RpcUserSocialAuth) -> Type[SocialAuthBackend] | None:
    # Make import here to avoid recursive imports :-/
    from social_auth.backends import get_backends

    return get_backends().get(instance.provider)


def tokens(instance: UserSocialAuth | RpcUserSocialAuth) -> Dict[str, Any]:
    """Return access_token stored in extra_data or None"""
    backend = instance.get_backend()
    if backend:
        return backend.AUTH_BACKEND.tokens(instance)
    else:
        return {}


def expiration_datetime(instance: UserSocialAuth | RpcUserSocialAuth) -> timedelta | None:
    """Return provider session live seconds. Returns a timedelta ready to
    use with session.set_expiry().

    If provider returns a timestamp instead of session seconds to live, the
    timedelta is inferred from current time (using UTC timezone). None is
    returned if there's no value stored or it's invalid.
    """
    if instance.extra_data and "expires" in instance.extra_data:
        try:
            expires = int(instance.extra_data["expires"])
        except (ValueError, TypeError):
            return None

        now = datetime.utcnow()

        # Detect if expires is a timestamp
        if expires > time.mktime(now.timetuple()):
            # expires is a datetime
            return datetime.fromtimestamp(expires) - now
        else:
            # expires is a timedelta
            return timedelta(seconds=expires)
    return None


def sanitize_log_data(secret, data=None, leave_characters=LEAVE_CHARS):
    """
    Clean private/secret data from log statements and other data.

    Assumes data and secret are strings. Replaces all but the first
    `leave_characters` of `secret`, as found in `data`, with '*'.

    If no data is given, all but the first `leave_characters` of secret
    are simply replaced and returned.
    """
    replace_secret = secret[:leave_characters] + (len(secret) - leave_characters) * "*"

    if data:
        return data.replace(secret, replace_secret)

    return replace_secret


def setting(name, default=None):
    """Return setting value for given name or default value."""
    return getattr(settings, name, default)


def backend_setting(backend, name, default=None):
    """
    Looks for setting value following these rules:
        1. Search for <backend_name> prefixed setting
        2. Search for setting given by name
        3. Return default
    """
    backend_name = get_backend_name(backend)
    setting_name = "{}_{}".format(backend_name.upper().replace("-", "_"), name)
    if hasattr(settings, setting_name):
        return setting(setting_name)
    elif hasattr(settings, name):
        return setting(name)
    else:
        return default


logger = logging.getLogger("SocialAuth")
logger.setLevel(logging.DEBUG)


def log(level, *args, **kwargs):
    """Small wrapper around logger functions."""
    {
        "debug": logger.debug,
        "error": logger.error,
        "exception": logger.exception,
        "warn": logger.warn,
    }[level](*args, **kwargs)


def model_to_ctype(val):
    """Converts values that are instance of Model to a dictionary
    with enough information to retrieve the instance back later."""
    if isinstance(val, Model):
        val = {"pk": val.pk, "ctype": ContentType.objects.get_for_model(val).pk}
    return val


def ctype_to_model(val):
    """Converts back the instance saved by model_to_ctype function."""
    if isinstance(val, dict) and "pk" in val and "ctype" in val:
        ctype = ContentType.objects.get_for_id(val["ctype"])
        ModelClass = ctype.model_class()
        assert ModelClass is not None
        val = ModelClass.objects.get(pk=val["pk"])
    return val


def clean_partial_pipeline(request):
    """Cleans any data for partial pipeline."""
    name = setting("SOCIAL_AUTH_PARTIAL_PIPELINE_KEY", "partial_pipeline")
    # Check for key to avoid flagging the session as modified unnecessary
    if name in request.session:
        request.session.pop(name, None)


def url_add_parameters(url, params):
    """Adds parameters to URL, parameter will be repeated if already present"""
    if params:
        fragments = list(urlparse(url))
        fragments[4] = urlencode(parse_qsl(fragments[4]) + list(params.items()))
        url = urlunparse(fragments)
    return url


def dsa_urlopen(*args, **kwargs):
    """Like urllib2.urlopen but sets a timeout defined by
    SOCIAL_AUTH_URLOPEN_TIMEOUT setting if defined (and not already in
    kwargs)."""
    timeout = setting("SOCIAL_AUTH_URLOPEN_TIMEOUT")
    if timeout and "timeout" not in kwargs:
        kwargs["timeout"] = timeout
    return urlopen(*args, **kwargs)


def get_backend_name(backend):
    return getattr(getattr(backend, "AUTH_BACKEND", backend), "name", None)


def module_member(name):
    mod, member = name.rsplit(".", 1)
    module = import_module(mod)
    return getattr(module, member)


def parse_qs(value):
    """Like urlparse.parse_qs but transform list values to single items"""
    return drop_lists(urlparse_parse_qs(value))


def drop_lists(value):
    return {key: val[0] for key, val in value.items()}


if __name__ == "__main__":
    import doctest

    doctest.testmod()
