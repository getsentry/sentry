"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings
try:
    from django.db import connections
    dbconf = settings.DATABASES
except ImportError:
    # Compat with < Django 1.2
    from django.db import connection
    connections = {'default': connection}
    dbconf = {
        'default': {
            'ENGINE': settings.DATABASE_ENGINE,
            'NAME': settings.DATABASE_NAME,
            'HOST': settings.DATABASE_HOST,
            'USER': settings.DATABASE_USER,
            'PASSWORD': settings.DATABASE_PASSWORD,
            'TEST_NAME': settings.DATABASE_TEST_NAME,
            'OPTIONS': settings.DATABASE_OPTIONS
        }
    }
