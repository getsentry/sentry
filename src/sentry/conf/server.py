"""
sentry.conf.server
~~~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided web-server

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf.global_settings import *  # NOQA

import os
import os.path
import socket
import sys
import tempfile

import sentry
from sentry.utils.types import type_from_value

from datetime import timedelta
from six.moves.urllib.parse import urlparse


def gettext_noop(s):
    return s


socket.setdefaulttimeout(5)


def env(key, default='', type=None):
    "Extract an environment variable for use in configuration"

    # First check an internal cache, so we can `pop` multiple times
    # without actually losing the value.
    try:
        rv = env._cache[key]
    except KeyError:
        if 'SENTRY_RUNNING_UWSGI' in os.environ:
            # We do this so when the process forks off into uwsgi
            # we want to actually be popping off values. This is so that
            # at runtime, the variables aren't actually available.
            fn = os.environ.pop
        else:
            fn = os.environ.__getitem__

        try:
            rv = fn(key)
            env._cache[key] = rv
        except KeyError:
            rv = default

    if type is None:
        type = type_from_value(default)

    return type(rv)


env._cache = {}

ENVIRONMENT = os.environ.get('SENTRY_ENVIRONMENT', 'production')

IS_DEV = ENVIRONMENT == 'development'

DEBUG = IS_DEV
TEMPLATE_DEBUG = True
MAINTENANCE = False

ADMINS = ()

INTERNAL_IPS = ()

MANAGERS = ADMINS

APPEND_SLASH = True

PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

# XXX(dcramer): handle case when we've installed from source vs just running
# this straight out of the repository
if 'site-packages' in __file__:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, 'node_modules')
else:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, os.pardir, os.pardir, 'node_modules')

NODE_MODULES_ROOT = os.path.normpath(NODE_MODULES_ROOT)

sys.path.insert(0, os.path.normpath(os.path.join(PROJECT_ROOT, os.pardir)))

DATABASES = {
    'default': {
        'ENGINE': 'sentry.db.postgres',
        'NAME': 'sentry',
        'USER': 'postgres',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
        'AUTOCOMMIT': True,
        'ATOMIC_REQUESTS': False,
    }
}

if 'DATABASE_URL' in os.environ:
    url = urlparse(os.environ['DATABASE_URL'])

    # Ensure default database exists.
    DATABASES['default'] = DATABASES.get('default', {})

    # Update with environment configuration.
    DATABASES['default'].update(
        {
            'NAME': url.path[1:],
            'USER': url.username,
            'PASSWORD': url.password,
            'HOST': url.hostname,
            'PORT': url.port,
        }
    )
    if url.scheme == 'postgres':
        DATABASES['default']['ENGINE'] = 'sentry.db.postgres'

    if url.scheme == 'mysql':
        DATABASES['default']['ENGINE'] = 'django.db.backends.mysql'

# This should always be UTC.
TIME_ZONE = 'UTC'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

LANGUAGES = (
    ('af',
     gettext_noop('Afrikaans')), ('ar',
                                  gettext_noop('Arabic')), ('az', gettext_noop('Azerbaijani')),
    ('bg',
     gettext_noop('Bulgarian')), ('be',
                                  gettext_noop('Belarusian')), ('bn', gettext_noop('Bengali')),
    ('br', gettext_noop('Breton')), ('bs',
                                     gettext_noop('Bosnian')), ('ca', gettext_noop('Catalan')),
    ('cs', gettext_noop('Czech')), ('cy', gettext_noop('Welsh')), ('da', gettext_noop('Danish')),
    ('de', gettext_noop('German')), ('el', gettext_noop('Greek')), ('en', gettext_noop('English')),
    ('eo', gettext_noop('Esperanto')), ('es',
                                        gettext_noop('Spanish')), ('et', gettext_noop('Estonian')),
    ('eu', gettext_noop('Basque')), ('fa',
                                     gettext_noop('Persian')), ('fi', gettext_noop('Finnish')),
    ('fr', gettext_noop('French')), ('ga', gettext_noop('Irish')), ('gl', gettext_noop('Galician')),
    ('he', gettext_noop('Hebrew')), ('hi', gettext_noop('Hindi')), ('hr', gettext_noop('Croatian')),
    ('hu',
     gettext_noop('Hungarian')), ('ia',
                                  gettext_noop('Interlingua')), ('id', gettext_noop('Indonesian')),
    ('is', gettext_noop('Icelandic')), ('it',
                                        gettext_noop('Italian')), ('ja', gettext_noop('Japanese')),
    ('ka', gettext_noop('Georgian')), ('kk', gettext_noop('Kazakh')), ('km', gettext_noop('Khmer')),
    ('kn',
     gettext_noop('Kannada')), ('ko',
                                gettext_noop('Korean')), ('lb', gettext_noop('Luxembourgish')),
    ('lt',
     gettext_noop('Lithuanian')), ('lv',
                                   gettext_noop('Latvian')), ('mk', gettext_noop('Macedonian')),
    ('ml', gettext_noop('Malayalam')), ('mn',
                                        gettext_noop('Mongolian')), ('my', gettext_noop('Burmese')),
    ('nb', gettext_noop('Norwegian Bokmal')), ('ne', gettext_noop('Nepali')),
    ('nl', gettext_noop('Dutch')), ('nn', gettext_noop('Norwegian Nynorsk')),
    ('os', gettext_noop('Ossetic')), ('pa',
                                      gettext_noop('Punjabi')), ('pl', gettext_noop('Polish')),
    ('pt', gettext_noop('Portuguese')), ('pt-br', gettext_noop('Brazilian Portuguese')),
    ('ro', gettext_noop('Romanian')), ('ru', gettext_noop('Russian')),
    ('sk', gettext_noop('Slovak')), ('sl',
                                     gettext_noop('Slovenian')), ('sq', gettext_noop('Albanian')),
    ('sr', gettext_noop('Serbian')), ('sv-se',
                                      gettext_noop('Swedish')), ('sw', gettext_noop('Swahili')),
    ('ta', gettext_noop('Tamil')), ('te', gettext_noop('Telugu')), ('th', gettext_noop('Thai')),
    ('tr', gettext_noop('Turkish')), ('tt', gettext_noop('Tatar')), ('udm', gettext_noop('Udmurt')),
    ('uk', gettext_noop('Ukrainian')), ('ur',
                                        gettext_noop('Urdu')), ('vi', gettext_noop('Vietnamese')),
    ('zh-cn', gettext_noop('Simplified Chinese')), ('zh-tw', gettext_noop('Traditional Chinese')),
)

from .locale import CATALOGS
LANGUAGES = tuple((code, name) for code, name in LANGUAGES if code in CATALOGS)

SUPPORTED_LANGUAGES = frozenset(CATALOGS)

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale
USE_L10N = True

USE_TZ = True

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader', 'django.template.loaders.app_directories.Loader',
)

MIDDLEWARE_CLASSES = (
    'sentry.middleware.proxy.ChunkedMiddleware',
    'sentry.middleware.proxy.ContentLengthHeaderMiddleware',
    'sentry.middleware.security.SecurityHeadersMiddleware',
    'sentry.middleware.maintenance.ServicesUnavailableMiddleware',
    'sentry.middleware.env.SentryEnvMiddleware',
    'sentry.middleware.proxy.SetRemoteAddrFromForwardedFor',
    'sentry.middleware.debug.NoIfModifiedSinceMiddleware',
    'sentry.middleware.stats.RequestTimingMiddleware',
    'sentry.middleware.stats.ResponseCodeMiddleware',
    'sentry.middleware.health.HealthCheck',  # Must exist before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'sentry.middleware.auth.AuthenticationMiddleware',
    'sentry.middleware.user.UserActiveMiddleware',
    'sentry.middleware.sudo.SudoMiddleware',
    'sentry.middleware.superuser.SuperuserMiddleware',
    'sentry.middleware.locale.SentryLocaleMiddleware',
    # TODO(dcramer): kill this once we verify its safe
    # 'sentry.middleware.social_auth.SentrySocialAuthExceptionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'sentry.debug.middleware.DebugMiddleware',
)

ROOT_URLCONF = 'sentry.conf.urls'

TEMPLATE_DIRS = (
    # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    os.path.join(PROJECT_ROOT, 'templates'),
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages', 'django.core.context_processors.csrf',
    'django.core.context_processors.request',
    'social_auth.context_processors.social_auth_by_name_backends',
    'social_auth.context_processors.social_auth_backends',
    'social_auth.context_processors.social_auth_by_type_backends',
    'social_auth.context_processors.social_auth_login_redirect'
)

INSTALLED_APPS = (
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.messages', 'django.contrib.sessions', 'django.contrib.sites',
    'django.contrib.staticfiles', 'crispy_forms', 'debug_toolbar',
    'raven.contrib.django.raven_compat', 'rest_framework', 'sentry', 'sentry.analytics',
    'sentry.analytics.events', 'sentry.nodestore', 'sentry.search', 'sentry.lang.java',
    'sentry.lang.javascript', 'sentry.lang.native', 'sentry.plugins.sentry_interface_types',
    'sentry.plugins.sentry_mail', 'sentry.plugins.sentry_urls', 'sentry.plugins.sentry_useragents',
    'sentry.plugins.sentry_webhooks', 'social_auth', 'sudo', 'sentry.tagstore',
)

import django
if django.VERSION < (1, 7):
    INSTALLED_APPS += ('south', )

STATIC_ROOT = os.path.realpath(os.path.join(PROJECT_ROOT, 'static'))
STATIC_URL = '/_static/{version}/'

# various middleware will use this to identify resources which should not access
# cookies
ANONYMOUS_STATIC_PREFIXES = ('/_static/', '/avatar/', '/organization-avatar/', '/team-avatar/')

STATICFILES_FINDERS = (
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
)

ASSET_VERSION = 0

# setup a default media root to somewhere useless
MEDIA_ROOT = '/tmp/sentry-media'

LOCALE_PATHS = (os.path.join(PROJECT_ROOT, 'locale'), )

CSRF_FAILURE_VIEW = 'sentry.web.frontend.csrf_failure.view'
CSRF_COOKIE_NAME = 'sc'

# Auth configuration

try:
    from django.core.urlresolvers import reverse_lazy
except ImportError:
    LOGIN_REDIRECT_URL = '/login-redirect/'
    LOGIN_URL = '/auth/login/'
else:
    LOGIN_REDIRECT_URL = reverse_lazy('sentry-login-redirect')
    LOGIN_URL = reverse_lazy('sentry-login')

AUTHENTICATION_BACKENDS = (
    'sentry.utils.auth.EmailAuthBackend',
    # TODO(dcramer): we can't remove these until we rewrite more of social auth
    'social_auth.backends.github.GithubBackend',
    'social_auth.backends.github_apps.GithubAppsBackend',
    'social_auth.backends.bitbucket.BitbucketBackend',
    'social_auth.backends.trello.TrelloBackend',
    'social_auth.backends.asana.AsanaBackend',
    'social_auth.backends.slack.SlackBackend',
    'social_auth.backends.visualstudio.VisualStudioBackend',
)

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'sentry.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 6,
        },
    },
    {
        'NAME': 'sentry.auth.password_validation.MaximumLengthValidator',
        'OPTIONS': {
            'max_length': 256,
        },
    },
]

SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL = 'sentry.User'

SOCIAL_AUTH_AUTHENTICATION_BACKENDS = (
    'social_auth.backends.github.GithubBackend', 'social_auth.backends.bitbucket.BitbucketBackend',
    'social_auth.backends.trello.TrelloBackend', 'social_auth.backends.asana.AsanaBackend',
    'social_auth.backends.slack.SlackBackend', 'social_auth.backends.github_apps.GithubAppsBackend',
    'social_auth.backends.visualstudio.VisualStudioBackend',
)

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = "sentrysid"
SESSION_SERIALIZER = "django.contrib.sessions.serializers.PickleSerializer"

GOOGLE_OAUTH2_CLIENT_ID = ''
GOOGLE_OAUTH2_CLIENT_SECRET = ''

GITHUB_APP_ID = ''
GITHUB_API_SECRET = ''

GITHUB_APPS_APP_ID = ''
GITHUB_APPS_API_SECRET = ''

TRELLO_API_KEY = ''
TRELLO_API_SECRET = ''

BITBUCKET_CONSUMER_KEY = ''
BITBUCKET_CONSUMER_SECRET = ''

VISUALSTUDIO_APP_ID = ''
VISUALSTUDIO_APP_SECRET = ''
VISUALSTUDIO_CLIENT_SECRET = ''
VISUALSTUDIO_SCOPES = ['vso.work_write', 'vso.project', 'vso.code', 'vso.release']

SOCIAL_AUTH_PIPELINE = (
    'social_auth.backends.pipeline.user.get_username',
    'social_auth.backends.pipeline.social.social_auth_user',
    'social_auth.backends.pipeline.associate.associate_by_email',
    'social_auth.backends.pipeline.misc.save_status_to_session',
    'social_auth.backends.pipeline.social.associate_user',
    'social_auth.backends.pipeline.social.load_extra_data',
    'social_auth.backends.pipeline.user.update_user_details',
    'social_auth.backends.pipeline.misc.save_status_to_session',
)
SOCIAL_AUTH_REVOKE_TOKENS_ON_DISCONNECT = True
SOCIAL_AUTH_LOGIN_REDIRECT_URL = '/account/settings/identities/'
SOCIAL_AUTH_ASSOCIATE_ERROR_URL = SOCIAL_AUTH_LOGIN_REDIRECT_URL

INITIAL_CUSTOM_USER_MIGRATION = '0108_fix_user'

# Auth engines and the settings required for them to be listed
AUTH_PROVIDERS = {
    'github': ('GITHUB_APP_ID', 'GITHUB_API_SECRET'),
    'github_apps': ('GITHUB_APPS_APP_ID', 'GITHUB_APPS_API_SECRET'),
    'trello': ('TRELLO_API_KEY', 'TRELLO_API_SECRET'),
    'bitbucket': ('BITBUCKET_CONSUMER_KEY', 'BITBUCKET_CONSUMER_SECRET'),
    'asana': ('ASANA_CLIENT_ID', 'ASANA_CLIENT_SECRET'),
    'slack': ('SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'),
    'visualstudio': ('VISUALSTUDIO_APP_ID', 'VISUALSTUDIO_APP_SECRET', 'VISUALSTUDIO_CLIENT_SECRET'),
}

AUTH_PROVIDER_LABELS = {
    'github': 'GitHub',
    'github_apps': 'GitHub Apps',
    'trello': 'Trello',
    'bitbucket': 'Bitbucket',
    'asana': 'Asana',
    'slack': 'Slack',
    'visualstudio': 'Visual Studio',
}

import random


def SOCIAL_AUTH_DEFAULT_USERNAME():
    return random.choice(['Darth Vader', 'Obi-Wan Kenobi', 'R2-D2', 'C-3PO', 'Yoda'])


SOCIAL_AUTH_PROTECTED_USER_FIELDS = ['email']
SOCIAL_AUTH_FORCE_POST_DISCONNECT = True

# Queue configuration
from kombu import Exchange, Queue

BROKER_URL = "redis://localhost:6379"
BROKER_TRANSPORT_OPTIONS = {}

# Ensure workers run async by default
# in Development you might want them to run in-process
# though it would cause timeouts/recursions in some cases
CELERY_ALWAYS_EAGER = False

CELERY_EAGER_PROPAGATES_EXCEPTIONS = True
CELERY_IGNORE_RESULT = True
CELERY_SEND_EVENTS = False
CELERY_RESULT_BACKEND = None
CELERY_TASK_RESULT_EXPIRES = 1
CELERY_DISABLE_RATE_LIMITS = True
CELERY_DEFAULT_QUEUE = "default"
CELERY_DEFAULT_EXCHANGE = "default"
CELERY_DEFAULT_EXCHANGE_TYPE = "direct"
CELERY_DEFAULT_ROUTING_KEY = "default"
CELERY_CREATE_MISSING_QUEUES = True
CELERY_REDIRECT_STDOUTS = False
CELERYD_HIJACK_ROOT_LOGGER = False
CELERY_IMPORTS = (
    'sentry.tasks.auth', 'sentry.tasks.auto_resolve_issues', 'sentry.tasks.beacon',
    'sentry.tasks.check_auth', 'sentry.tasks.clear_expired_snoozes',
    'sentry.tasks.collect_project_platforms', 'sentry.tasks.commits', 'sentry.tasks.deletion',
    'sentry.tasks.digests', 'sentry.tasks.email', 'sentry.tasks.merge',
    'sentry.tasks.options', 'sentry.tasks.ping', 'sentry.tasks.post_process',
    'sentry.tasks.process_buffer', 'sentry.tasks.reports', 'sentry.tasks.reprocessing',
    'sentry.tasks.scheduler', 'sentry.tasks.signals', 'sentry.tasks.store', 'sentry.tasks.unmerge',
    'sentry.tasks.symcache_update', 'sentry.tasks.servicehooks',
    'sentry.tagstore.tasks', 'sentry.tasks.assemble'
)
CELERY_QUEUES = [
    Queue('activity.notify', routing_key='activity.notify'),
    Queue('alerts', routing_key='alerts'),
    Queue('auth', routing_key='auth'),
    Queue('assemble', routing_key='assemble'),
    Queue('buffers.process_pending', routing_key='buffers.process_pending'),
    Queue('commits', routing_key='commits'),
    Queue('cleanup', routing_key='cleanup'),
    Queue('default', routing_key='default'),
    Queue('digests.delivery', routing_key='digests.delivery'),
    Queue('digests.scheduling', routing_key='digests.scheduling'),
    Queue('email', routing_key='email'),
    Queue('events.preprocess_event', routing_key='events.preprocess_event'),
    Queue(
        'events.reprocessing.preprocess_event', routing_key='events.reprocessing.preprocess_event'
    ),
    Queue('events.process_event', routing_key='events.process_event'),
    Queue('events.reprocessing.process_event', routing_key='events.reprocessing.process_event'),
    Queue('events.reprocess_events', routing_key='events.reprocess_events'),
    Queue('events.save_event', routing_key='events.save_event'),
    Queue('merge', routing_key='merge'),
    Queue('options', routing_key='options'),
    Queue('reports.deliver', routing_key='reports.deliver'),
    Queue('reports.prepare', routing_key='reports.prepare'),
    Queue('search', routing_key='search'),
    Queue('stats', routing_key='stats'),
    Queue('unmerge', routing_key='unmerge'),
    Queue('update', routing_key='update'),
]

for queue in CELERY_QUEUES:
    queue.durable = False

CELERY_ROUTES = ('sentry.queue.routers.SplitQueueRouter', )


def create_partitioned_queues(name):
    exchange = Exchange(name, type='direct')
    for num in range(1):
        CELERY_QUEUES.append(Queue(
            '{0}-{1}'.format(name, num),
            exchange=exchange,
        ))


create_partitioned_queues('counters')
create_partitioned_queues('triggers')

from celery.schedules import crontab

CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), 'sentry-celerybeat')
CELERYBEAT_SCHEDULE = {
    'check-auth': {
        'task': 'sentry.tasks.check_auth',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
            'queue': 'auth',
        }
    },
    'enqueue-scheduled-jobs': {
        'task': 'sentry.tasks.enqueue_scheduled_jobs',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
        },
    },
    'send-beacon': {
        'task': 'sentry.tasks.send_beacon',
        'schedule': timedelta(hours=1),
        'options': {
            'expires': 3600,
        },
    },
    'send-ping': {
        'task': 'sentry.tasks.send_ping',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
        },
    },
    'flush-buffers': {
        'task': 'sentry.tasks.process_buffer.process_pending',
        'schedule': timedelta(seconds=10),
        'options': {
            'expires': 10,
            'queue': 'buffers.process_pending',
        }
    },
    'sync-options': {
        'task': 'sentry.tasks.options.sync_options',
        'schedule': timedelta(seconds=10),
        'options': {
            'expires': 10,
            'queue': 'options',
        }
    },
    'schedule-digests': {
        'task': 'sentry.tasks.digests.schedule_digests',
        'schedule': timedelta(seconds=30),
        'options': {
            'expires': 30,
        },
    },
    'clear-expired-snoozes': {
        'task': 'sentry.tasks.clear_expired_snoozes',
        'schedule': timedelta(minutes=5),
        'options': {
            'expires': 300,
        },
    },
    'clear-expired-raw-events': {
        'task': 'sentry.tasks.clear_expired_raw_events',
        'schedule': timedelta(minutes=15),
        'options': {
            'expires': 300,
        },
    },
    'collect-project-platforms': {
        'task': 'sentry.tasks.collect_project_platforms',
        'schedule': timedelta(days=1),
        'options': {
            'expires': 3600 * 24,
        },
    },
    'schedule-auto-resolution': {
        'task': 'sentry.tasks.schedule_auto_resolution',
        'schedule': timedelta(minutes=15),
        'options': {
            'expires': 60 * 25,
        },
    },
    'schedule-deletions': {
        'task': 'sentry.tasks.deletion.run_scheduled_deletions',
        'schedule': timedelta(minutes=15),
        'options': {
            'expires': 60 * 25,
        },
    },
    'schedule-weekly-organization-reports': {
        'task':
        'sentry.tasks.reports.prepare_reports',
        'schedule':
        crontab(
            minute=0,
            hour=12,  # 05:00 PDT, 09:00 EDT, 12:00 UTC
            day_of_week='monday',
        ),
        'options': {
            'expires': 60 * 60 * 3,
        },
    },
}

BGTASKS = {
    'sentry.bgtasks.clean_dsymcache:clean_dsymcache': {
        'interval': 5 * 60,
        'roles': ['worker'],
    }
}

# Sentry logs to two major places: stdout, and it's internal project.
# To disable logging to the internal project, add a logger who's only
# handler is 'console' and disable propagating upwards.
# Additionally, Sentry has the ability to override logger levels by
# providing the cli with -l/--loglevel or the SENTRY_LOG_LEVEL env var.
# The loggers that it overrides are root and any in LOGGING.overridable.
# Be very careful with this in a production system, because the celery
# logger can be extremely verbose when given INFO or DEBUG.
LOGGING = {
    'default_level': 'INFO',
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
        'console': {
            'class': 'sentry.logging.handlers.StructLogHandler',
        },
        'internal': {
            'level': 'ERROR',
            'filters': ['sentry:internal'],
            'class': 'raven.contrib.django.handlers.SentryHandler',
        },
        'metrics': {
            'level': 'WARNING',
            'filters': ['important_django_request'],
            'class': 'sentry.logging.handlers.MetricsLogHandler',
        },
        'django_internal': {
            'level': 'WARNING',
            'filters': ['sentry:internal', 'important_django_request'],
            'class': 'raven.contrib.django.handlers.SentryHandler',
        },
    },
    'filters': {
        'sentry:internal': {
            '()': 'sentry.utils.raven.SentryInternalFilter',
        },
        'important_django_request': {
            '()': 'sentry.logging.handlers.MessageContainsFilter',
            'contains': ["CSRF"]
        }
    },
    'root': {
        'level': 'NOTSET',
        'handlers': ['console', 'internal'],
    },
    # LOGGING.overridable is a list of loggers including root that will change
    # based on the overridden level defined above.
    'overridable': ['celery', 'sentry'],
    'loggers': {
        'celery': {
            'level': 'WARNING',
        },
        'sentry': {
            'level': 'INFO',
        },
        # This only needs to go to Sentry for now.
        'sentry.similarity': {
            'handlers': ['internal'],
            'propagate': False,
        },
        'sentry.errors': {
            'handlers': ['console'],
            'propagate': False,
        },
        'sentry.rules': {
            'handlers': ['console'],
            'propagate': False,
        },
        'multiprocessing': {
            'handlers': ['console'],
            # https://github.com/celery/celery/commit/597a6b1f3359065ff6dbabce7237f86b866313df
            # This commit has not been rolled into any release and leads to a
            # large amount of errors when working with postgres.
            'level': 'CRITICAL',
            'propagate': False,
        },
        'celery.worker.job': {
            'handlers': ['console'],
            'propagate': False,
        },
        'static_compiler': {
            'level': 'INFO',
        },
        'django.request': {
            'level': 'WARNING',
            'handlers': ['console', 'metrics', 'django_internal'],
            'propagate': False,
        },
        'toronado': {
            'level': 'ERROR',
            'handlers': ['null'],
            'propagate': False,
        },
        'urllib3.connectionpool': {
            'level': 'ERROR',
            'handlers': ['console'],
            'propagate': False,
        },
        'boto3': {
            'level': 'WARNING',
            'handlers': ['console'],
            'propagate': False,
        },
        'botocore': {
            'level': 'WARNING',
            'handlers': ['console'],
            'propagate': False,
        },
    }
}

# django-rest-framework

REST_FRAMEWORK = {
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
    'DEFAULT_PERMISSION_CLASSES': ('sentry.api.permissions.NoPermission', ),
}

CRISPY_TEMPLATE_PACK = 'bootstrap3'

# Percy config for visual regression testing.

PERCY_DEFAULT_TESTING_WIDTHS = (1280, 375)

# Debugger

DEBUG_TOOLBAR_PANELS = (
    'debug_toolbar.panels.timer.TimerPanel', 'sentry.debug.panels.route.RoutePanel',
    'debug_toolbar.panels.templates.TemplatesPanel', 'debug_toolbar.panels.sql.SQLPanel',
    # TODO(dcramer): https://github.com/getsentry/sentry/issues/1722
    # 'sentry.debug.panels.redis.RedisPanel',
)

DEBUG_TOOLBAR_PATCH_SETTINGS = False

# Sentry and Raven configuration

SENTRY_CLIENT = 'sentry.utils.raven.SentryInternalClient'

SENTRY_FEATURES = {
    'auth:register': True,
    'organizations:api-keys': False,
    'organizations:create': True,
    'organizations:repos': True,
    'organizations:sso': True,
    'organizations:sso-saml2': False,
    'organizations:sso-rippling': False,
    'organizations:group-unmerge': False,
    'organizations:integrations-v3': False,
    'organizations:invite-members': True,
    'organizations:new-settings': False,
    'organizations:require-2fa': False,
    'organizations:environments': False,
    'organizations:internal-catchall': False,
    'organizations:new-teams': False,
    'organizations:code-owners': False,
    'organizations:unreleased-changes': False,
    'organizations:dashboard': False,
    'projects:global-events': False,
    'projects:plugins': True,
    'projects:dsym': False,
    'projects:sample-events': True,
    'projects:data-forwarding': True,
    'projects:rate-limits': True,
    'projects:discard-groups': False,
    'projects:custom-inbound-filters': False,
    'projects:minidump': True,
}

# Default time zone for localization in the UI.
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
SENTRY_DEFAULT_TIME_ZONE = 'UTC'

# Enable the Sentry Debugger (Beta)
SENTRY_DEBUGGER = DEBUG

SENTRY_IGNORE_EXCEPTIONS = ('OperationalError', )

# Should we send the beacon to the upstream server?
SENTRY_BEACON = True

# Allow access to Sentry without authentication.
SENTRY_PUBLIC = False

# Instruct Sentry that this install intends to be run by a single organization
# and thus various UI optimizations should be enabled.
SENTRY_SINGLE_ORGANIZATION = False

# Login url (defaults to LOGIN_URL)
SENTRY_LOGIN_URL = None

# Default project ID (for internal errors)
SENTRY_PROJECT = 1
SENTRY_PROJECT_KEY = None

# Project ID for recording frontend (javascript) exceptions
SENTRY_FRONTEND_PROJECT = None

# Only store a portion of all messages per unique group.
SENTRY_SAMPLE_DATA = True

# The following values control the sampling rates
SENTRY_SAMPLE_RATES = (
    # up until N events, store 1 in M
    (50, 1),
    (1000, 2),
    (10000, 10),
    (100000, 50),
    (1000000, 300),
    (10000000, 2000),
)
SENTRY_MAX_SAMPLE_RATE = 10000
SENTRY_SAMPLE_TIMES = ((3600, 1), (360, 10), (60, 60), )
SENTRY_MAX_SAMPLE_TIME = 10000

# Web Service
SENTRY_WEB_HOST = 'localhost'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {}

# SMTP Service
SENTRY_SMTP_HOST = 'localhost'
SENTRY_SMTP_PORT = 1025

SENTRY_INTERFACES = {
    'csp': 'sentry.interfaces.security.Csp',
    'expectct': 'sentry.interfaces.security.ExpectCT',
    'expectstaple': 'sentry.interfaces.security.ExpectStaple',
    'device': 'sentry.interfaces.device.Device',
    'exception': 'sentry.interfaces.exception.Exception',
    'logentry': 'sentry.interfaces.message.Message',
    'query': 'sentry.interfaces.query.Query',
    'repos': 'sentry.interfaces.repos.Repos',
    'request': 'sentry.interfaces.http.Http',
    'sdk': 'sentry.interfaces.sdk.Sdk',
    'stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'template': 'sentry.interfaces.template.Template',
    'user': 'sentry.interfaces.user.User',
    'applecrashreport': 'sentry.interfaces.applecrash.AppleCrashReport',
    'breadcrumbs': 'sentry.interfaces.breadcrumbs.Breadcrumbs',
    'contexts': 'sentry.interfaces.contexts.Contexts',
    'threads': 'sentry.interfaces.threads.Threads',
    'debug_meta': 'sentry.interfaces.debug_meta.DebugMeta',
    'sentry.interfaces.Exception': 'sentry.interfaces.exception.Exception',
    'sentry.interfaces.Message': 'sentry.interfaces.message.Message',
    'sentry.interfaces.Stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'sentry.interfaces.Template': 'sentry.interfaces.template.Template',
    'sentry.interfaces.Query': 'sentry.interfaces.query.Query',
    'sentry.interfaces.Http': 'sentry.interfaces.http.Http',
    'sentry.interfaces.User': 'sentry.interfaces.user.User',
    'sentry.interfaces.Csp': 'sentry.interfaces.security.Csp',
    'sentry.interfaces.AppleCrashReport': 'sentry.interfaces.applecrash.AppleCrashReport',
    'sentry.interfaces.Breadcrumbs': 'sentry.interfaces.breadcrumbs.Breadcrumbs',
    'sentry.interfaces.Contexts': 'sentry.interfaces.contexts.Contexts',
    'sentry.interfaces.Threads': 'sentry.interfaces.threads.Threads',
    'sentry.interfaces.DebugMeta': 'sentry.interfaces.debug_meta.DebugMeta',
}

SENTRY_EMAIL_BACKEND_ALIASES = {
    'smtp': 'django.core.mail.backends.smtp.EmailBackend',
    'dummy': 'django.core.mail.backends.dummy.EmailBackend',
    'console': 'django.core.mail.backends.console.EmailBackend',
}

SENTRY_FILESTORE_ALIASES = {
    'filesystem': 'django.core.files.storage.FileSystemStorage',
    's3': 'sentry.filestore.s3.S3Boto3Storage',
}

SENTRY_ANALYTICS_ALIASES = {
    'noop': 'sentry.analytics.Analytics',
    'pubsub': 'sentry.analytics.pubsub.PubSubAnalytics',
}

# set of backends that do not support needing SMTP mail.* settings
# This list is a bit fragile and hardcoded, but it's unlikely that
# a user will be using a different backend that also mandates SMTP
# credentials.
SENTRY_SMTP_DISABLED_BACKENDS = frozenset(
    (
        'django.core.mail.backends.dummy.EmailBackend',
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.locmem.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend', 'sentry.utils.email.PreviewBackend',
    )
)

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Will an invite be sent when a member is added to an organization?
SENTRY_ENABLE_INVITES = True

# Default to not sending the Access-Control-Allow-Origin header on api/store
SENTRY_ALLOW_ORIGIN = None

# Enable scraping of javascript context for source code
SENTRY_SCRAPE_JAVASCRIPT_CONTEXT = True

# Buffer backend
SENTRY_BUFFER = 'sentry.buffer.Buffer'
SENTRY_BUFFER_OPTIONS = {}

# Cache backend
# XXX: We explicitly require the cache to be configured as its not optional
# and causes serious confusion with the default django cache
SENTRY_CACHE = None
SENTRY_CACHE_OPTIONS = {}

# The internal Django cache is still used in many places
# TODO(dcramer): convert uses over to Sentry's backend
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# The cache version affects both Django's internal cache (at runtime) as well
# as Sentry's cache. This automatically overrides VERSION on the default
# CACHES backend.
CACHE_VERSION = 1

# Digests backend
SENTRY_DIGESTS = 'sentry.digests.backends.dummy.DummyBackend'
SENTRY_DIGESTS_OPTIONS = {}

# Quota backend
SENTRY_QUOTAS = 'sentry.quotas.Quota'
SENTRY_QUOTA_OPTIONS = {}

# Rate limiting backend
SENTRY_RATELIMITER = 'sentry.ratelimits.base.RateLimiter'
SENTRY_RATELIMITER_OPTIONS = {}

# The default value for project-level quotas
SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE = '90%'

# Node storage backend
SENTRY_NODESTORE = 'sentry.nodestore.django.DjangoNodeStorage'
SENTRY_NODESTORE_OPTIONS = {}

# Tag storage backend
_SENTRY_TAGSTORE_DEFAULT_MULTI_OPTIONS = {
    'backends': [
        ('sentry.tagstore.legacy.LegacyTagStorage', {}),
        ('sentry.tagstore.v2.V2TagStorage', {}),
    ],
    'runner': 'ImmediateRunner',
}
SENTRY_TAGSTORE = os.environ.get('SENTRY_TAGSTORE', 'sentry.tagstore.legacy.LegacyTagStorage')
SENTRY_TAGSTORE_OPTIONS = (
    _SENTRY_TAGSTORE_DEFAULT_MULTI_OPTIONS if 'SENTRY_TAGSTORE_DEFAULT_MULTI_OPTIONS' in os.environ
    else {}
)

# Search backend
SENTRY_SEARCH = os.environ.get('SENTRY_SEARCH', 'sentry.search.django.DjangoSearchBackend')
SENTRY_SEARCH_OPTIONS = {}
# SENTRY_SEARCH_OPTIONS = {
#     'urls': ['http://localhost:9200/'],
#     'timeout': 5,
# }

# Time-series storage backend
SENTRY_TSDB = 'sentry.tsdb.dummy.DummyTSDB'
SENTRY_TSDB_OPTIONS = {}

SENTRY_NEWSLETTER = 'sentry.newsletter.base.Newsletter'
SENTRY_NEWSLETTER_OPTIONS = {}

# rollups must be ordered from highest granularity to lowest
SENTRY_TSDB_ROLLUPS = (
    # (time in seconds, samples to keep)
    (10, 360),  # 60 minutes at 10 seconds
    (3600, 24 * 7),  # 7 days at 1 hour
    (3600 * 24, 90),  # 90 days at 1 day
)

# Internal metrics
SENTRY_METRICS_BACKEND = 'sentry.metrics.dummy.DummyMetricsBackend'
SENTRY_METRICS_OPTIONS = {}
SENTRY_METRICS_SAMPLE_RATE = 1.0
SENTRY_METRICS_PREFIX = 'sentry.'

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT = None
SENTRY_PUBLIC_ENDPOINT = None

# Prevent variables (e.g. context locals, http data, etc) from exceeding this
# size in characters
SENTRY_MAX_VARIABLE_SIZE = 512

# Prevent variables within extra context from exceeding this size in
# characters
SENTRY_MAX_EXTRA_VARIABLE_SIZE = 4096 * 4  # 16kb

# For changing the amount of data seen in Http Response Body part.
SENTRY_MAX_HTTP_BODY_SIZE = 4096 * 4  # 16kb

# For various attributes we don't limit the entire attribute on size, but the
# individual item. In those cases we also want to limit the maximum number of
# keys
SENTRY_MAX_DICTIONARY_ITEMS = 50

SENTRY_MAX_MESSAGE_LENGTH = 1024 * 8
SENTRY_MAX_STACKTRACE_FRAMES = 50
SENTRY_MAX_EXCEPTIONS = 25

# Gravatar service base url
SENTRY_GRAVATAR_BASE_URL = 'https://secure.gravatar.com'

# Timeout (in seconds) for fetching remote source files (e.g. JS)
SENTRY_SOURCE_FETCH_TIMEOUT = 5

# Timeout (in seconds) for socket operations when fetching remote source files
SENTRY_SOURCE_FETCH_SOCKET_TIMEOUT = 2

# Maximum content length for source files before we abort fetching
SENTRY_SOURCE_FETCH_MAX_SIZE = 40 * 1024 * 1024

# List of IP subnets which should not be accessible
SENTRY_DISALLOWED_IPS = ()

# Fields which managed users cannot change via Sentry UI. Username and password
# cannot be changed by managed users. Optionally include 'email' and
# 'name' in SENTRY_MANAGED_USER_FIELDS.
SENTRY_MANAGED_USER_FIELDS = ()

SENTRY_SCOPES = set(
    [
        'org:read',
        'org:write',
        'org:admin',
        'org:integrations',
        'member:read',
        'member:write',
        'member:admin',
        'team:read',
        'team:write',
        'team:admin',
        'project:read',
        'project:write',
        'project:admin',
        'project:releases',
        'event:read',
        'event:write',
        'event:admin',
    ]
)

SENTRY_SCOPE_SETS = (
    (
        ('org:admin', 'Read, write, and admin access to organization details.'),
        ('org:write', 'Read and write access to organization details.'),
        ('org:read', 'Read access to organization details.'),
    ), (
        ('org:integrations', 'Read, write, and admin access to organization integrations.'),
    ), (
        ('member:admin', 'Read, write, and admin access to organization members.'),
        ('member:write', 'Read and write access to organization members.'),
        ('member:read', 'Read access to organization members.'),
    ), (
        ('team:admin', 'Read, write, and admin access to teams.'),
        ('team:write', 'Read and write access to teams.'), ('team:read', 'Read access to teams.'),
    ), (
        ('project:admin', 'Read, write, and admin access to projects.'),
        ('project:write',
         'Read and write access to projects.'), ('project:read', 'Read access to projects.'),
    ), (
        ('project:releases', 'Read, write, and admin access to project releases.'),
    ), (
        ('event:admin', 'Read, write, and admin access to events.'),
        ('event:write',
         'Read and write access to events.'), ('event:read', 'Read access to events.'),
    ),
)

SENTRY_DEFAULT_ROLE = 'member'

# Roles are ordered, which represents a sort-of hierarchy, as well as how
# they're presented in the UI. This is primarily important in that a member
# that is earlier in the chain cannot manage the settings of a member later
# in the chain (they still require the appropriate scope).
SENTRY_ROLES = (
    {
        'id': 'member',
        'name': 'Member',
        'desc': 'Members can view and act on events, as well as view most other data within the organization.',
        'scopes': set(
            [
                'event:read',
                'event:write',
                'event:admin',
                'project:releases',
                'project:read',
                'org:read',
                'member:read',
                'team:read',
            ]
        ),
    }, {
        'id': 'admin',
        'name': 'Admin',
        'desc': 'Admin privileges on any teams of which they\'re a member. They can create new teams and projects, as well as remove teams and projects which they already hold membership on.',
        'scopes': set(
            [
                'event:read',
                'event:write',
                'event:admin',
                'org:read',
                'member:read',
                'project:read',
                'project:write',
                'project:admin',
                'project:releases',
                'team:read',
                'team:write',
                'team:admin',
                'org:integrations',
            ]
        ),
    }, {
        'id': 'manager',
        'name': 'Manager',
        'desc': 'Gains admin access on all teams as well as the ability to add and remove members.',
        'is_global': True,
        'scopes': set(
            [
                'event:read',
                'event:write',
                'event:admin',
                'member:read',
                'member:write',
                'member:admin',
                'project:read',
                'project:write',
                'project:admin',
                'project:releases',
                'team:read',
                'team:write',
                'team:admin',
                'org:read',
                'org:write',
                'org:integrations',
            ]
        ),
    }, {
        'id': 'owner',
        'name': 'Owner',
        'desc': 'Gains full permission across the organization. Can manage members as well as perform catastrophic operations such as removing the organization.',
        'is_global': True,
        'scopes': set(
            [
                'org:read',
                'org:write',
                'org:admin',
                'org:integrations',
                'member:read',
                'member:write',
                'member:admin',
                'team:read',
                'team:write',
                'team:admin',
                'project:read',
                'project:write',
                'project:admin',
                'project:releases',
                'event:read',
                'event:write',
                'event:admin',
            ]
        ),
    },
)

# See sentry/options/__init__.py for more information
SENTRY_OPTIONS = {}
SENTRY_DEFAULT_OPTIONS = {}

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = False

# Encryption schemes available to Sentry. You should *never* remove from this
# list until the key is no longer used in the database. The first listed
# implementation is considered the default and will be used to encrypt all
# values (as well as re-encrypt data when it's re-saved).
SENTRY_ENCRYPTION_SCHEMES = (
    # identifier: implementation
    # ('0', Fernet(b'super secret key probably from Fernet.generate_key()')),
)

# Delay (in ms) to induce on API responses
SENTRY_API_RESPONSE_DELAY = 150 if IS_DEV else None

# Watchers for various application purposes (such as compiling static media)
# XXX(dcramer): this doesn't work outside of a source distribution as the
# webpack.config.js is not part of Sentry's datafiles
SENTRY_WATCHERS = (
    (
        'webpack', [
            os.path.join(NODE_MODULES_ROOT, '.bin', 'webpack'), '--output-pathinfo', '--watch',
            "--config={}".format(
                os.path.
                normpath(os.path.join(PROJECT_ROOT, os.pardir, os.pardir, "webpack.config.js"))
            )
        ]
    ),
)

# Max file size for avatar photo uploads
SENTRY_MAX_AVATAR_SIZE = 5000000

# The maximum age of raw events before they are deleted
SENTRY_RAW_EVENT_MAX_AGE_DAYS = 10

# statuspage.io support
STATUS_PAGE_ID = None
STATUS_PAGE_API_HOST = 'statuspage.io'

SENTRY_ONPREMISE = True

# Whether we should look at X-Forwarded-For header or not
# when checking REMOTE_ADDR ip addresses
SENTRY_USE_X_FORWARDED_FOR = True

SENTRY_DEFAULT_INTEGRATIONS = (
    'sentry.integrations.slack.SlackIntegration',
)


def get_raven_config():
    return {
        'release': sentry.__build__,
        'register_signals': True,
        'environment': ENVIRONMENT,
        'include_paths': [
            'sentry',
        ],
    }


RAVEN_CONFIG = get_raven_config()

# Config options that are explicitly disabled from Django
DEAD = object()

# This will eventually get set from values in SENTRY_OPTIONS during
# sentry.runner.initializer:bootstrap_options
SECRET_KEY = DEAD
EMAIL_BACKEND = DEAD
EMAIL_HOST = DEAD
EMAIL_PORT = DEAD
EMAIL_HOST_USER = DEAD
EMAIL_HOST_PASSWORD = DEAD
EMAIL_USE_TLS = DEAD
SERVER_EMAIL = DEAD
EMAIL_SUBJECT_PREFIX = DEAD

SUDO_URL = 'sentry-sudo'

# TODO(dcramer): move this to sentry.io so it can be automated
SDK_VERSIONS = {
    'raven-js': '3.21.0',
    'raven-node': '2.3.0',
    'raven-python': '6.4.0',
    'raven-ruby': '2.7.1',
    'sentry-cocoa': '3.11.1',
    'sentry-java': '1.6.4',
    'sentry-laravel': '0.8.0',
    'sentry-php': '1.8.2',
}

SDK_URLS = {
    'raven-js': 'https://docs.sentry.io/clients/javascript/',
    'raven-node': 'https://docs.sentry.io/clients/node/',
    'raven-python': 'https://docs.sentry.io/clients/python/',
    'raven-ruby': 'https://docs.sentry.io/clients/ruby/',
    'raven-swift': 'https://docs.sentry.io/clients/cocoa/',
    'sentry-java': 'https://docs.sentry.io/clients/java/',
    'sentry-php': 'https://docs.sentry.io/clients/php/',
    'sentry-laravel': 'https://docs.sentry.io/clients/php/integrations/laravel/',
    'sentry-swift': 'https://docs.sentry.io/clients/cocoa/',
}

DEPRECATED_SDKS = {
    # sdk name => new sdk name
    'raven-java': 'sentry-java',
    'raven-java:android': 'sentry-java',
    'raven-java:log4j': 'sentry-java',
    'raven-java:log4j2': 'sentry-java',
    'raven-java:logback': 'sentry-java',
    'raven-objc': 'sentry-swift',
    'raven-php': 'sentry-php',
    'sentry-android': 'raven-java',
    'sentry-swift': 'sentry-cocoa',

    # The Ruby SDK used to go by the name 'sentry-raven'...
    'sentry-raven': 'raven-ruby',
}

SOUTH_TESTS_MIGRATE = os.environ.get('SOUTH_TESTS_MIGRATE', '0') == '1'

TERMS_URL = None
PRIVACY_URL = None

# Toggles whether minidumps should be cached
SENTRY_MINIDUMP_CACHE = False
# The location for cached minidumps
SENTRY_MINIDUMP_PATH = '/tmp/minidump'
