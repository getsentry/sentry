#!/usr/bin/env python
import logging
import sys
from os.path import dirname, abspath

logging.getLogger('sentry').addHandler(logging.StreamHandler())

from django.conf import settings

if not settings.configured:
    settings.configure(
        DATABASE_ENGINE='sqlite3',
        # HACK: this fixes our threaded runserver remote tests
        # DATABASE_NAME='test_sentry',
        # TEST_DATABASE_NAME='test_sentry',
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.admin',
            'django.contrib.sessions',
            'django.contrib.sites',

            # Included to fix Disqus' test Django which solves IntegrityMessage case
            'django.contrib.contenttypes',

            'sentry',
            'sentry.client',
            'sentry.client.celery',
            'paging',
            'indexer',
            
            # celery client
            'djcelery',

            # No fucking idea why I have to do this
            'sentry.tests',
        ],
        ROOT_URLCONF='',
        DEBUG=False,
        SITE_ID=1,
        BROKER_HOST="localhost",
        BROKER_PORT=5672,
        BROKER_USER="guest",
        BROKER_PASSWORD="guest",
        BROKER_VHOST="/",
        CELERY_ALWAYS_EAGER=True,
        SENTRY_THRASHING_LIMIT=0,
    )
    import djcelery
    djcelery.setup_loader()

from django.test.simple import run_tests


def runtests(*test_args):
    if not test_args:
        test_args = ['sentry']
    parent = dirname(abspath(__file__))
    sys.path.insert(0, parent)
    failures = run_tests(test_args, verbosity=1, interactive=True)
    sys.exit(failures)


if __name__ == '__main__':
    runtests(*sys.argv[1:])