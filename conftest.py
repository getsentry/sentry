from django.conf import settings
import base64
import os
import os.path


def pytest_configure(config):
    import warnings
    warnings.filterwarnings('error', '', Warning, r'(sentry|raven)')

    if not settings.configured:
        os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry.conf.server'

    test_db = os.environ.get('DB', 'sqlite')
    if test_db == 'mysql':
        settings.DATABASES['default'].update({
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'sentry',
            'USER': 'root',
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

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + (
        'tests',
    )
    settings.SENTRY_KEY = base64.b64encode(os.urandom(40))
    settings.SENTRY_PUBLIC = False
    # This speeds up the tests considerably, pbkdf2 is by design, slow.
    settings.PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]
