"""
These settings act as the default (base) settings for the Sentry-provided web-server
"""

import os
import os.path
import re
import socket
import sys
import tempfile
from datetime import timedelta
from urllib.parse import urlparse

from django.conf.global_settings import *  # NOQA

import sentry
from sentry.utils.celery import crontab_with_minute_jitter
from sentry.utils.types import type_from_value


def gettext_noop(s):
    return s


socket.setdefaulttimeout(5)


def env(key, default="", type=None):
    """
    Extract an environment variable for use in configuration

    :param key: The environment variable to be extracted.
    :param default: The value to be returned if `key` is not found.
    :param type: The type of the returned object (defaults to the type of `default`).
    :return: The environment variable if it exists, else `default`.
    """

    # First check an internal cache, so we can `pop` multiple times
    # without actually losing the value.
    try:
        rv = env._cache[key]
    except KeyError:
        if "SENTRY_RUNNING_UWSGI" in os.environ:
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

ENVIRONMENT = os.environ.get("SENTRY_ENVIRONMENT", "production")

IS_DEV = ENVIRONMENT == "development"

DEBUG = IS_DEV

ADMIN_ENABLED = DEBUG

ADMINS = ()

# Hosts that are considered in the same network (including VPNs).
INTERNAL_IPS = ()

# List of IP subnets which should not be accessible
SENTRY_DISALLOWED_IPS = ()

# When resolving DNS for external sources (source map fetching, webhooks, etc),
# ensure that domains are fully resolved first to avoid poking internal
# search domains.
SENTRY_ENSURE_FQDN = False

# Hosts that are allowed to use system token authentication.
# http://en.wikipedia.org/wiki/Reserved_IP_addresses
INTERNAL_SYSTEM_IPS = (
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/29",
    "192.0.2.0/24",
    "192.88.99.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
    "255.255.255.255/32",
)

MANAGERS = ADMINS

APPEND_SLASH = True

PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

# XXX(dcramer): handle case when we've installed from source vs just running
# this straight out of the repository
if "site-packages" in __file__:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, "node_modules")
else:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, os.pardir, os.pardir, "node_modules")

NODE_MODULES_ROOT = os.path.normpath(NODE_MODULES_ROOT)

DEVSERVICES_CONFIG_DIR = os.path.normpath(
    os.path.join(PROJECT_ROOT, os.pardir, os.pardir, "config")
)

SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES = False

RELAY_CONFIG_DIR = os.path.join(DEVSERVICES_CONFIG_DIR, "relay")

SYMBOLICATOR_CONFIG_DIR = os.path.join(DEVSERVICES_CONFIG_DIR, "symbolicator")

# XXX(epurkhiser): The generated chartucterie config.js file will be stored
# here. This directory may not exist until that file is generated.
CHARTCUTERIE_CONFIG_DIR = os.path.join(DEVSERVICES_CONFIG_DIR, "chartcuterie")

CDC_CONFIG_DIR = os.path.join(DEVSERVICES_CONFIG_DIR, "cdc")

sys.path.insert(0, os.path.normpath(os.path.join(PROJECT_ROOT, os.pardir)))

DATABASES = {
    "default": {
        "ENGINE": "sentry.db.postgres",
        "NAME": "sentry",
        "USER": "postgres",
        "PASSWORD": "",
        "HOST": "127.0.0.1",
        "PORT": "",
        "AUTOCOMMIT": True,
        "ATOMIC_REQUESTS": False,
    }
}

if "DATABASE_URL" in os.environ:
    url = urlparse(os.environ["DATABASE_URL"])

    # Ensure default database exists.
    DATABASES["default"] = DATABASES.get("default", {})

    # Update with environment configuration.
    DATABASES["default"].update(
        {
            "NAME": url.path[1:],
            "USER": url.username,
            "PASSWORD": url.password,
            "HOST": url.hostname,
            "PORT": url.port,
        }
    )
    if url.scheme == "postgres":
        DATABASES["default"]["ENGINE"] = "sentry.db.postgres"

# This should always be UTC.
TIME_ZONE = "UTC"

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = "en-us"

LANGUAGES = (
    ("af", gettext_noop("Afrikaans")),
    ("ar", gettext_noop("Arabic")),
    ("az", gettext_noop("Azerbaijani")),
    ("bg", gettext_noop("Bulgarian")),
    ("be", gettext_noop("Belarusian")),
    ("bn", gettext_noop("Bengali")),
    ("br", gettext_noop("Breton")),
    ("bs", gettext_noop("Bosnian")),
    ("ca", gettext_noop("Catalan")),
    ("cs", gettext_noop("Czech")),
    ("cy", gettext_noop("Welsh")),
    ("da", gettext_noop("Danish")),
    ("de", gettext_noop("German")),
    ("el", gettext_noop("Greek")),
    ("en", gettext_noop("English")),
    ("eo", gettext_noop("Esperanto")),
    ("es", gettext_noop("Spanish")),
    ("et", gettext_noop("Estonian")),
    ("eu", gettext_noop("Basque")),
    ("fa", gettext_noop("Persian")),
    ("fi", gettext_noop("Finnish")),
    ("fr", gettext_noop("French")),
    ("ga", gettext_noop("Irish")),
    ("gl", gettext_noop("Galician")),
    ("he", gettext_noop("Hebrew")),
    ("hi", gettext_noop("Hindi")),
    ("hr", gettext_noop("Croatian")),
    ("hu", gettext_noop("Hungarian")),
    ("ia", gettext_noop("Interlingua")),
    ("id", gettext_noop("Indonesian")),
    ("is", gettext_noop("Icelandic")),
    ("it", gettext_noop("Italian")),
    ("ja", gettext_noop("Japanese")),
    ("ka", gettext_noop("Georgian")),
    ("kk", gettext_noop("Kazakh")),
    ("km", gettext_noop("Khmer")),
    ("kn", gettext_noop("Kannada")),
    ("ko", gettext_noop("Korean")),
    ("lb", gettext_noop("Luxembourgish")),
    ("lt", gettext_noop("Lithuanian")),
    ("lv", gettext_noop("Latvian")),
    ("mk", gettext_noop("Macedonian")),
    ("ml", gettext_noop("Malayalam")),
    ("mn", gettext_noop("Mongolian")),
    ("my", gettext_noop("Burmese")),
    ("nb", gettext_noop("Norwegian Bokmal")),
    ("ne", gettext_noop("Nepali")),
    ("nl", gettext_noop("Dutch")),
    ("nn", gettext_noop("Norwegian Nynorsk")),
    ("os", gettext_noop("Ossetic")),
    ("pa", gettext_noop("Punjabi")),
    ("pl", gettext_noop("Polish")),
    ("pt", gettext_noop("Portuguese")),
    ("pt-br", gettext_noop("Brazilian Portuguese")),
    ("ro", gettext_noop("Romanian")),
    ("ru", gettext_noop("Russian")),
    ("sk", gettext_noop("Slovak")),
    ("sl", gettext_noop("Slovenian")),
    ("sq", gettext_noop("Albanian")),
    ("sr", gettext_noop("Serbian")),
    ("sv-se", gettext_noop("Swedish")),
    ("sw", gettext_noop("Swahili")),
    ("ta", gettext_noop("Tamil")),
    ("te", gettext_noop("Telugu")),
    ("th", gettext_noop("Thai")),
    ("tr", gettext_noop("Turkish")),
    ("tt", gettext_noop("Tatar")),
    ("udm", gettext_noop("Udmurt")),
    ("uk", gettext_noop("Ukrainian")),
    ("ur", gettext_noop("Urdu")),
    ("vi", gettext_noop("Vietnamese")),
    ("zh-cn", gettext_noop("Simplified Chinese")),
    ("zh-tw", gettext_noop("Traditional Chinese")),
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

# CAVEAT: If you're adding a middleware that modifies a response's content,
# and appears before CommonMiddleware, you must either reorder your middleware
# so that responses aren't modified after Content-Length is set, or have the
# response modifying middleware reset the Content-Length header.
# This is because CommonMiddleware Sets the Content-Length header for non-streaming responses.
MIDDLEWARE = (
    "sentry.middleware.health.HealthCheck",
    "sentry.middleware.security.SecurityHeadersMiddleware",
    "sentry.middleware.env.SentryEnvMiddleware",
    "sentry.middleware.proxy.SetRemoteAddrFromForwardedFor",
    "sentry.middleware.stats.RequestTimingMiddleware",
    "sentry.middleware.stats.ResponseCodeMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "sentry.middleware.auth.AuthenticationMiddleware",
    "sentry.middleware.user.UserActiveMiddleware",
    "sentry.middleware.sudo.SudoMiddleware",
    "sentry.middleware.superuser.SuperuserMiddleware",
    "sentry.middleware.locale.SentryLocaleMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
)

ROOT_URLCONF = "sentry.conf.urls"

# TODO(joshuarli): Django 1.10 introduced this option, which restricts the size of a
# request body. We have some middleware in sentry.middleware.proxy that sets the
# Content Length to max uint32 in certain cases related to minidump.
# Once relay's fully rolled out, that can be deleted.
# Until then, the safest and easiest thing to do is to disable this check
# to leave things the way they were with Django <1.9.
DATA_UPLOAD_MAX_MEMORY_SIZE = None

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(PROJECT_ROOT, "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.csrf",
                "django.template.context_processors.request",
            ]
        },
    }
]

INSTALLED_APPS = (
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.messages",
    "django.contrib.sessions",
    "django.contrib.sites",
    "crispy_forms",
    "rest_framework",
    "sentry",
    "sentry.analytics",
    "sentry.incidents.apps.Config",
    "sentry.discover",
    "sentry.analytics.events",
    "sentry.nodestore",
    "sentry.search",
    "sentry.snuba",
    "sentry.lang.java.apps.Config",
    "sentry.lang.javascript.apps.Config",
    "sentry.lang.native.apps.Config",
    "sentry.plugins.sentry_interface_types.apps.Config",
    "sentry.plugins.sentry_urls.apps.Config",
    "sentry.plugins.sentry_useragents.apps.Config",
    "sentry.plugins.sentry_webhooks.apps.Config",
    "social_auth",
    "sudo",
    "sentry.eventstream",
    "sentry.auth.providers.google.apps.Config",
    "django.contrib.staticfiles",
)

