from sentry.conf.defaults import *

import warnings

try:
    from django.conf import settings
    from django.utils.hashcompat import md5_constructor
    from django.utils.translation import ugettext_lazy as _

# Some sane overrides to better mix with Django
    DEBUG = getattr(settings, 'DEBUG', False) and not getattr(settings, 'SENTRY_TESTING', False)
    EMAIL_SUBJECT_PREFIX = getattr(settings, 'EMAIL_SUBJECT_PREFIX', EMAIL_SUBJECT_PREFIX)
    INTERNAL_IPS = getattr(settings, 'INTERNAL_IPS', INTERNAL_IPS)
    SERVER_EMAIL = getattr(settings, 'SERVER_EMAIL', SERVER_EMAIL)

    for k in dir(settings):
        if k.startswith('SENTRY_'):
            globals()[k.split('SENTRY_', 1)[1]] = getattr(settings, k)
except ImportError:
    warnings.warn('django not available / not configured, hope we can work without it.')

LOG_LEVELS = ((k, _(v)) for k, v in LOG_LEVELS)

if REMOTE_URL:
    if isinstance(REMOTE_URL, (list, tuple)):
        REMOTE_URL = REMOTE_URL[0]
    elif not isinstance(REMOTE_URL, str):
        raise ValueError("Sentry setting 'REMOTE_URL' must be of type string.")

def configure(**kwargs):
    for k, v in kwargs.iteritems():
        if k.upper() != k:
            warnings.warn('Invalid setting, \'%s\' which is not defined by Sentry' % k)
        elif k not in globals():
            warnings.warn('Setting \'%s\' which is not defined by Sentry' % k)
        else:
            globals()[k] = v
