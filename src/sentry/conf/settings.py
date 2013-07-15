"""
sentry.conf.settings
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf.defaults import *  # NOQA

from django.conf import settings

import hashlib

# Some sane overrides to better mix with Django
DEBUG = getattr(settings, 'DEBUG', False) and not getattr(settings, 'SENTRY_TESTING', False)
KEY = getattr(settings, 'SENTRY_KEY', hashlib.md5(settings.SECRET_KEY).hexdigest())
EMAIL_SUBJECT_PREFIX = getattr(settings, 'EMAIL_SUBJECT_PREFIX', EMAIL_SUBJECT_PREFIX)
INTERNAL_IPS = getattr(settings, 'INTERNAL_IPS', INTERNAL_IPS)
SERVER_EMAIL = getattr(settings, 'SERVER_EMAIL', SERVER_EMAIL)

for k in dir(settings):
    if k.startswith('SENTRY_'):
        locals()[k.split('SENTRY_', 1)[1]] = getattr(settings, k)

if locals().get('REMOTE_URL'):
    if isinstance(REMOTE_URL, basestring):
        SERVERS = [REMOTE_URL]
    elif not isinstance(REMOTE_URL, (list, tuple)):
        raise ValueError("Sentry setting 'REMOTE_URL' must be of type list.")

if locals().get('REMOTE_TIMEOUT'):
    TIMEOUT = REMOTE_TIMEOUT


def get_all_languages():
    results = []
    for path in os.listdir(os.path.join(MODULE_ROOT, 'locale')):
        if path.startswith('.'):
            continue
        results.append(path)
    return results

# Setup languages for only available locales
LANGUAGE_MAP = dict(settings.LANGUAGES)
LANGUAGES = [(k, LANGUAGE_MAP[k]) for k in get_all_languages() if k in LANGUAGE_MAP]

LOG_LEVEL_REVERSE_MAP = dict((str(v), k) for k, v in LOG_LEVELS)