# Silence internal hints from Django's system checks
SILENCED_SYSTEM_CHECKS = (
    # Django recommends to use OneToOneField over ForeignKey(unique=True)
    # however this changes application behavior in ways that break association
    # loading
    "fields.W342",
    # We have a "catch-all" react_page_view that we only want to match on URLs
    # ending with a `/` to allow APPEND_SLASHES to kick in for the ones lacking
    # the trailing slash. This confuses the warning as the regex is `/$` which
    # looks like it starts with a slash but it doesn't.
    "urls.W002",
    # Our own AuthenticationMiddleware suffices as a replacement for
    # django.contrib.auth.middleware.AuthenticationMiddleware; both add the
    # authenticated user to the HttpRequest which is what's needed here.
    "admin.E408",
    # This is fixed in Django@7c08f26bf0439c1ed593b51b51ad847f7e262bc1.
    # It's not our problem; refer to Django issue 32260.
    "urls.E007",
)

STATIC_ROOT = os.path.realpath(os.path.join(PROJECT_ROOT, "static"))
STATIC_URL = "/_static/{version}/"
# webpack assets live at a different URL that is unversioned
# as we configure webpack to include file content based hash in the filename
STATIC_FRONTEND_APP_URL = "/_static/dist/"

# The webpack output directory
STATICFILES_DIRS = [
    os.path.join(STATIC_ROOT, "sentry", "dist"),
]

# various middleware will use this to identify resources which should not access
# cookies
ANONYMOUS_STATIC_PREFIXES = (
    "/_static/",
    "/avatar/",
    "/organization-avatar/",
    "/team-avatar/",
    "/project-avatar/",
    "/js-sdk-loader/",
)

STATICFILES_FINDERS = (
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
)

ASSET_VERSION = 0

# setup a default media root to somewhere useless
MEDIA_ROOT = "/tmp/sentry-files"
MEDIA_URL = "_media/"

LOCALE_PATHS = (os.path.join(PROJECT_ROOT, "locale"),)

CSRF_FAILURE_VIEW = "sentry.web.frontend.csrf_failure.view"
CSRF_COOKIE_NAME = "sc"

# Auth configuration

from django.urls import reverse_lazy

LOGIN_REDIRECT_URL = reverse_lazy("sentry-login-redirect")
LOGIN_URL = reverse_lazy("sentry-login")

AUTHENTICATION_BACKENDS = (
    "sentry.utils.auth.EmailAuthBackend",
    # The following authentication backends are used by social auth only.
    # We don't use them for user authentication.
    "social_auth.backends.asana.AsanaBackend",
    "social_auth.backends.github.GithubBackend",
    "social_auth.backends.bitbucket.BitbucketBackend",
    "social_auth.backends.visualstudio.VisualStudioBackend",
)

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "sentry.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 6},
    },
    {
        "NAME": "sentry.auth.password_validation.MaximumLengthValidator",
        "OPTIONS": {"max_length": 256},
    },
]

SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL = "sentry.User"

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = "sentrysid"

# setting SESSION_COOKIE_SAMESITE to None below for now because
# Django's default in 2.1 now `Lax`.
# this breaks certain IDP flows where we need cookies sent to us on a redirected POST
# request, and `Lax` doesnt permit this.
# See here: https://docs.djangoproject.com/en/2.1/ref/settings/#session-cookie-samesite
SESSION_COOKIE_SAMESITE = None

SESSION_SERIALIZER = "django.contrib.sessions.serializers.PickleSerializer"

GOOGLE_OAUTH2_CLIENT_ID = ""
GOOGLE_OAUTH2_CLIENT_SECRET = ""

BITBUCKET_CONSUMER_KEY = ""
BITBUCKET_CONSUMER_SECRET = ""

ASANA_CLIENT_ID = ""
ASANA_CLIENT_SECRET = ""

VISUALSTUDIO_APP_ID = ""
VISUALSTUDIO_APP_SECRET = ""
VISUALSTUDIO_CLIENT_SECRET = ""
VISUALSTUDIO_SCOPES = ["vso.work_write", "vso.project", "vso.code", "vso.release"]

SOCIAL_AUTH_PIPELINE = (
    "social_auth.backends.pipeline.user.get_username",
    "social_auth.backends.pipeline.social.social_auth_user",
    "social_auth.backends.pipeline.associate.associate_by_email",
    "social_auth.backends.pipeline.misc.save_status_to_session",
    "social_auth.backends.pipeline.social.associate_user",
    "social_auth.backends.pipeline.social.load_extra_data",
    "social_auth.backends.pipeline.user.update_user_details",
    "social_auth.backends.pipeline.misc.save_status_to_session",
)
SOCIAL_AUTH_REVOKE_TOKENS_ON_DISCONNECT = True
SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/account/settings/identities/"
SOCIAL_AUTH_ASSOCIATE_ERROR_URL = SOCIAL_AUTH_LOGIN_REDIRECT_URL

INITIAL_CUSTOM_USER_MIGRATION = "0108_fix_user"

# Auth engines and the settings required for them to be listed
AUTH_PROVIDERS = {
    "github": ("GITHUB_APP_ID", "GITHUB_API_SECRET"),
    "bitbucket": ("BITBUCKET_CONSUMER_KEY", "BITBUCKET_CONSUMER_SECRET"),
    "asana": ("ASANA_CLIENT_ID", "ASANA_CLIENT_SECRET"),
    "visualstudio": (
        "VISUALSTUDIO_APP_ID",
        "VISUALSTUDIO_APP_SECRET",
        "VISUALSTUDIO_CLIENT_SECRET",
    ),
}

AUTH_PROVIDER_LABELS = {
    "github": "GitHub",
    "bitbucket": "Bitbucket",
    "asana": "Asana",
    "visualstudio": "Visual Studio",
}

import random


def SOCIAL_AUTH_DEFAULT_USERNAME():
    return random.choice(["Darth Vader", "Obi-Wan Kenobi", "R2-D2", "C-3PO", "Yoda"])


SOCIAL_AUTH_PROTECTED_USER_FIELDS = ["email"]
SOCIAL_AUTH_FORCE_POST_DISCONNECT = True

# Queue configuration
from kombu import Exchange, Queue

BROKER_URL = "redis://127.0.0.1:6379"
BROKER_TRANSPORT_OPTIONS = {}

# Ensure workers run async by default
# in Development you might want them to run in-process
# though it would cause timeouts/recursions in some cases
CELERY_ALWAYS_EAGER = False

# We use the old task protocol because during benchmarking we noticed that it's faster
# than the new protocol. If we ever need to bump this it should be fine, there were no
# compatibility issues, just need to run benchmarks and do some tests to make sure
# things run ok.
CELERY_TASK_PROTOCOL = 1
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
CELERY_TASK_SERIALIZER = "pickle"
CELERY_RESULT_SERIALIZER = "pickle"
CELERY_ACCEPT_CONTENT = {"pickle"}
CELERY_IMPORTS = (
    "sentry.data_export.tasks",
    "sentry.discover.tasks",
    "sentry.incidents.tasks",
    "sentry.snuba.tasks",
    "sentry.tasks.app_store_connect",
    "sentry.tasks.assemble",
    "sentry.tasks.auth",
    "sentry.tasks.auto_remove_inbox",
    "sentry.tasks.auto_resolve_issues",
    "sentry.tasks.beacon",
    "sentry.tasks.check_auth",
    "sentry.tasks.check_monitors",
    "sentry.tasks.clear_expired_snoozes",
    "sentry.tasks.collect_project_platforms",
    "sentry.tasks.commits",
    "sentry.tasks.deletion",
    "sentry.tasks.digests",
    "sentry.tasks.email",
    "sentry.tasks.files",
    "sentry.tasks.groupowner",
    "sentry.tasks.integrations",
    "sentry.tasks.members",
    "sentry.tasks.merge",
    "sentry.tasks.releasemonitor",
    "sentry.tasks.options",
    "sentry.tasks.ping",
    "sentry.tasks.post_process",
    "sentry.tasks.process_buffer",
    "sentry.tasks.relay",
    "sentry.tasks.release_registry",
    "sentry.tasks.reports",
    "sentry.tasks.reprocessing",
    "sentry.tasks.scheduler",
    "sentry.tasks.sentry_apps",
    "sentry.tasks.servicehooks",
    "sentry.tasks.store",
    "sentry.tasks.unmerge",
    "sentry.tasks.update_user_reports",
    "sentry.tasks.user_report",
)
CELERY_QUEUES = [
    Queue("activity.notify", routing_key="activity.notify"),
    Queue("alerts", routing_key="alerts"),
    Queue("app_platform", routing_key="app_platform"),
    Queue("appstoreconnect", routing_key="sentry.tasks.app_store_connect.#"),
    Queue("assemble", routing_key="assemble"),
    Queue("auth", routing_key="auth"),
    Queue("buffers.process_pending", routing_key="buffers.process_pending"),
    Queue("cleanup", routing_key="cleanup"),
    Queue("code_owners", routing_key="code_owners"),
    Queue("commits", routing_key="commits"),
    Queue("data_export", routing_key="data_export"),
    Queue("default", routing_key="default"),
    Queue("digests.delivery", routing_key="digests.delivery"),
    Queue("digests.scheduling", routing_key="digests.scheduling"),
    Queue("email", routing_key="email"),
    Queue("events.preprocess_event", routing_key="events.preprocess_event"),
    Queue("events.process_event", routing_key="events.process_event"),
    Queue("events.reprocess_events", routing_key="events.reprocess_events"),
    Queue(
        "events.reprocessing.preprocess_event", routing_key="events.reprocessing.preprocess_event"
    ),
    Queue("events.reprocessing.process_event", routing_key="events.reprocessing.process_event"),
    Queue(
        "events.reprocessing.symbolicate_event", routing_key="events.reprocessing.symbolicate_event"
    ),
    Queue("events.save_event", routing_key="events.save_event"),
    Queue("events.symbolicate_event", routing_key="events.symbolicate_event"),
    Queue("files.delete", routing_key="files.delete"),
    Queue(
        "group_owners.process_suspect_commits", routing_key="group_owners.process_suspect_commits"
    ),
    Queue(
        "releasemonitor",
        routing_key="releasemonitor",
    ),
    Queue("incidents", routing_key="incidents"),
    Queue("incident_snapshots", routing_key="incident_snapshots"),
    Queue("incidents", routing_key="incidents"),
    Queue("integrations", routing_key="integrations"),
    Queue("merge", routing_key="merge"),
    Queue("options", routing_key="options"),
    Queue("relay_config", routing_key="relay_config"),
    Queue("reports.deliver", routing_key="reports.deliver"),
    Queue("reports.prepare", routing_key="reports.prepare"),
    Queue("search", routing_key="search"),
    Queue("sleep", routing_key="sleep"),
    Queue("stats", routing_key="stats"),
    Queue("subscriptions", routing_key="subscriptions"),
    Queue("unmerge", routing_key="unmerge"),
    Queue("update", routing_key="update"),
]

