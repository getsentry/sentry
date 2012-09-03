#!/usr/bin/env python
import base64
import logging
import os
import sys
import warnings
from os.path import dirname, abspath
from optparse import OptionParser

sys.path.insert(0, dirname(abspath(__file__)))

logging.basicConfig(level=logging.DEBUG)

# Force all warnings in Django or Sentry to throw exceptions
warnings.filterwarnings('error', '', RuntimeWarning, module=r'^(sentry|django).*')

from django.conf import settings

if not settings.configured:
    os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry.conf.server'

test_db = os.environ.get('DB', 'sqlite')
if test_db == 'mysql':
    settings.DATABASES['default'].update({
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'sentry',
    })
elif test_db == 'postgres':
    settings.DATABASES['default'].update({
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'USER': 'postgres',
        'NAME': 'sentry',
        'OPTIONS': {
            'autocommit': True,
        }
    })
elif test_db == 'sqlite':
    settings.DATABASES['default'].update({
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    })

# override a few things with our test specifics
settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + (
    'tests',
)
settings.SENTRY_KEY = base64.b64encode(os.urandom(40))
settings.SENTRY_PUBLIC = False

from django_nose import NoseTestSuiteRunner


def runtests(*test_args, **kwargs):
    if 'south' in settings.INSTALLED_APPS:
        from south.management.commands import patch_for_test_db_setup
        patch_for_test_db_setup()

    if not test_args:
        test_args = ['tests']

    kwargs.setdefault('interactive', False)

    test_runner = NoseTestSuiteRunner(**kwargs)

    failures = test_runner.run_tests(test_args)
    sys.exit(failures)

if __name__ == '__main__':
    parser = OptionParser()
    parser.add_option('--verbosity', dest='verbosity', action='store', default=1, type=int)
    parser.add_options(NoseTestSuiteRunner.options)
    (options, args) = parser.parse_args()

    runtests(*args, **options.__dict__)
