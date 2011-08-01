from sentry.conf.defaults import *

from django.conf import settings
from django.core.urlresolvers import resolve
from django.utils.hashcompat import md5_constructor
from django.utils.translation import ugettext_lazy as _

import warnings

# Some sane overrides to better mix with Django
DEBUG = getattr(settings, 'DEBUG', False) and not getattr(settings, 'SENTRY_TESTING', False)
KEY = getattr(settings, 'SENTRY_KEY', md5_constructor(settings.SECRET_KEY).hexdigest())
EMAIL_SUBJECT_PREFIX = getattr(settings, 'EMAIL_SUBJECT_PREFIX', EMAIL_SUBJECT_PREFIX)
INTERNAL_IPS = getattr(settings, 'INTERNAL_IPS', INTERNAL_IPS)
SERVER_EMAIL = getattr(settings, 'SERVER_EMAIL', SERVER_EMAIL)

for k in dir(settings):
    if k.startswith('SENTRY_'):
        locals()[k.split('SENTRY_', 1)[1]] = getattr(settings, k)

LOG_LEVELS = [(k, _(v)) for k, v in LOG_LEVELS]

if REMOTE_URL:
    if isinstance(REMOTE_URL, basestring):
        REMOTE_URL = [REMOTE_URL]
    elif not isinstance(REMOTE_URL, (list, tuple)):
        raise ValueError("Sentry setting 'REMOTE_URL' must be of type list.")

# if LOGIN_URL resolves force login_required to it instead of our own
try:
    resolve(settings.LOGIN_URL)
except:
    pass
else:
    LOGIN_URL = settings.LOGIN_URL

def configure(**kwargs):
    for k, v in kwargs.iteritems():
        if k.upper() != k:
            warnings.warn('Invalid setting, \'%s\' which is not defined by Sentry' % k)
        else:
            locals[k] = v