for queue in CELERY_QUEUES:
    queue.durable = False

CELERY_ROUTES = ("sentry.queue.routers.SplitQueueRouter",)


def create_partitioned_queues(name):
    exchange = Exchange(name, type="direct")
    for num in range(1):
        CELERY_QUEUES.append(Queue(f"{name}-{num}", exchange=exchange))


create_partitioned_queues("counters")
create_partitioned_queues("triggers")

from celery.schedules import crontab

# XXX: Make sure to register the monitor_id for each job in `SENTRY_CELERYBEAT_MONITORS`!
CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), "sentry-celerybeat")
CELERYBEAT_SCHEDULE = {
    "check-auth": {
        "task": "sentry.tasks.check_auth",
        "schedule": timedelta(minutes=1),
        "options": {"expires": 60, "queue": "auth"},
    },
    "enqueue-scheduled-jobs": {
        "task": "sentry.tasks.enqueue_scheduled_jobs",
        "schedule": timedelta(minutes=1),
        "options": {"expires": 60},
    },
    "send-beacon": {
        "task": "sentry.tasks.send_beacon",
        "schedule": timedelta(hours=1),
        "options": {"expires": 3600},
    },
    "send-ping": {
        "task": "sentry.tasks.send_ping",
        "schedule": timedelta(minutes=1),
        "options": {"expires": 60},
    },
    "flush-buffers": {
        "task": "sentry.tasks.process_buffer.process_pending",
        "schedule": timedelta(seconds=10),
        "options": {"expires": 10, "queue": "buffers.process_pending"},
    },
    "sync-options": {
        "task": "sentry.tasks.options.sync_options",
        "schedule": timedelta(seconds=10),
        "options": {"expires": 10, "queue": "options"},
    },
    "schedule-digests": {
        "task": "sentry.tasks.digests.schedule_digests",
        "schedule": timedelta(seconds=30),
        "options": {"expires": 30},
    },
    "check-monitors": {
        "task": "sentry.tasks.check_monitors",
        "schedule": timedelta(minutes=1),
        "options": {"expires": 60},
    },
    "clear-expired-snoozes": {
        "task": "sentry.tasks.clear_expired_snoozes",
        "schedule": timedelta(minutes=5),
        "options": {"expires": 300},
    },
    "clear-expired-raw-events": {
        "task": "sentry.tasks.clear_expired_raw_events",
        "schedule": timedelta(minutes=15),
        "options": {"expires": 300},
    },
    "collect-project-platforms": {
        "task": "sentry.tasks.collect_project_platforms",
        "schedule": crontab_with_minute_jitter(hour=3),
        "options": {"expires": 3600 * 24},
    },
    "update-user-reports": {
        "task": "sentry.tasks.update_user_reports",
        "schedule": timedelta(minutes=15),
        "options": {"expires": 300},
    },
    "schedule-auto-resolution": {
        "task": "sentry.tasks.schedule_auto_resolution",
        "schedule": timedelta(minutes=15),
        "options": {"expires": 60 * 25},
    },
    "auto-remove-inbox": {
        "task": "sentry.tasks.auto_remove_inbox",
        "schedule": timedelta(minutes=15),
        "options": {"expires": 60 * 25},
    },
    "schedule-deletions": {
        "task": "sentry.tasks.deletion.run_scheduled_deletions",
        "schedule": timedelta(minutes=15),
        "options": {"expires": 60 * 25},
    },
    "reattempt-deletions": {
        "task": "sentry.tasks.deletion.reattempt_deletions",
        "schedule": crontab(hour=10, minute=0),  # 03:00 PDT, 07:00 EDT, 10:00 UTC
        "options": {"expires": 60 * 25},
    },
    "schedule-weekly-organization-reports": {
        "task": "sentry.tasks.reports.prepare_reports",
        "schedule": crontab(
            minute=0, hour=12, day_of_week="monday"  # 05:00 PDT, 09:00 EDT, 12:00 UTC
        ),
        "options": {"expires": 60 * 60 * 3},
    },
    "schedule-vsts-integration-subscription-check": {
        "task": "sentry.tasks.integrations.kickoff_vsts_subscription_check",
        "schedule": crontab_with_minute_jitter(hour="*/6"),
        "options": {"expires": 60 * 25},
    },
    "process_pending_incident_snapshots": {
        "task": "sentry.incidents.tasks.process_pending_incident_snapshots",
        "schedule": timedelta(hours=1),
        "options": {"expires": 3600, "queue": "incidents"},
    },
    "monitor-release-adoption": {
        "task": "sentry.tasks.monitor_release_adoption",
        "schedule": crontab(minute=0),
        "options": {"expires": 3600, "queue": "releasemonitor"},
    },
    "fetch-release-registry-data": {
        "task": "sentry.tasks.release_registry.fetch_release_registry_data",
        "schedule": timedelta(minutes=5),
        "options": {"expires": 3600},
    },
    "fetch-appstore-builds": {
        "task": "sentry.tasks.app_store_connect.refresh_all_builds",
        "schedule": timedelta(hours=1),
        "options": {"expires": 3600},
    },
    "snuba-subscription-checker": {
        "task": "sentry.snuba.tasks.subscription_checker",
        "schedule": timedelta(minutes=20),
        "options": {"expires": 20 * 60},
    },
}

BGTASKS = {
    "sentry.bgtasks.clean_dsymcache:clean_dsymcache": {"interval": 5 * 60, "roles": ["worker"]},
    "sentry.bgtasks.clean_releasefilecache:clean_releasefilecache": {
        "interval": 5 * 60,
        "roles": ["worker"],
    },
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
    "default_level": "INFO",
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {
        "null": {"class": "logging.NullHandler"},
        "console": {"class": "sentry.logging.handlers.StructLogHandler"},
        "internal": {"level": "ERROR", "class": "sentry_sdk.integrations.logging.EventHandler"},
        "metrics": {
            "level": "WARNING",
            "filters": ["important_django_request"],
            "class": "sentry.logging.handlers.MetricsLogHandler",
        },
        "django_internal": {
            "level": "WARNING",
            "filters": ["important_django_request"],
            "class": "sentry_sdk.integrations.logging.EventHandler",
        },
    },
    "filters": {
        "important_django_request": {
            "()": "sentry.logging.handlers.MessageContainsFilter",
            "contains": ["CSRF"],
        }
    },
    "root": {"level": "NOTSET", "handlers": ["console", "internal"]},
    # LOGGING.overridable is a list of loggers including root that will change
    # based on the overridden level defined above.
    "overridable": ["celery", "sentry"],
    "loggers": {
        "celery": {"level": "WARNING"},
        "sentry": {"level": "INFO"},
        "sentry_plugins": {"level": "INFO"},
        "sentry.files": {"level": "WARNING"},
        "sentry.minidumps": {"handlers": ["internal"], "propagate": False},
        "sentry.reprocessing": {"handlers": ["internal"], "propagate": False},
        "sentry.interfaces": {"handlers": ["internal"], "propagate": False},
        # This only needs to go to Sentry for now.
        "sentry.similarity": {"handlers": ["internal"], "propagate": False},
        "sentry.errors": {"handlers": ["console"], "propagate": False},
        "sentry_sdk.errors": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "sentry.rules": {"handlers": ["console"], "propagate": False},
        "multiprocessing": {
            "handlers": ["console"],
            # https://github.com/celery/celery/commit/597a6b1f3359065ff6dbabce7237f86b866313df
            # This commit has not been rolled into any release and leads to a
            # large amount of errors when working with postgres.
            "level": "CRITICAL",
            "propagate": False,
        },
        "celery.worker.job": {"handlers": ["console"], "propagate": False},
        "static_compiler": {"level": "INFO"},
        "django.request": {
            "level": "WARNING",
            "handlers": ["console", "metrics", "django_internal"],
            "propagate": False,
        },
        "toronado": {"level": "ERROR", "handlers": ["null"], "propagate": False},
        "urllib3.connectionpool": {"level": "ERROR", "handlers": ["console"], "propagate": False},
        "boto3": {"level": "WARNING", "handlers": ["console"], "propagate": False},
        "botocore": {"level": "WARNING", "handlers": ["console"], "propagate": False},
    },
}

# django-rest-framework

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "DEFAULT_PERMISSION_CLASSES": ("sentry.api.permissions.NoPermission",),
    "EXCEPTION_HANDLER": "sentry.api.handlers.custom_exception_handler",
}

CRISPY_TEMPLATE_PACK = "bootstrap3"

# Sentry and internal client configuration

