from __future__ import absolute_import

import random
import logging

from cgi import parse_qsl
from collections import defaultdict
from django.conf import settings
from django.db.models import Model
from django.contrib.contenttypes.models import ContentType
from django.utils.functional import empty, SimpleLazyObject
from django.utils.importlib import import_module
from six.moves.urllib.parse import urlencode, urlparse, urlunparse
from six.moves.urllib.request import urlopen

try:
    random = random.SystemRandom()
    using_sysrandom = True
except NotImplementedError:
    using_sysrandom = False


LEAVE_CHARS = getattr(settings, 'SOCIAL_AUTH_LOG_SANITIZE_LEAVE_CHARS', 4)


def sanitize_log_data(secret, data=None, leave_characters=LEAVE_CHARS):
    """
    Clean private/secret data from log statements and other data.

    Assumes data and secret are strings. Replaces all but the first
    `leave_characters` of `secret`, as found in `data`, with '*'.

    If no data is given, all but the first `leave_characters` of secret
    are simply replaced and returned.
    """
    replace_secret = (secret[:leave_characters] +
                      (len(secret) - leave_characters) * '*')

    if data:
        return data.replace(secret, replace_secret)

    return replace_secret


def group_backend_by_type(items, key=lambda x: x):
    """Group items by backend type."""

    # Beware of cyclical imports!
    from social_auth.backends import \
        get_backends, BaseOAuth, BaseOAuth2

    result = defaultdict(list)
    backends = get_backends()

    for item in items:
        backend = backends[key(item)]
        if issubclass(backend, BaseOAuth2):
            result['oauth2'].append(item)
        elif issubclass(backend, BaseOAuth):
            result['oauth'].append(item)
    return dict(result)


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
    setting_name = '%s_%s' % (backend_name.upper().replace('-', '_'), name)
    if hasattr(settings, setting_name):
        return setting(setting_name)
    elif hasattr(settings, name):
        return setting(name)
    else:
        return default


logger = None
if not logger:
    logger = logging.getLogger('SocialAuth')
    logger.setLevel(logging.DEBUG)


def log(level, *args, **kwargs):
    """Small wrapper around logger functions."""
    {'debug': logger.debug,
     'error': logger.error,
     'exception': logger.exception,
     'warn': logger.warn}[level](*args, **kwargs)


def model_to_ctype(val):
    """Converts values that are instance of Model to a dictionary
    with enough information to retrieve the instance back later."""
    if isinstance(val, Model):
        val = {
            'pk': val.pk,
            'ctype': ContentType.objects.get_for_model(val).pk
        }
    return val


def ctype_to_model(val):
    """Converts back the instance saved by model_to_ctype function."""
    if isinstance(val, dict) and 'pk' in val and 'ctype' in val:
        ctype = ContentType.objects.get_for_id(val['ctype'])
        ModelClass = ctype.model_class()
        val = ModelClass.objects.get(pk=val['pk'])
    return val


def clean_partial_pipeline(request):
    """Cleans any data for partial pipeline."""
    name = setting('SOCIAL_AUTH_PARTIAL_PIPELINE_KEY', 'partial_pipeline')
    # Check for key to avoid flagging the session as modified unnecessary
    if name in request.session:
        request.session.pop(name, None)


def url_add_parameters(url, params):
    """Adds parameters to URL, parameter will be repeated if already present"""
    if params:
        fragments = list(urlparse(url))
        fragments[4] = urlencode(parse_qsl(fragments[4]) + params.items())
        url = urlunparse(fragments)
    return url


class LazyDict(SimpleLazyObject):
    """Lazy dict initialization."""
    def __getitem__(self, name):
        if self._wrapped is empty:
            self._setup()
        return self._wrapped[name]

    def __setitem__(self, name, value):
        if self._wrapped is empty:
            self._setup()
        self._wrapped[name] = value


def dsa_urlopen(*args, **kwargs):
    """Like urllib2.urlopen but sets a timeout defined by
    SOCIAL_AUTH_URLOPEN_TIMEOUT setting if defined (and not already in
    kwargs)."""
    timeout = setting('SOCIAL_AUTH_URLOPEN_TIMEOUT')
    if timeout and 'timeout' not in kwargs:
        kwargs['timeout'] = timeout
    return urlopen(*args, **kwargs)


def get_backend_name(backend):
    return getattr(getattr(backend, 'AUTH_BACKEND', backend), 'name', None)


def custom_user_frozen_models(user_model):
    migration_name = getattr(settings, 'INITIAL_CUSTOM_USER_MIGRATION',
                             '0001_initial.py')
    if user_model != 'auth.User':
        from south.migration.base import Migrations
        from south.exceptions import NoMigrations
        from south.creator.freezer import freeze_apps
        user_app, user_model = user_model.split('.')
        try:
            user_migrations = Migrations(user_app)
        except NoMigrations:
            extra_model = freeze_apps(user_app)
        else:
            initial_user_migration = user_migrations.migration(migration_name)
            extra_model = initial_user_migration.migration_class().models
    else:
        extra_model = {}
    return extra_model


def module_member(name):
    mod, member = name.rsplit('.', 1)
    module = import_module(mod)
    return getattr(module, member)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