SENTRY_FEATURES = {
    # Enables user registration.
    "auth:register": True,
    # Enable advanced search features, like negation and wildcard matching.
    "organizations:advanced-search": True,
    # Enable obtaining and using API keys.
    "organizations:api-keys": False,
    # Enable Apple app-store-connect dsym symbol file collection.
    "organizations:app-store-connect": False,
    # Enable multiple Apple app-store-connect sources per project.
    "organizations:app-store-connect-multiple": False,
    # Enable explicit use of AND and OR in search.
    "organizations:boolean-search": False,
    # Enable unfurling charts using the Chartcuterie service
    "organizations:chart-unfurls": False,
    # Enable alerting based on crash free sessions/users
    "organizations:crash-rate-alerts": False,
    # Enable creating organizations within sentry (if SENTRY_SINGLE_ORGANIZATION
    # is not enabled).
    "organizations:create": True,
    # Enable the 'discover' interface.
    "organizations:discover": False,
    # Enable attaching arbitrary files to events.
    "organizations:event-attachments": True,
    # Enable inline preview of attachments.
    "organizations:event-attachments-viewer": True,
    # Enable Filters & Sampling in the org settings
    "organizations:filters-and-sampling": False,
    # Allow organizations to configure built-in symbol sources.
    "organizations:symbol-sources": True,
    # Allow organizations to configure custom external symbol sources.
    "organizations:custom-symbol-sources": True,
    # Enable the events stream interface.
    "organizations:events": False,
    # Enable discover 2 basic functions
    "organizations:discover-basic": True,
    # Enable discover 2 custom queries and saved queries
    "organizations:discover-query": True,
    # Enable discover top events queries with other & higher options
    "organizations:discover-top-events": False,
    # Enable Performance view
    "organizations:performance-view": True,
    # Enable multi project selection
    "organizations:global-views": False,
    # Enable experimental new version of Merged Issues where sub-hashes are shown
    "organizations:grouping-tree-ui": False,
    # Enable experimental new version of stacktrace component where additional
    # data related to grouping is shown on each frame
    "organizations:grouping-stacktrace-ui": False,
    # Enable tweaks to group title in relation to hierarchical
    # grouping.
    "organizations:grouping-title-ui": False,
    # Lets organizations manage grouping configs
    "organizations:set-grouping-config": False,
    # Lets organizations set a custom title through fingerprinting
    "organizations:custom-event-title": True,
    # Enable rule page.
    "organizations:rule-page": False,
    # Enable imporved syntax highlightign + autocomplete on unified search
    "organizations:improved-search": False,
    # Enable incidents feature
    "organizations:incidents": False,
    # Flags for enabling CdcEventsDatasetSnubaSearchBackend in sentry.io. No effect in open-source
    # sentry at the moment.
    "organizations:issue-search-use-cdc-primary": False,
    "organizations:issue-search-use-cdc-secondary": False,
    # Enable the new Metrics page
    "organizations:metrics": False,
    # Automatically extract metrics during ingestion.
    #
    # XXX(ja): DO NOT ENABLE UNTIL THIS NOTICE IS GONE. Relay experiences
    # gradual slowdown when this is enabled for too many projects.
    "organizations:metrics-extraction": False,
    # Enable metric aggregate in metric alert rule builder
    "organizations:metric-alert-builder-aggregate": False,
    # Enable integration functionality to create and link groups to issues on
    # external services.
    "organizations:integrations-issue-basic": True,
    # Enable interface functionality to synchronize groups between sentry and
    # issues on external services.
    "organizations:integrations-issue-sync": True,
    # Enable interface functionality to receive event hooks.
    "organizations:integrations-event-hooks": True,
    # Enable integration functionality to work with alert rules
    "organizations:integrations-alert-rule": True,
    # Enable integration functionality to work with alert rules (specifically chat integrations)
    "organizations:integrations-chat-unfurl": True,
    # Enable integration functionality to work with alert rules (specifically incident
    # management integrations)
    "organizations:integrations-incident-management": True,
    # Allow orgs to automatically create Tickets in Issue Alerts
    "organizations:integrations-ticket-rules": True,
    # Allow orgs to install AzureDevops with limited scopes
    "organizations:integrations-vsts-limited-scopes": False,
    # Allow orgs to use the stacktrace linking feature
    "organizations:integrations-stacktrace-link": False,
    # Allow orgs to install a custom source code management integration
    "organizations:integrations-custom-scm": False,
    # Allow orgs to debug internal/unpublished sentry apps with logging
    "organizations:sentry-app-debugging": False,
    # Temporary safety measure, turned on for specific orgs only if
    # absolutely necessary, to be removed shortly
    "organizations:slack-allow-workspace": False,
    # Enable data forwarding functionality for organizations.
    "organizations:data-forwarding": True,
    # Enable readonly dashboards
    "organizations:dashboards-basic": True,
    # Enable custom editable dashboards
    "organizations:dashboards-edit": True,
    # Enable navigation features between Discover and Dashboards
    "organizations:connect-discover-and-dashboards": False,
    # Enable experimental performance improvements.
    "organizations:enterprise-perf": False,
    # Enable the API to importing CODEOWNERS for a project
    "organizations:integrations-codeowners": False,
    # Enable inviting members to organizations.
    "organizations:invite-members": True,
    # Enable rate limits for inviting members.
    "organizations:invite-members-rate-limits": True,
    # Prefix host with organization ID when giving users DSNs (can be
    # customized with SENTRY_ORG_SUBDOMAIN_TEMPLATE)
    "organizations:org-subdomains": False,
    # Display a global dashboard notification for this org
    "organizations:prompt-dashboards": False,
    "organizations:prompt-additional-volume": False,
    "organizations:prompt-additional-volume-on-demand": False,
    "organizations:prompt-on-demand-orgs": False,
    "organizations:prompt-release-health-adoption": False,
    "organizations:prompt-upgrade-via-dashboards": False,
    # Enable views for ops breakdown
    "organizations:performance-ops-breakdown": False,
    # Enable views for tag explorer
    "organizations:performance-tag-explorer": True,
    # Enable views for tag page
    "organizations:performance-tag-page": True,
    # Enable landing improvements for performance
    "organizations:performance-landing-widgets": False,
    # Enable views for transaction events page in performance
    "organizations:performance-events-page": False,
    # Enable interpolation of null data points in charts instead of zerofilling in performance
    "organizations:performance-chart-interpolation": False,
    # Enable ingestion for suspect spans
    "organizations:performance-suspect-spans-ingestion": False,
    # Enable views for suspect tags
    "organizations:performance-suspect-spans-view": False,
    # Enable the new Related Events feature
    "organizations:related-events": False,
    # Enable usage of external relays, for use with Relay. See
    # https://github.com/getsentry/relay.
    "organizations:relay": True,
    # Enable Session Stats down to a minute resolution
    "organizations:minute-resolution-sessions": False,
    # Automatically opt IN users to receiving Slack notifications.
    "organizations:notification-slack-automatic": False,
    # Enable version 2 of reprocessing (completely distinct from v1)
    "organizations:reprocessing-v2": False,
    # Enable sorting+filtering by semantic version of a release
    "organizations:semver": False,
    # Enable basic SSO functionality, providing configurable single sign on
    # using services like GitHub / Google. This is *not* the same as the signup
    # and login with Github / Azure DevOps that sentry.io provides.
    "organizations:sso-basic": True,
    # Enable SAML2 based SSO functionality. getsentry/sentry-auth-saml2 plugin
    # must be installed to use this functionality.
    "organizations:sso-saml2": True,
    # Enable Rippling SSO functionality.
    "organizations:sso-rippling": False,
    # Enable SCIM Provisioning functionality.
    "organizations:sso-scim": False,
    # Enable workaround for migrating IdP instances
    "organizations:sso-migration": False,
    # Enable transaction comparison view for performance.
    "organizations:transaction-comparison": False,
    # Return unhandled information on the issue level
    "organizations:unhandled-issue-flag": True,
    # Enable percent-based conditions on issue rules
    "organizations:issue-percent-filters": False,
    # Enable the new alert details ux design
    "organizations:alert-details-redesign": True,
    # Enable the new images loaded design and features
    "organizations:images-loaded-v2": True,
    # Enable the mobile screenshots feature
    "organizations:mobile-screenshots": False,
    # Enable the adoption chart in the releases page
    "organizations:release-adoption-chart": False,
    # Enable the release adoption stage labels and sorting+filtering by them
    "organizations:release-adoption-stage": False,
    # Store release bundles as zip files instead of single files
    "organizations:release-archives": False,
    # Enable the new release details experience
    "organizations:release-comparison": False,
    # Enable the project level transaction thresholds
    "organizations:project-transaction-threshold": False,
    # Enable the transaction level thresholds
    "organizations:project-transaction-threshold-override": False,
    # Enable percent displays in issue stream
    "organizations:issue-percent-display": False,
    # Enable team insights page
    "organizations:team-insights": False,
    # Adds additional filters and a new section to issue alert rules.
    "projects:alert-filters": True,
    # Enable functionality to specify custom inbound filters on events.
    "projects:custom-inbound-filters": False,
    # Enable data forwarding functionality for projects.
    "projects:data-forwarding": True,
    # Enable functionality to discard groups.
    "projects:discard-groups": False,
    # DEPRECATED: pending removal
    "projects:dsym": False,
    # Enable selection of members, teams or code owners as email targets for issue alerts.
    "projects:issue-alerts-targeting": True,
    # Enable functionality for attaching  minidumps to events and displaying
    # then in the group UI.
    "projects:minidump": True,
    # Enable functionality for project plugins.
    "projects:plugins": True,
    # Enable alternative version of group creation that is supposed to be less racy.
    "projects:race-free-group-creation": True,
    # Enable functionality for rate-limiting events on projects.
    "projects:rate-limits": True,
    # Enable functionality to trigger service hooks upon event ingestion.
    "projects:servicehooks": False,
    # Use Kafka (instead of Celery) for ingestion pipeline.
    "projects:kafka-ingest": False,
    # Don't add feature defaults down here! Please add them in their associated
    # group sorted alphabetically.
}

# Default time zone for localization in the UI.
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
SENTRY_DEFAULT_TIME_ZONE = "UTC"

# Enable the Sentry Debugger (Beta)
SENTRY_DEBUGGER = None

SENTRY_IGNORE_EXCEPTIONS = ("OperationalError",)

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

# Default organization to represent the Internal Sentry project.
# Used as a default when in SINGLE_ORGANIZATION mode.
SENTRY_ORGANIZATION = None

# Project ID for recording frontend (javascript) exceptions
SENTRY_FRONTEND_PROJECT = None
# DSN for the frontend to use explicitly, which takes priority
# over SENTRY_FRONTEND_PROJECT or SENTRY_PROJECT
SENTRY_FRONTEND_DSN = None
# DSN for tracking all client HTTP requests (which can be noisy) [experimental]
SENTRY_FRONTEND_REQUESTS_DSN = None

# Configuration for JavaScript's whitelistUrls - defaults to ALLOWED_HOSTS
SENTRY_FRONTEND_WHITELIST_URLS = None

# ----
# APM config
# ----

# sample rate for transactions initiated from the frontend
SENTRY_FRONTEND_APM_SAMPLING = 0

# sample rate for transactions in the backend
SENTRY_BACKEND_APM_SAMPLING = 0

# Sample rate for symbolicate_event task transactions
SENTRY_SYMBOLICATE_EVENT_APM_SAMPLING = 0

# Sample rate for the process_event task transactions
SENTRY_PROCESS_EVENT_APM_SAMPLING = 0

# sample rate for the relay projectconfig endpoint
SENTRY_RELAY_ENDPOINT_APM_SAMPLING = 0

# sample rate for ingest consumer processing functions
SENTRY_INGEST_CONSUMER_APM_SAMPLING = 0

# sample rate for Apple App Store Connect tasks transactions
SENTRY_APPCONNECT_APM_SAMPLING = SENTRY_BACKEND_APM_SAMPLING

# sample rate for suspect commits task
SENTRY_SUSPECT_COMMITS_APM_SAMPLING = 0

# sample rate for post_process_group task
SENTRY_POST_PROCESS_GROUP_APM_SAMPLING = 0

# ----
# end APM config
# ----

# DSN to use for Sentry monitors
SENTRY_MONITOR_DSN = None
SENTRY_MONITOR_API_ROOT = None
SENTRY_CELERYBEAT_MONITORS = {
    # 'scheduled-name': 'monitor_guid',
}

# Web Service
SENTRY_WEB_HOST = "127.0.0.1"
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {}

# SMTP Service
SENTRY_SMTP_HOST = "127.0.0.1"
SENTRY_SMTP_PORT = 1025

SENTRY_INTERFACES = {
    "csp": "sentry.interfaces.security.Csp",
    "hpkp": "sentry.interfaces.security.Hpkp",
    "expectct": "sentry.interfaces.security.ExpectCT",
    "expectstaple": "sentry.interfaces.security.ExpectStaple",
    "exception": "sentry.interfaces.exception.Exception",
    "logentry": "sentry.interfaces.message.Message",
    "request": "sentry.interfaces.http.Http",
    "sdk": "sentry.interfaces.sdk.Sdk",
    "stacktrace": "sentry.interfaces.stacktrace.Stacktrace",
    "template": "sentry.interfaces.template.Template",
    "user": "sentry.interfaces.user.User",
    "breadcrumbs": "sentry.interfaces.breadcrumbs.Breadcrumbs",
    "contexts": "sentry.interfaces.contexts.Contexts",
    "threads": "sentry.interfaces.threads.Threads",
    "debug_meta": "sentry.interfaces.debug_meta.DebugMeta",
    "spans": "sentry.interfaces.spans.Spans",
}
PREFER_CANONICAL_LEGACY_KEYS = False

SENTRY_EMAIL_BACKEND_ALIASES = {
    "smtp": "django.core.mail.backends.smtp.EmailBackend",
    "dummy": "django.core.mail.backends.dummy.EmailBackend",
    "console": "django.core.mail.backends.console.EmailBackend",
}

SENTRY_FILESTORE_ALIASES = {
    "filesystem": "django.core.files.storage.FileSystemStorage",
    "s3": "sentry.filestore.s3.S3Boto3Storage",
    "gcs": "sentry.filestore.gcs.GoogleCloudStorage",
}

SENTRY_ANALYTICS_ALIASES = {
    "noop": "sentry.analytics.Analytics",
    "pubsub": "sentry.analytics.pubsub.PubSubAnalytics",
}

# set of backends that do not support needing SMTP mail.* settings
# This list is a bit fragile and hardcoded, but it's unlikely that
# a user will be using a different backend that also mandates SMTP
# credentials.
SENTRY_SMTP_DISABLED_BACKENDS = frozenset(
    (
        "django.core.mail.backends.dummy.EmailBackend",
        "django.core.mail.backends.console.EmailBackend",
        "django.core.mail.backends.locmem.EmailBackend",
        "django.core.mail.backends.filebased.EmailBackend",
        "sentry.utils.email.PreviewBackend",
    )
)

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Will an invite be sent when a member is added to an organization?
SENTRY_ENABLE_INVITES = True

# Origins allowed for session-based API access (via the Access-Control-Allow-Origin header)
SENTRY_ALLOW_ORIGIN = None

# Buffer backend
SENTRY_BUFFER = "sentry.buffer.Buffer"
SENTRY_BUFFER_OPTIONS = {}

# Cache backend
# XXX: We explicitly require the cache to be configured as its not optional
# and causes serious confusion with the default django cache
SENTRY_CACHE = None
SENTRY_CACHE_OPTIONS = {}

# Attachment blob cache backend
SENTRY_ATTACHMENTS = "sentry.attachments.default.DefaultAttachmentCache"
SENTRY_ATTACHMENTS_OPTIONS = {}

# Events blobs processing backend
SENTRY_EVENT_PROCESSING_STORE = "sentry.eventstore.processing.default.DefaultEventProcessingStore"
SENTRY_EVENT_PROCESSING_STORE_OPTIONS = {}

# The internal Django cache is still used in many places
# TODO(dcramer): convert uses over to Sentry's backend
CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}

# The cache version affects both Django's internal cache (at runtime) as well
# as Sentry's cache. This automatically overrides VERSION on the default
# CACHES backend.
CACHE_VERSION = 1

# Digests backend
SENTRY_DIGESTS = "sentry.digests.backends.dummy.DummyBackend"
SENTRY_DIGESTS_OPTIONS = {}

# Quota backend
SENTRY_QUOTAS = "sentry.quotas.Quota"
SENTRY_QUOTA_OPTIONS = {}

# Cache for Relay project configs
SENTRY_RELAY_PROJECTCONFIG_CACHE = "sentry.relay.projectconfig_cache.base.ProjectConfigCache"
SENTRY_RELAY_PROJECTCONFIG_CACHE_OPTIONS = {}

# Which cache to use for debouncing cache updates to the projectconfig cache
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE = (
    "sentry.relay.projectconfig_debounce_cache.base.ProjectConfigDebounceCache"
)
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS = {}

# Rate limiting backend
SENTRY_RATELIMITER = "sentry.ratelimits.base.RateLimiter"
SENTRY_RATELIMITER_OPTIONS = {}

# The default value for project-level quotas
SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE = "90%"

# Snuba configuration
SENTRY_SNUBA = os.environ.get("SNUBA", "http://127.0.0.1:1218")
SENTRY_SNUBA_TIMEOUT = 30
SENTRY_SNUBA_CACHE_TTL_SECONDS = 60

# Node storage backend
SENTRY_NODESTORE = "sentry.nodestore.django.DjangoNodeStorage"
SENTRY_NODESTORE_OPTIONS = {}

# Tag storage backend
SENTRY_TAGSTORE = os.environ.get("SENTRY_TAGSTORE", "sentry.tagstore.snuba.SnubaTagStorage")
SENTRY_TAGSTORE_OPTIONS = {}

# Search backend
SENTRY_SEARCH = os.environ.get(
    "SENTRY_SEARCH", "sentry.search.snuba.EventsDatasetSnubaSearchBackend"
)
SENTRY_SEARCH_OPTIONS = {}
# SENTRY_SEARCH_OPTIONS = {
#     'urls': ['http://127.0.0.1:9200/'],
#     'timeout': 5,
# }

# Time-series storage backend
SENTRY_TSDB = "sentry.tsdb.dummy.DummyTSDB"
SENTRY_TSDB_OPTIONS = {}

SENTRY_NEWSLETTER = "sentry.newsletter.base.Newsletter"
SENTRY_NEWSLETTER_OPTIONS = {}

SENTRY_EVENTSTREAM = "sentry.eventstream.snuba.SnubaEventStream"
SENTRY_EVENTSTREAM_OPTIONS = {}

# rollups must be ordered from highest granularity to lowest
SENTRY_TSDB_ROLLUPS = (
    # (time in seconds, samples to keep)
    (10, 360),  # 60 minutes at 10 seconds
    (3600, 24 * 7),  # 7 days at 1 hour
    (3600 * 24, 90),  # 90 days at 1 day
)

# Internal metrics
SENTRY_METRICS_BACKEND = "sentry.metrics.dummy.DummyMetricsBackend"
SENTRY_METRICS_OPTIONS = {}
SENTRY_METRICS_SAMPLE_RATE = 1.0
SENTRY_METRICS_PREFIX = "sentry."
SENTRY_METRICS_SKIP_INTERNAL_PREFIXES = []  # Order this by most frequent prefixes.

# Metrics product
SENTRY_METRICS_INDEXER = "sentry.sentry_metrics.indexer.mock.MockIndexer"
SENTRY_METRICS_INDEXER_OPTIONS = {}

# Render charts on the backend. This uses the Chartcuterie external service.
SENTRY_CHART_RENDERER = "sentry.charts.chartcuterie.Chartcuterie"
SENTRY_CHART_RENDERER_OPTIONS = {}

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT = None
SENTRY_PUBLIC_ENDPOINT = None

# Hostname prefix to add for organizations that are opted into the
# `organizations:org-subdomains` feature.
SENTRY_ORG_SUBDOMAIN_TEMPLATE = "o{organization_id}.ingest"

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

# Gravatar service base url
SENTRY_GRAVATAR_BASE_URL = "https://secure.gravatar.com"

# Timeout (in seconds) for fetching remote source files (e.g. JS)
SENTRY_SOURCE_FETCH_TIMEOUT = 5

# Timeout (in seconds) for socket operations when fetching remote source files
SENTRY_SOURCE_FETCH_SOCKET_TIMEOUT = 2

# Maximum content length for source files before we abort fetching
SENTRY_SOURCE_FETCH_MAX_SIZE = 40 * 1024 * 1024

# Maximum content length for cache value.  Currently used only to avoid
# pointless compression of sourcemaps and other release files because we
# silently fail to cache the compressed result anyway.  Defaults to None which
# disables the check and allows different backends for unlimited payload.
# e.g. memcached defaults to 1MB  = 1024 * 1024
SENTRY_CACHE_MAX_VALUE_SIZE = None

# Fields which managed users cannot change via Sentry UI. Username and password
# cannot be changed by managed users. Optionally include 'email' and
# 'name' in SENTRY_MANAGED_USER_FIELDS.
SENTRY_MANAGED_USER_FIELDS = ()

SENTRY_SCOPES = {
    "org:read",
    "org:write",
    "org:admin",
    "org:integrations",
    "member:read",
    "member:write",
    "member:admin",
    "team:read",
    "team:write",
    "team:admin",
    "project:read",
    "project:write",
    "project:admin",
    "project:releases",
    "event:read",
    "event:write",
    "event:admin",
    "alerts:write",
    "alerts:read",
}

SENTRY_SCOPE_SETS = (
    (
        ("org:admin", "Read, write, and admin access to organization details."),
        ("org:write", "Read and write access to organization details."),
        ("org:read", "Read access to organization details."),
    ),
    (("org:integrations", "Read, write, and admin access to organization integrations."),),
    (
        ("member:admin", "Read, write, and admin access to organization members."),
        ("member:write", "Read and write access to organization members."),
        ("member:read", "Read access to organization members."),
    ),
    (
        ("team:admin", "Read, write, and admin access to teams."),
        ("team:write", "Read and write access to teams."),
        ("team:read", "Read access to teams."),
    ),
    (
        ("project:admin", "Read, write, and admin access to projects."),
        ("project:write", "Read and write access to projects."),
        ("project:read", "Read access to projects."),
    ),
    (("project:releases", "Read, write, and admin access to project releases."),),
    (
        ("event:admin", "Read, write, and admin access to events."),
        ("event:write", "Read and write access to events."),
        ("event:read", "Read access to events."),
    ),
    (
        ("alerts:write", "Read and write alerts"),
        ("alerts:read", "Read alerts"),
    ),
)

SENTRY_DEFAULT_ROLE = "member"

# Roles are ordered, which represents a sort-of hierarchy, as well as how
# they're presented in the UI. This is primarily important in that a member
# that is earlier in the chain cannot manage the settings of a member later
# in the chain (they still require the appropriate scope).
SENTRY_ROLES = (
    {
        "id": "member",
        "name": "Member",
        "desc": "Members can view and act on events, as well as view most other data within the organization.",
        "scopes": {
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
            "alerts:read",
            "alerts:write",
        },
    },
    {
        "id": "admin",
        "name": "Admin",
        "desc": "Admin privileges on any teams of which they're a member. They can create new teams and projects, "
        "as well as remove teams and projects on which they already hold membership (or all teams, if open membership is enabled). "
        "Additionally, they can manage memberships of teams that they are members of. They cannot invite members to the organization.",
        "scopes": {
            "event:read",
            "event:write",
            "event:admin",
            "org:read",
            "member:read",
            "project:read",
            "project:write",
            "project:admin",
            "project:releases",
            "team:read",
            "team:write",
            "team:admin",
            "org:integrations",
            "alerts:read",
            "alerts:write",
        },
    },
    {
        "id": "manager",
        "name": "Manager",
        "desc": "Gains admin access on all teams as well as the ability to add and remove members.",
        "is_global": True,
        "scopes": {
            "event:read",
            "event:write",
            "event:admin",
            "member:read",
            "member:write",
            "member:admin",
            "project:read",
            "project:write",
            "project:admin",
            "project:releases",
            "team:read",
            "team:write",
            "team:admin",
            "org:read",
            "org:write",
            "org:integrations",
            "alerts:read",
            "alerts:write",
        },
    },
    {
        "id": "owner",
        "name": "Owner",
        "desc": "Unrestricted access to the organization, its data, and its settings. Can add, modify, and delete "
        "projects and members, as well as make billing and plan changes.",
        "is_global": True,
        "scopes": {
            "org:read",
            "org:write",
            "org:admin",
            "org:integrations",
            "member:read",
            "member:write",
            "member:admin",
            "team:read",
            "team:write",
            "team:admin",
            "project:read",
            "project:write",
            "project:admin",
            "project:releases",
            "event:read",
            "event:write",
            "event:admin",
            "alerts:read",
            "alerts:write",
        },
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
#
# Simulates a small amount of lag which helps uncover more obvious race
# conditions in UI interactions. It's also needed to test (or implement) any
# kind of loading scenarios. Without this we will just implicitly lower the
# overall quality of software we ship because we will not experience it in the
# same way we would in production.
#
# See discussion on https://github.com/getsentry/sentry/pull/20187
SENTRY_API_RESPONSE_DELAY = 150 if IS_DEV else None

# Watchers for various application purposes (such as compiling static media)
# XXX(dcramer): this doesn't work outside of a source distribution as the
# webpack.config.js is not part of Sentry's datafiles
SENTRY_WATCHERS = (
    (
        "webpack",
        [
            os.path.join(NODE_MODULES_ROOT, ".bin", "webpack"),
            "serve",
            "--color",
            "--output-pathinfo=true",
            "--config={}".format(
                os.path.normpath(
                    os.path.join(PROJECT_ROOT, os.pardir, os.pardir, "webpack.config.ts")
                )
            ),
        ],
    ),
)

# Controls whether DEVSERVICES will spin up a Relay and direct store traffic through Relay or not.
# If Relay is used a reverse proxy server will be run at the 8000 (the port formally used by Sentry) that
# will split the requests between Relay and Sentry (all store requests will be passed to Relay, and the
# rest will be forwarded to Sentry)
SENTRY_USE_RELAY = True
SENTRY_RELAY_PORT = 7899

# Controls whether we'll run the snuba subscription processor. If enabled, we'll run
# it as a worker, and devservices will run Kafka.
SENTRY_DEV_PROCESS_SUBSCRIPTIONS = False

# The chunk size for attachments in blob store. Should be a power of two.
SENTRY_ATTACHMENT_BLOB_SIZE = 8 * 1024 * 1024  # 8MB

# The chunk size for files in the chunk upload. This is used for native debug
# files and source maps, and directly translates to the chunk size in blob
# store. MUST be a power of two.
SENTRY_CHUNK_UPLOAD_BLOB_SIZE = 8 * 1024 * 1024  # 8MB

# This flags activates the Change Data Capture backend in the development environment
SENTRY_USE_CDC_DEV = False

# SENTRY_DEVSERVICES = {
#     "service-name": lambda settings, options: (
#         {
#             "image": "image-name:version",
#             # optional ports to expose
#             "ports": {"internal-port/tcp": external-port},
#             # optional command
#             "command": ["exit 1"],
#             optional mapping of volumes
#             "volumes": {"volume-name": {"bind": "/path/in/container"}},
#             # optional statement to test if service should run
#             "only_if": lambda settings, options: True,
#             # optional environment variables
#             "environment": {
#                 "ENV_VAR": "1",
#             }
#         }
#     )
# }


def build_cdc_postgres_init_db_volume(settings):
    return (
        {
            os.path.join(settings.CDC_CONFIG_DIR, "init_hba.sh"): {
                "bind": "/docker-entrypoint-initdb.d/init_hba.sh"
            }
        }
        if settings.SENTRY_USE_CDC_DEV
        else {}
    )


SENTRY_DEVSERVICES = {
    "redis": lambda settings, options: (
        {
            "image": "redis:5.0-alpine",
            "ports": {"6379/tcp": 6379},
            "command": [
                "redis-server",
                "--appendonly",
                "yes",
                "--save",
                "60",
                "20",
                "--auto-aof-rewrite-percentage",
                "100",
                "--auto-aof-rewrite-min-size",
                "64mb",
            ],
            "volumes": {"redis": {"bind": "/data"}},
        }
    ),
    "postgres": lambda settings, options: (
        {
            "image": "postgres:9.6-alpine",
            "pull": True,
            "ports": {"5432/tcp": 5432},
            "environment": {"POSTGRES_DB": "sentry", "POSTGRES_HOST_AUTH_METHOD": "trust"},
            "volumes": {
                "postgres": {"bind": "/var/lib/postgresql/data"},
                "wal2json": {"bind": "/wal2json"},
                settings.CDC_CONFIG_DIR: {"bind": "/cdc"},
                **build_cdc_postgres_init_db_volume(settings),
            },
            "command": [
                "postgres",
                "-c",
                "wal_level=logical",
                "-c",
                "max_replication_slots=1",
                "-c",
                "max_wal_senders=1",
            ],
            "entrypoint": "/cdc/postgres-entrypoint.sh" if settings.SENTRY_USE_CDC_DEV else None,
            "healthcheck": {
                "test": ["CMD", "pg_isready", "-U", "postgres"],
                "interval": 30000000000,  # Test every 30 seconds (in ns).
                "timeout": 5000000000,  # Time we should expect the test to take.
                "retries": 3,
            },
        }
    ),
    "zookeeper": lambda settings, options: (
        {
            # Upgrading to version 6.x allows zookeeper to run properly on Apple's arm64
            # See details https://github.com/confluentinc/kafka-images/issues/80#issuecomment-855511438
            "image": "confluentinc/cp-zookeeper:6.2.0",
            "environment": {"ZOOKEEPER_CLIENT_PORT": "2181"},
            "volumes": {"zookeeper": {"bind": "/var/lib/zookeeper"}},
            "only_if": "kafka" in settings.SENTRY_EVENTSTREAM or settings.SENTRY_USE_RELAY,
        }
    ),
    "kafka": lambda settings, options: (
        {
            # We upgrade to version 6.x to match zookeeper's version (I believe they both release together)
            "image": "confluentinc/cp-kafka:6.2.0",
            "ports": {"9092/tcp": 9092},
            "environment": {
                "KAFKA_ZOOKEEPER_CONNECT": "{containers[zookeeper][name]}:2181",
                "KAFKA_LISTENERS": "INTERNAL://0.0.0.0:9093,EXTERNAL://0.0.0.0:9092",
                "KAFKA_ADVERTISED_LISTENERS": "INTERNAL://{containers[kafka][name]}:9093,EXTERNAL://{containers[kafka]"
                "[ports][9092/tcp][0]}:{containers[kafka][ports][9092/tcp][1]}",
                "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP": "INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT",
                "KAFKA_INTER_BROKER_LISTENER_NAME": "INTERNAL",
                "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR": "1",
                "KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS": "1",
                "KAFKA_LOG_RETENTION_HOURS": "24",
                "KAFKA_MESSAGE_MAX_BYTES": "50000000",
                "KAFKA_MAX_REQUEST_SIZE": "50000000",
            },
            "volumes": {"kafka": {"bind": "/var/lib/kafka"}},
            "only_if": "kafka" in settings.SENTRY_EVENTSTREAM
            or settings.SENTRY_USE_RELAY
            or settings.SENTRY_DEV_PROCESS_SUBSCRIPTIONS,
        }
    ),
    "clickhouse": lambda settings, options: (
        {
            "image": "yandex/clickhouse-server:20.3.9.70",
            "pull": True,
            "ports": {"9000/tcp": 9000, "9009/tcp": 9009, "8123/tcp": 8123},
            "ulimits": [{"name": "nofile", "soft": 262144, "hard": 262144}],
            "environment": {"MAX_MEMORY_USAGE_RATIO": "0.3"},
            "volumes": {
                "clickhouse_dist"
                if settings.SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES
                else "clickhouse": {"bind": "/var/lib/clickhouse"},
                os.path.join(
                    settings.DEVSERVICES_CONFIG_DIR,
                    "clickhouse",
                    "dist_config.xml"
                    if settings.SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES
                    else "loc_config.xml",
                ): {"bind": "/etc/clickhouse-server/config.d/sentry.xml"},
            },
        }
    ),
    "snuba": lambda settings, options: (
        {
            "image": "getsentry/snuba:nightly",
            "pull": True,
            "ports": {"1218/tcp": 1218},
            "command": ["devserver"],
            "environment": {
                "PYTHONUNBUFFERED": "1",
                "SNUBA_SETTINGS": "docker",
                "DEBUG": "1",
                "CLICKHOUSE_HOST": "{containers[clickhouse][name]}",
                "CLICKHOUSE_PORT": "9000",
                "CLICKHOUSE_HTTP_PORT": "8123",
                "DEFAULT_BROKERS": "{containers[kafka][name]}:9093",
                "REDIS_HOST": "{containers[redis][name]}",
                "REDIS_PORT": "6379",
                "REDIS_DB": "1",
            },
            "only_if": "snuba" in settings.SENTRY_EVENTSTREAM
            or "kafka" in settings.SENTRY_EVENTSTREAM,
        }
    ),
    "bigtable": lambda settings, options: (
        {
            "image": "mattrobenolt/cbtemulator:0.51.0",
            "ports": {"8086/tcp": 8086},
            "only_if": "bigtable" in settings.SENTRY_NODESTORE,
        }
    ),
    "memcached": lambda settings, options: (
        {
            "image": "memcached:1.5-alpine",
            "ports": {"11211/tcp": 11211},
            "only_if": "memcached" in settings.CACHES.get("default", {}).get("BACKEND"),
        }
    ),
    "symbolicator": lambda settings, options: (
        {
            "image": "us.gcr.io/sentryio/symbolicator:nightly",
            "pull": True,
            "ports": {"3021/tcp": 3021},
            "volumes": {settings.SYMBOLICATOR_CONFIG_DIR: {"bind": "/etc/symbolicator"}},
            "command": ["run", "--config", "/etc/symbolicator/config.yml"],
            "only_if": options.get("symbolicator.enabled"),
        }
    ),
    "relay": lambda settings, options: (
        {
            "image": "us.gcr.io/sentryio/relay:nightly",
            "pull": True,
            "ports": {"7899/tcp": settings.SENTRY_RELAY_PORT},
            "volumes": {settings.RELAY_CONFIG_DIR: {"bind": "/etc/relay"}},
            "command": ["run", "--config", "/etc/relay"],
            "only_if": settings.SENTRY_USE_RELAY,
            "with_devserver": True,
        }
    ),
    "chartcuterie": lambda settings, options: (
        {
            "image": "us.gcr.io/sentryio/chartcuterie:nightly",
            "pull": True,
            "volumes": {settings.CHARTCUTERIE_CONFIG_DIR: {"bind": "/etc/chartcuterie"}},
            "environment": {
                "CHARTCUTERIE_CONFIG": "/etc/chartcuterie/config.js",
                "CHARTCUTERIE_CONFIG_POLLING": "true",
            },
            "ports": {"9090/tcp": 7901},
            "only_if": options.get("chart-rendering.enabled"),
        }
    ),
    "cdc": lambda settings, options: (
        {
            "image": "getsentry/cdc:nightly",
            "pull": True,
            "only_if": settings.SENTRY_USE_CDC_DEV,
            "command": ["cdc", "-c", "/etc/cdc/configuration.yaml", "producer"],
            "volumes": {settings.CDC_CONFIG_DIR: {"bind": "/etc/cdc"}},
        }
    ),
}

# Max file size for avatar photo uploads
SENTRY_MAX_AVATAR_SIZE = 5000000

# The maximum age of raw events before they are deleted
SENTRY_RAW_EVENT_MAX_AGE_DAYS = 10

# statuspage.io support
STATUS_PAGE_ID = None
STATUS_PAGE_API_HOST = "statuspage.io"

SENTRY_ONPREMISE = True

# Whether we should look at X-Forwarded-For header or not
# when checking REMOTE_ADDR ip addresses
SENTRY_USE_X_FORWARDED_FOR = True

SENTRY_DEFAULT_INTEGRATIONS = (
    "sentry.integrations.bitbucket.BitbucketIntegrationProvider",
    "sentry.integrations.bitbucket_server.BitbucketServerIntegrationProvider",
    "sentry.integrations.slack.SlackIntegrationProvider",
    "sentry.integrations.github.GitHubIntegrationProvider",
    "sentry.integrations.github_enterprise.GitHubEnterpriseIntegrationProvider",
    "sentry.integrations.gitlab.GitlabIntegrationProvider",
    "sentry.integrations.jira.JiraIntegrationProvider",
    "sentry.integrations.jira_server.JiraServerIntegrationProvider",
    "sentry.integrations.vsts.VstsIntegrationProvider",
    "sentry.integrations.vsts_extension.VstsExtensionIntegrationProvider",
    "sentry.integrations.pagerduty.integration.PagerDutyIntegrationProvider",
    "sentry.integrations.vercel.VercelIntegrationProvider",
    "sentry.integrations.msteams.MsTeamsIntegrationProvider",
    "sentry.integrations.aws_lambda.AwsLambdaIntegrationProvider",
    "sentry.integrations.custom_scm.CustomSCMIntegrationProvider",
)


SENTRY_SDK_CONFIG = {
    "release": sentry.__build__,
    "environment": ENVIRONMENT,
    "in_app_include": ["sentry", "sentry_plugins"],
    "debug": True,
    "send_default_pii": True,
    "auto_enabling_integrations": False,
}

# Callable to bind additional context for the Sentry SDK
#
# def get_org_context(scope, organization, **kwargs):
#    scope.set_tag('organization.cool', '1')
#
# SENTRY_ORGANIZATION_CONTEXT_HELPER = get_org_context
SENTRY_ORGANIZATION_CONTEXT_HELPER = None

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
EMAIL_USE_SSL = DEAD
SERVER_EMAIL = DEAD
EMAIL_SUBJECT_PREFIX = DEAD

# Shared btw Auth Provider and Social Auth Plugin
GITHUB_APP_ID = DEAD
GITHUB_API_SECRET = DEAD

# Used by Auth Provider
GITHUB_REQUIRE_VERIFIED_EMAIL = DEAD
GITHUB_API_DOMAIN = DEAD
GITHUB_BASE_DOMAIN = DEAD

# Used by Social Auth Plugin
GITHUB_EXTENDED_PERMISSIONS = DEAD
GITHUB_ORGANIZATION = DEAD


SUDO_URL = "sentry-sudo"

# Endpoint to https://github.com/getsentry/sentry-release-registry, used for
# alerting the user on outdated SDKs.
SENTRY_RELEASE_REGISTRY_BASEURL = None

# Hardcoded SDK versions for SDKs that do not have an entry in the release
# registry.
SDK_VERSIONS = {
    "raven-js": "3.21.0",
    "raven-node": "2.3.0",
    "raven-python": "6.10.0",
    "raven-ruby": "2.7.1",
    "sentry-cocoa": "3.11.1",
    "sentry-java": "1.6.4",
    "sentry-laravel": "1.0.2",
    "sentry-php": "2.0.1",
}

# Some of the migration links below are not ideal, but that is all migration documentation we currently have and can provide at this point
SDK_URLS = {
    "sentry-java": "https://docs.sentry.io/platforms/java/legacy/migration/",
    "@sentry/browser": "https://github.com/getsentry/sentry-javascript/blob/master/MIGRATION.md#migrating-from-raven-js-to-sentrybrowser",
    "sentry-cocoa": "https://docs.sentry.io/platforms/apple/migration/",
    "sentry-php": "https://docs.sentry.io/platforms/php/",
    "sentry-python": "https://docs.sentry.io/platforms/python/migration/",
    "sentry-ruby": "https://docs.sentry.io/platforms/ruby/migration/",
    "sentry-dotnet": "https://docs.sentry.io/platforms/dotnet/migration/#migrating-from-sharpraven-to-sentry-sdk",
    "sentry-go": "https://docs.sentry.io/platforms/go/migration/",
}

DEPRECATED_SDKS = {
    # sdk name => new sdk name
    "raven-java": "sentry-java",
    "raven-java:android": "sentry-java",
    "raven-java:log4j": "sentry-java",
    "raven-java:log4j2": "sentry-java",
    "raven-java:logback": "sentry-java",
    "raven-js": "@sentry/browser",
    "raven-node": "@sentry/browser",
    "raven-objc": "sentry-cocoa",
    "raven-php": "sentry-php",
    "raven-python": "sentry-python",
    "raven-ruby": "sentry-ruby",
    "raven-swift": "sentry-cocoa",
    "raven-csharp": "sentry-dotnet",
    "raven-go": "sentry-go",
    "sentry-android": "sentry-java",
    "sentry-swift": "sentry-cocoa",
    "SharpRaven": "sentry-dotnet",
    # The Ruby SDK used to go by the name 'sentry-raven'...
    "sentry-raven": "sentry-ruby",
}

TERMS_URL = None
PRIVACY_URL = None

# Internal sources for debug information files
#
# There are two special values in there: "microsoft" and "ios".  These are
# added by default to any project created.  The "ios" source is currently
# not enabled in the open source build of sentry because it points to a
# sentry internal repository and it's unclear if these can be
# redistributed under the Apple EULA.  If however someone configures their
# own iOS source and name it 'ios' it will be enabled by default for all
# projects.
SENTRY_BUILTIN_SOURCES = {
    "microsoft": {
        "type": "http",
        "id": "sentry:microsoft",
        "name": "Microsoft",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "https://msdl.microsoft.com/download/symbols/",
        "is_public": True,
    },
    "citrix": {
        "type": "http",
        "id": "sentry:citrix",
        "name": "Citrix",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "http://ctxsym.citrix.com/symbols/",
        "is_public": True,
    },
    "intel": {
        "type": "http",
        "id": "sentry:intel",
        "name": "Intel",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "https://software.intel.com/sites/downloads/symbols/",
        "is_public": True,
    },
    "amd": {
        "type": "http",
        "id": "sentry:amd",
        "name": "AMD",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "https://download.amd.com/dir/bin/",
        "is_public": True,
    },
    "nvidia": {
        "type": "http",
        "id": "sentry:nvidia",
        "name": "NVIDIA",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "https://driver-symbols.nvidia.com/",
        "is_public": True,
    },
    "chromium": {
        "type": "http",
        "id": "sentry:chromium",
        "name": "Chromium",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "https://chromium-browser-symsrv.commondatastorage.googleapis.com/",
        "is_public": True,
    },
    "unity": {
        "type": "http",
        "id": "sentry:unity",
        "name": "Unity",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pdb", "pe"]},
        "url": "http://symbolserver.unity3d.com/",
        "is_public": True,
    },
    "mozilla": {
        "type": "http",
        "id": "sentry:mozilla",
        "name": "Mozilla",
        "layout": {"type": "symstore"},
        "url": "https://symbols.mozilla.org/",
        "is_public": True,
    },
    "autodesk": {
        "type": "http",
        "id": "sentry:autodesk",
        "name": "Autodesk",
        "layout": {"type": "symstore"},
        "url": "http://symbols.autodesk.com/",
        "is_public": True,
    },
    "electron": {
        "type": "http",
        "id": "sentry:electron",
        "name": "Electron",
        "layout": {"type": "native"},
        "url": "https://symbols.electronjs.org/",
        "filters": {"filetypes": ["pdb", "breakpad", "sourcebundle"]},
        "is_public": True,
    },
}

# Relay
# List of PKs explicitly allowed by Sentry.  All relays here are always
# registered as internal relays.
# DEPRECATED !!! (18.May.2021) This entry has been deprecated in favour of
# ~/.sentry/conf.yml (relay.static_auth)
SENTRY_RELAY_WHITELIST_PK = [
    # NOTE (RaduW) This is the relay key for the relay instance used by devservices.
    # This should NOT be part of any production environment.
    # This key should match the key in /sentry/config/relay/credentials.json
    "SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"
]

# When open registration is not permitted then only relays in the
# list of explicitly allowed relays can register.
SENTRY_RELAY_OPEN_REGISTRATION = True

# GeoIP
# Used for looking up IP addresses.
# For example /usr/local/share/GeoIP/GeoIPCity.mmdb
GEOIP_PATH_MMDB = None

# CDN
# If this is an absolute url like e.g.: https://js.sentry-cdn.com/
# the full url will look like this: https://js.sentry-cdn.com/<public_key>.min.js
# otherwise django reverse url lookup will be used.
JS_SDK_LOADER_CDN_URL = ""
# Version of the SDK - Used in header Surrogate-Key sdk/JS_SDK_LOADER_SDK_VERSION
JS_SDK_LOADER_SDK_VERSION = ""
# This should be the url pointing to the JS SDK
JS_SDK_LOADER_DEFAULT_SDK_URL = ""

# block domains which are generally used by spammers -- keep this configurable in case an onpremise
# install wants to allow it
INVALID_EMAIL_ADDRESS_PATTERN = re.compile(r"\@qq\.com$", re.I)

# This is customizable for sentry.io, but generally should only be additive
# (currently the values not used anymore so this is more for documentation purposes)
SENTRY_USER_PERMISSIONS = ("broadcasts.admin",)

KAFKA_CLUSTERS = {
    "default": {
        "common": {"bootstrap.servers": "127.0.0.1:9092"},
        "producers": {
            "compression.type": "lz4",
            "message.max.bytes": 50000000,  # 50MB, default is 1MB
        },
        "consumers": {},
    }
}

KAFKA_EVENTS = "events"
KAFKA_OUTCOMES = "outcomes"
KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS = "events-subscription-results"
KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS = "transactions-subscription-results"
KAFKA_SUBSCRIPTION_RESULT_TOPICS = {
    "events": KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS,
    "transactions": KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
}
KAFKA_INGEST_EVENTS = "ingest-events"
KAFKA_INGEST_ATTACHMENTS = "ingest-attachments"
KAFKA_INGEST_TRANSACTIONS = "ingest-transactions"

KAFKA_TOPICS = {
    KAFKA_EVENTS: {"cluster": "default", "topic": KAFKA_EVENTS},
    KAFKA_OUTCOMES: {"cluster": "default", "topic": KAFKA_OUTCOMES},
    KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS: {
        "cluster": "default",
        "topic": KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS,
    },
    KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS: {
        "cluster": "default",
        "topic": KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
    },
    # Topic for receiving simple events (error events without attachments) from Relay
    KAFKA_INGEST_EVENTS: {"cluster": "default", "topic": KAFKA_INGEST_EVENTS},
    # Topic for receiving 'complex' events (error events with attachments) from Relay
    KAFKA_INGEST_ATTACHMENTS: {"cluster": "default", "topic": KAFKA_INGEST_ATTACHMENTS},
    # Topic for receiving transaction events (APM events) from Relay
    KAFKA_INGEST_TRANSACTIONS: {"cluster": "default", "topic": KAFKA_INGEST_TRANSACTIONS},
}

# If True, consumers will create the topics if they don't exist
KAFKA_CONSUMER_AUTO_CREATE_TOPICS = True

# For Jira, only approved apps can use the access_email_addresses scope
# This scope allows Sentry to use the email endpoint (https://developer.atlassian.com/cloud/jira/platform/rest/v3/#api-rest-api-3-user-email-get)
# We use the email with Jira 2-way sync in order to match the user
JIRA_USE_EMAIL_SCOPE = False

"""
Fields are:
 - south_app_name: Which app to apply the conversion to
 - south_migration: The south migration to map to the new name. If None, then always
   apply
 - django_app_name: The new app name to apply the conversion to
 - django_migration: Which django migration to 'fake' as run.
 - south_migration_required: Whether the south migration is required to proceed.
 - south_migration_required_error: Error message explaining what is going wrong.
"""
SOUTH_MIGRATION_CONVERSIONS = (
    (
        "sentry",
        "0472_auto__add_field_sentryapp_author",
        "sentry",
        "0001_initial",
        True,
        "Please upgrade to Sentry 9.1.2 before upgrading to any later versions.",
    ),
    (
        "sentry",
        "0516_auto__del_grouptagvalue__del_unique_grouptagvalue_group_id_key_value__",
        "sentry",
        "0002_912_to_recent",
        False,
        "",
    ),
    (
        "sentry",
        "0518_auto__chg_field_sentryappwebhookerror_response_code",
        "sentry",
        "0003_auto_20191022_0122",
        False,
        "",
    ),
    ("sentry.nodestore", "0001_initial", "nodestore", "0001_initial", False, None),
    ("nodestore", "0001_initial", "nodestore", "0001_initial", False, None),
    (
        "social_auth",
        "0004_auto__del_unique_usersocialauth_provider_uid__add_unique_usersocialaut",
        "social_auth",
        "0001_initial",
        True,
        "Please upgrade to Sentry 9.1.2 before upgrading to any later versions.",
    ),
)

# Whether to use Django migrations to create the database, or just build it based off
# of models, similar to how syncdb used to work. The former is more correct, the latter
# is much faster.
MIGRATIONS_TEST_MIGRATE = os.environ.get("MIGRATIONS_TEST_MIGRATE", "0") == "1"
# Specifies the list of django apps to include in the lockfile. If Falsey then include
# all apps with migrations
MIGRATIONS_LOCKFILE_APP_WHITELIST = (
    "nodestore",
    "sentry",
    "social_auth",
)
# Where to write the lockfile to.
MIGRATIONS_LOCKFILE_PATH = os.path.join(PROJECT_ROOT, os.path.pardir, os.path.pardir)

# Log error and abort processing (without dropping event) when process_event is
# taking more than n seconds to process event
SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT = 600

# Log warning when process_event is taking more than n seconds to process event
SYMBOLICATOR_PROCESS_EVENT_WARN_TIMEOUT = 120

# Block symbolicate_event for this many seconds to wait for a initial response
# from symbolicator after the task submission.
SYMBOLICATOR_POLL_TIMEOUT = 10

# When retrying symbolication requests or querying for the result this set the
# max number of second to wait between subsequent attempts.
SYMBOLICATOR_MAX_RETRY_AFTER = 5

SENTRY_REQUEST_METRIC_ALLOWED_PATHS = (
    "sentry.web.api",
    "sentry.web.frontend",
    "sentry.api.endpoints",
    "sentry.data_export.endpoints",
    "sentry.discover.endpoints",
    "sentry.incidents.endpoints",
)
SENTRY_MAIL_ADAPTER_BACKEND = "sentry.mail.adapter.MailAdapter"

# Project ID used by synthetic monitoring
# Synthetic monitoring recurringly send events, prepared with specific
# attributes, which can be identified through the whole processing pipeline and
# observed mainly for producing stable metrics.
SENTRY_SYNTHETIC_MONITORING_PROJECT_ID = None

# Similarity cluster to use
# Similarity-v1: uses hardcoded set of event properties for diffing
SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER = "default"
# Similarity-v2: uses grouping components for diffing (None = fallback to setting for v1)
SENTRY_SIMILARITY2_INDEX_REDIS_CLUSTER = None

# The grouping strategy to use for driving similarity-v2. You can add multiple
# strategies here to index them all. This is useful for transitioning a
# similarity dataset to newer grouping configurations.
#
# The dictionary value represents the redis prefix to use.
#
# Check out `test_similarity_config_migration` to understand the procedure and risks.
SENTRY_SIMILARITY_GROUPING_CONFIGURATIONS_TO_INDEX = {
    "similarity:2020-07-23": "a",
}

SENTRY_USE_UWSGI = True

SENTRY_REPROCESSING_ATTACHMENT_CHUNK_SIZE = 2 ** 20

SENTRY_REPROCESSING_SYNC_REDIS_CLUSTER = "default"

# Timeout for the project counter statement execution.
# In case of contention on the project counter, prevent workers saturation with
# save_event tasks from single project.
# Value is in milliseconds. Set to `None` to disable.
SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT = 1000

# Implemented in getsentry to run additional devserver workers.
SENTRY_EXTRA_WORKERS = None

SAMPLED_DEFAULT_RATE = 1.0

# A set of extra URLs to sample
ADDITIONAL_SAMPLED_URLS = {}

# This controls whether Sentry is run in a demo mode.
# Enabling this will allow users to create accounts without an email or password.
DEMO_MODE = False

# all demo orgs are owned by the user with this email
DEMO_ORG_OWNER_EMAIL = None

# paramters that determine how demo events are generated
DEMO_DATA_GEN_PARAMS = {}

# parameters for an org when quickly generating them synchronously
DEMO_DATA_QUICK_GEN_PARAMS = {}

# adds an extra JS to HTML template
INJECTED_SCRIPT_ASSETS = []
