"""
These settings act as the default (base) settings for the Sentry-provided web-server
"""
import os
import os.path
import platform
import re
import socket
import sys
import tempfile
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Iterable, Mapping, Optional, Tuple, Union, overload
from urllib.parse import urlparse

import sentry
from sentry.types.region import Region
from sentry.utils.celery import crontab_with_minute_jitter
from sentry.utils.types import type_from_value


def gettext_noop(s):
    return s


socket.setdefaulttimeout(5)


@overload
def env(key: str, default: int, type: Optional[Callable[[Any], int]] = None) -> int:
    ...


@overload
def env(key: str, default: float, type: Optional[Callable[[Any], float]] = None) -> float:
    ...


@overload
def env(key: str, default: bool, type: Optional[Callable[[Any], bool]] = None) -> bool:
    ...


@overload
def env(key: str, default: str, type: Optional[Callable[[Any], str]] = None) -> str:
    ...


def env(
    key: str,
    default: Union[str, int, float, bool, None] = "",
    type: Optional[Callable[[Any], Any]] = None,
) -> Any:
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

CONF_DIR = os.path.abspath(os.path.dirname(__file__))

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
    # Uncomment to enable Content Security Policy on this Sentry installation (experimental)
    # "csp.middleware.CSPMiddleware",
    "sentry.middleware.health.HealthCheck",
    "sentry.middleware.security.SecurityHeadersMiddleware",
    "sentry.middleware.env.SentryEnvMiddleware",
    "sentry.middleware.proxy.SetRemoteAddrFromForwardedFor",
    "sentry.middleware.stats.RequestTimingMiddleware",
    "sentry.middleware.access_log.access_log_middleware",
    "sentry.middleware.stats.ResponseCodeMiddleware",
    "sentry.middleware.subdomain.SubdomainMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "sentry.middleware.auth.AuthenticationMiddleware",
    "sentry.middleware.integrations.IntegrationControlMiddleware",
    "sentry.middleware.customer_domain.CustomerDomainMiddleware",
    "sentry.middleware.user.UserActiveMiddleware",
    "sentry.middleware.sudo.SudoMiddleware",
    "sentry.middleware.superuser.SuperuserMiddleware",
    "sentry.middleware.locale.SentryLocaleMiddleware",
    "sentry.middleware.ratelimit.RatelimitMiddleware",
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
    "drf_spectacular",
    "crispy_forms",
    "rest_framework",
    "sentry",
    "sentry.analytics",
    "sentry.incidents.apps.Config",
    "sentry.discover",
    "sentry.analytics.events",
    "sentry.nodestore",
    "sentry.monitors",
    "sentry.replays",
    "sentry.release_health",
    "sentry.search",
    "sentry.sentry_metrics.indexer.postgres.apps.Config",
    "sentry.snuba",
    "sentry.lang.java.apps.Config",
    "sentry.lang.javascript.apps.Config",
    "sentry.plugins.sentry_interface_types.apps.Config",
    "sentry.plugins.sentry_urls.apps.Config",
    "sentry.plugins.sentry_useragents.apps.Config",
    "sentry.plugins.sentry_webhooks.apps.Config",
    "sentry.utils.suspect_resolutions.apps.Config",
    "sentry.utils.suspect_resolutions_releases.apps.Config",
    "social_auth",
    "sudo",
    "sentry.eventstream",
    "sentry.auth.providers.google.apps.Config",
    "django.contrib.staticfiles",
    "sentry.issues.apps.Config",
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

CSP_INCLUDE_NONCE_IN = [
    "script-src",
]

CSP_DEFAULT_SRC = [
    "'none'",
]
CSP_SCRIPT_SRC = [
    "'self'",
    "'unsafe-inline'",
    "'report-sample'",
]
CSP_FONT_SRC = [
    "'self'",
    "data:",
]
CSP_CONNECT_SRC = [
    "'self'",
]
CSP_FRAME_ANCESTORS = [
    "'none'",
]
CSP_OBJECT_SRC = [
    "'none'",
]
CSP_BASE_URI = [
    "'none'",
]
CSP_STYLE_SRC = [
    "'self'",
    "'unsafe-inline'",
]
CSP_IMG_SRC = [
    "'self'",
    "blob:",
    "data:",
    "https://secure.gravatar.com",
]

if ENVIRONMENT == "development":
    CSP_SCRIPT_SRC += [
        "'unsafe-eval'",
    ]
    CSP_CONNECT_SRC += [
        "ws://127.0.0.1:8000",
    ]

# Before enforcing Content Security Policy, we recommend creating a separate
# Sentry project and collecting CSP violations in report only mode:
# https://docs.sentry.io/product/security-policy-reporting/

# Point this parameter to your Sentry installation:
# CSP_REPORT_URI = "https://example.com/api/{PROJECT_ID}/security/?sentry_key={SENTRY_KEY}"

# To enforce CSP (block violated resources), update the following parameter to False
CSP_REPORT_ONLY = True

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
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "sentry.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "sentry.auth.password_validation.MaximumLengthValidator",
        "OPTIONS": {"max_length": 256},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
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
from kombu import Queue

BROKER_URL = "redis://127.0.0.1:6379"
BROKER_TRANSPORT_OPTIONS = {}

# Ensure workers run async by default
# in Development you might want them to run in-process
# though it would cause timeouts/recursions in some cases
CELERY_ALWAYS_EAGER = False

# Complain about bad use of pickle.  See sentry.celery.SentryTask.apply_async for how
# this works.
CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE = False

# Complain about bad use of pickle in PickledObjectField
PICKLED_OBJECT_FIELD_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE = False

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
    "sentry.replays.tasks",
    "sentry.monitors.tasks",
    "sentry.tasks.app_store_connect",
    "sentry.tasks.assemble",
    "sentry.tasks.auth",
    "sentry.tasks.auto_remove_inbox",
    "sentry.tasks.auto_resolve_issues",
    "sentry.tasks.beacon",
    "sentry.tasks.check_auth",
    "sentry.tasks.clear_expired_snoozes",
    "sentry.tasks.clear_expired_rulesnoozes",
    "sentry.tasks.codeowners.code_owners_auto_sync",
    "sentry.tasks.codeowners.update_code_owners_schema",
    "sentry.tasks.collect_project_platforms",
    "sentry.tasks.commits",
    "sentry.tasks.commit_context",
    "sentry.tasks.deletion",
    "sentry.tasks.deletion.scheduled",
    "sentry.tasks.deletion.groups",
    "sentry.tasks.deletion.hybrid_cloud",
    "sentry.tasks.deliver_from_outbox",
    "sentry.tasks.digests",
    "sentry.tasks.email",
    "sentry.tasks.files",
    "sentry.tasks.groupowner",
    "sentry.tasks.integrations",
    "sentry.tasks.low_priority_symbolication",
    "sentry.tasks.merge",
    "sentry.tasks.options",
    "sentry.tasks.organization_mapping",
    "sentry.tasks.ping",
    "sentry.tasks.post_process",
    "sentry.tasks.process_buffer",
    "sentry.tasks.relay",
    "sentry.tasks.release_registry",
    "sentry.tasks.weekly_reports",
    "sentry.tasks.reprocessing",
    "sentry.tasks.reprocessing2",
    "sentry.tasks.scheduler",
    "sentry.tasks.sentry_apps",
    "sentry.tasks.servicehooks",
    "sentry.tasks.store",
    "sentry.tasks.symbolication",
    "sentry.tasks.unmerge",
    "sentry.tasks.update_user_reports",
    "sentry.tasks.user_report",
    "sentry.profiles.task",
    "sentry.release_health.tasks",
    "sentry.dynamic_sampling.tasks",
    "sentry.utils.suspect_resolutions.get_suspect_resolutions",
    "sentry.utils.suspect_resolutions_releases.get_suspect_resolutions_releases",
    "sentry.tasks.derive_code_mappings",
    "sentry.ingest.transaction_clusterer.tasks",
    "sentry.tasks.auto_enable_codecov",
    "sentry.tasks.weekly_escalating_forecast",
    "sentry.tasks.auto_ongoing_issues",
)
CELERY_QUEUES = [
    Queue("activity.notify", routing_key="activity.notify"),
    Queue("alerts", routing_key="alerts"),
    Queue("app_platform", routing_key="app_platform"),
    Queue("appstoreconnect", routing_key="sentry.tasks.app_store_connect.#"),
    Queue("assemble", routing_key="assemble"),
    Queue("auth", routing_key="auth"),
    Queue("buffers.process_pending", routing_key="buffers.process_pending"),
    Queue("buffers.incr", routing_key="buffers.incr"),
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
    Queue(
        "events.reprocessing.symbolicate_event_low_priority",
        routing_key="events.reprocessing.symbolicate_event_low_priority",
    ),
    Queue("events.save_event", routing_key="events.save_event"),
    Queue("events.save_event_transaction", routing_key="events.save_event_transaction"),
    Queue("events.save_event_attachments", routing_key="events.save_event_attachments"),
    Queue("events.symbolicate_event", routing_key="events.symbolicate_event"),
    Queue(
        "events.symbolicate_event_low_priority", routing_key="events.symbolicate_event_low_priority"
    ),
    Queue("events.symbolicate_js_event", routing_key="events.symbolicate_js_event"),
    Queue(
        "events.symbolicate_js_event_low_priority",
        routing_key="events.symbolicate_js_event_low_priority",
    ),
    Queue("files.delete", routing_key="files.delete"),
    Queue(
        "group_owners.process_suspect_commits", routing_key="group_owners.process_suspect_commits"
    ),
    Queue("group_owners.process_commit_context", routing_key="group_owners.process_commit_context"),
    Queue(
        "releasemonitor",
        routing_key="releasemonitor",
    ),
    Queue(
        "dynamicsampling",
        routing_key="dynamicsampling",
    ),
    Queue("incidents", routing_key="incidents"),
    Queue("incident_snapshots", routing_key="incident_snapshots"),
    Queue("incidents", routing_key="incidents"),
    Queue("integrations", routing_key="integrations"),
    Queue("merge", routing_key="merge"),
    Queue("options", routing_key="options"),
    Queue("post_process_errors", routing_key="post_process_errors"),
    Queue("post_process_issue_platform", routing_key="post_process_issue_platform"),
    Queue("post_process_transactions", routing_key="post_process_transactions"),
    Queue("relay_config", routing_key="relay_config"),
    Queue("relay_config_bulk", routing_key="relay_config_bulk"),
    Queue("reports.deliver", routing_key="reports.deliver"),
    Queue("reports.prepare", routing_key="reports.prepare"),
    Queue("search", routing_key="search"),
    Queue("sentry_metrics.indexer", routing_key="sentry_metrics.indexer"),
    Queue("similarity.index", routing_key="similarity.index"),
    Queue("sleep", routing_key="sleep"),
    Queue("stats", routing_key="stats"),
    Queue("subscriptions", routing_key="subscriptions"),
    Queue(
        "symbolications.compute_low_priority_projects",
        routing_key="symbolications.compute_low_priority_projects",
    ),
    Queue("unmerge", routing_key="unmerge"),
    Queue("update", routing_key="update"),
    Queue("profiles.process", routing_key="profiles.process"),
    Queue("get_suspect_resolutions", routing_key="get_suspect_resolutions"),
    Queue("get_suspect_resolutions_releases", routing_key="get_suspect_resolutions_releases"),
    Queue("replays.ingest_replay", routing_key="replays.ingest_replay"),
    Queue("replays.delete_replay", routing_key="replays.delete_replay"),
    Queue("counters-0", routing_key="counters-0"),
    Queue("triggers-0", routing_key="triggers-0"),
    Queue("derive_code_mappings", routing_key="derive_code_mappings"),
    Queue("transactions.name_clusterer", routing_key="transactions.name_clusterer"),
    Queue("hybrid_cloud.control_repair", routing_key="hybrid_cloud.control_repair"),
    Queue(
        "dynamicsampling",
        routing_key="dynamicsampling",
    ),
    Queue("auto_enable_codecov", routing_key="auto_enable_codecov"),
    Queue("weekly_escalating_forecast", routing_key="weekly_escalating_forecast"),
    Queue("auto_transition_issue_states", routing_key="auto_transition_issue_states"),
]

for queue in CELERY_QUEUES:
    queue.durable = False


from celery.schedules import crontab

CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), "sentry-celerybeat")
CELERYBEAT_SCHEDULE = {
    "check-auth": {
        "task": "sentry.tasks.check_auth",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60, "queue": "auth"},
    },
    "enqueue-scheduled-jobs": {
        "task": "sentry.tasks.enqueue_scheduled_jobs",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60},
    },
    "send-beacon": {
        "task": "sentry.tasks.send_beacon",
        # Run every hour
        "schedule": crontab(minute=0, hour="*/1"),
        "options": {"expires": 3600},
    },
    "send-ping": {
        "task": "sentry.tasks.send_ping",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
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
        "task": "sentry.monitors.tasks.check_monitors",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60},
    },
    "clear-expired-snoozes": {
        "task": "sentry.tasks.clear_expired_snoozes",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 300},
    },
    "clear-expired-rulesnoozes": {
        "task": "sentry.tasks.clear_expired_rulesnoozes",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 300},
    },
    "clear-expired-raw-events": {
        "task": "sentry.tasks.clear_expired_raw_events",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 300},
    },
    "collect-project-platforms": {
        "task": "sentry.tasks.collect_project_platforms",
        "schedule": crontab_with_minute_jitter(hour=3),
        "options": {"expires": 3600 * 24},
    },
    "deliver-from-outbox": {
        "task": "sentry.tasks.enqueue_outbox_jobs",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 30},
    },
    "update-user-reports": {
        "task": "sentry.tasks.update_user_reports",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 300},
    },
    "schedule-auto-resolution": {
        "task": "sentry.tasks.schedule_auto_resolution",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25},
    },
    "auto-remove-inbox": {
        "task": "sentry.tasks.auto_remove_inbox",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25},
    },
    "schedule-deletions": {
        "task": "sentry.tasks.deletion.run_scheduled_deletions",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25},
    },
    "reattempt-deletions": {
        "task": "sentry.tasks.deletion.reattempt_deletions",
        "schedule": crontab(hour=10, minute=0),  # 03:00 PDT, 07:00 EDT, 10:00 UTC
        "options": {"expires": 60 * 25},
    },
    "schedule-weekly-organization-reports-new": {
        "task": "sentry.tasks.weekly_reports.schedule_organizations",
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
    "schedule-hybrid-cloud-foreign-key-jobs": {
        "task": "sentry.tasks.deletion.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
    },
    "monitor-release-adoption": {
        "task": "sentry.release_health.tasks.monitor_release_adoption",
        "schedule": crontab(minute=0),
        "options": {"expires": 3600, "queue": "releasemonitor"},
    },
    "fetch-release-registry-data": {
        "task": "sentry.tasks.release_registry.fetch_release_registry_data",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 3600},
    },
    "fetch-appstore-builds": {
        "task": "sentry.tasks.app_store_connect.refresh_all_builds",
        # Run every hour
        "schedule": crontab(minute=0, hour="*/1"),
        "options": {"expires": 3600},
    },
    "snuba-subscription-checker": {
        "task": "sentry.snuba.tasks.subscription_checker",
        # Run every 20 minutes
        "schedule": crontab(minute="*/20"),
        "options": {"expires": 20 * 60},
    },
    "transaction-name-clusterer": {
        "task": "sentry.ingest.transaction_clusterer.tasks.spawn_clusterers",
        "schedule": crontab(minute=17),
        "options": {"expires": 3600},
    },
    "hybrid-cloud-repair-mappings": {
        "task": "sentry.tasks.organization_mapping.repair_mappings",
        # Run every hour
        "schedule": crontab(minute=0, hour="*/1"),
        "options": {"expires": 3600},
    },
    "auto-enable-codecov": {
        "task": "sentry.tasks.auto_enable_codecov.enable_for_org",
        # Run job once a day at 00:30
        "schedule": crontab(minute=30, hour="0"),
        "options": {"expires": 3600},
    },
    "dynamic-sampling-prioritize-projects": {
        "task": "sentry.dynamic_sampling.tasks.prioritise_projects",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
    },
    "dynamic-sampling-prioritize-transactions": {
        "task": "sentry.dynamic_sampling.tasks.prioritise_transactions",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
    },
    "dynamic-sampling-sliding-window": {
        "task": "sentry.dynamic_sampling.tasks.sliding_window",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "dynamic-sampling-sliding-window-org": {
        "task": "sentry.dynamic_sampling.tasks.sliding_window_org",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "weekly-escalating-forecast": {
        "task": "sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
        # TODO: Change this to run weekly once we verify the results
        "schedule": crontab(minute=0, hour="*/6"),
        # TODO: Increase expiry time to x4 once we change this to run weekly
        "options": {"expires": 60 * 60 * 3},
    },
    "dynamic-sampling-recalibrate-orgs": {
        "task": "sentry.dynamic_sampling.tasks.recalibrate_orgs",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
    },
    "schedule_auto_transition_new": {
        "task": "sentry.tasks.schedule_auto_transition_new",
        # Run job once a day at 00:30
        "schedule": crontab(minute=30, hour="0"),
        "options": {"expires": 3600},
    },
    "schedule_auto_transition_regressed": {
        "task": "sentry.tasks.schedule_auto_transition_regressed",
        # Run job once a day at 02:30
        "schedule": crontab(minute=30, hour="2"),
        "options": {"expires": 3600},
    },
}

# We prefer using crontab, as the time for timedelta will reset on each deployment. More information:  https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html#periodic-tasks
TIMEDELTA_ALLOW_LIST = {
    "flush-buffers",
    "sync-options",
    "schedule-digests",
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
        # This `internal` logger is separate from the `Logging` integration in the SDK. Since
        # we have this to record events, in `sdk.py` we set the integration's `event_level` to
        # None, so that it records breadcrumbs for all log calls but doesn't send any events.
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
        "arroyo": {"level": "INFO", "handlers": ["console"], "propagate": False},
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
    "DEFAULT_SCHEMA_CLASS": "sentry.apidocs.schema.SentrySchema",
}


if os.environ.get("OPENAPIGENERATE", False):
    OLD_OPENAPI_JSON_PATH = "tests/apidocs/openapi-deprecated.json"
    from sentry.apidocs.build import OPENAPI_TAGS, get_old_json_paths

    SPECTACULAR_SETTINGS = {
        "PREPROCESSING_HOOKS": ["sentry.apidocs.hooks.custom_preprocessing_hook"],
        "POSTPROCESSING_HOOKS": ["sentry.apidocs.hooks.custom_postprocessing_hook"],
        "DISABLE_ERRORS_AND_WARNINGS": False,
        "COMPONENT_SPLIT_REQUEST": False,
        "COMPONENT_SPLIT_PATCH": False,
        "AUTHENTICATION_WHITELIST": ["sentry.api.authentication.TokenAuthentication"],
        "TAGS": OPENAPI_TAGS,
        "TITLE": "API Reference",
        "DESCRIPTION": "Sentry Public API",
        "TOS": "http://sentry.io/terms/",
        "CONTACT": {"email": "partners@sentry.io"},
        "LICENSE": {"name": "Apache 2.0", "url": "http://www.apache.org/licenses/LICENSE-2.0.html"},
        "VERSION": "v0",
        "SERVERS": [{"url": "https://sentry.io/"}],
        "PARSER_WHITELIST": ["rest_framework.parsers.JSONParser"],
        "APPEND_PATHS": get_old_json_paths(OLD_OPENAPI_JSON_PATH),
        "SORT_OPERATION_PARAMETERS": False,
    }

CRISPY_TEMPLATE_PACK = "bootstrap3"
# Sentry and internal client configuration

SENTRY_FEATURES = {
    # Enables user registration.
    "auth:register": True,
    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    "organizations:alert-allow-indexed": False,
    # Enables tagging javascript errors from the browser console.
    "organizations:javascript-console-error-tag": False,
    # Enables the cron job to auto-enable codecov integrations.
    "organizations:auto-enable-codecov": False,
    # The overall flag for codecov integration, gated by plans.
    "organizations:codecov-integration": False,
    # Enables getting commit sha from git blame for codecov.
    "organizations:codecov-commit-sha-from-git-blame": False,
    # Enables automatically deriving of code mappings
    "organizations:derive-code-mappings": True,
    # Enable advanced search features, like negation and wildcard matching.
    "organizations:advanced-search": True,
    # Use metrics as the dataset for crash free metric alerts
    "organizations:alert-crash-free-metrics": False,
    # Enable auth provider configuration through api
    "organizations:api-auth-provider": False,
    "organizations:api-keys": False,
    # Enable multiple Apple app-store-connect sources per project.
    "organizations:app-store-connect-multiple": False,
    # Enable change alerts for an org
    "organizations:change-alerts": True,
    # Enable alerting based on crash free sessions/users
    "organizations:crash-rate-alerts": True,
    # Enable the mute alerts feature
    "organizations:mute-alerts": False,
    # Enable the Commit Context feature
    "organizations:commit-context": False,
    # Enable creating organizations within sentry (if SENTRY_SINGLE_ORGANIZATION
    # is not enabled).
    "organizations:create": True,
    # Enable usage of customer domains on the frontend
    "organizations:customer-domains": False,
    # Enable the 'discover' interface.
    "organizations:discover": False,
    # Enables events endpoint rate limit
    "organizations:discover-events-rate-limit": False,
    # Enable attaching arbitrary files to events.
    "organizations:event-attachments": True,
    # Allow organizations to configure all symbol sources.
    "organizations:symbol-sources": True,
    # Allow organizations to configure custom external symbol sources.
    "organizations:custom-symbol-sources": True,
    # Enable discover 2 basic functions
    "organizations:discover-basic": True,
    # Enable discover 2 custom queries and saved queries
    "organizations:discover-query": True,
    # Enable archive/escalating issue workflow
    "organizations:escalating-issues": False,
    # Enable archive/escalating issue workflow UI, enable everything except post processing
    "organizations:escalating-issues-ui": False,
    # Enable the new issue states and substates
    "organizations:issue-states": False,
    # Enable the task to transition new issues that are 3+ days old to (Unresolved, Ongoing) state
    "organizations:issue-states-auto-transition-new-ongoing": False,
    # Enable the task to transition regressed issues that are 14+ days old to (Unresolved, Ongoing) state
    "organizations:issue-states-auto-transition-regressed-ongoing": False,
    # Enable the new issue states and substates
    "organizations:remove-mark-reviewed": False,
    # Allows an org to have a larger set of project ownership rules per project
    "organizations:higher-ownership-limit": False,
    # Enable Performance view
    "organizations:performance-view": True,
    # Enable profiling
    "organizations:profiling": False,
    # Enable flamegraph view for profiling
    "organizations:profiling-flamegraphs": False,
    # Enable ui frames in flamecharts
    "organizations:profiling-ui-frames": False,
    # Enable the profiling aggregate flamegraph
    "organizations:profiling-aggregate-flamegraph": False,
    # Enable the profiling previews
    "organizations:profiling-previews": False,
    # Enable the profiling span previews
    "organizations:profiling-span-previews": False,
    # Enable the transactions backed profiling views
    "organizations:profiling-using-transactions": False,
    # Enable the sentry sample format response
    "organizations:profiling-sampled-format": False,
    # Enabled for those orgs who participated in the profiling Beta program
    "organizations:profiling-beta": False,
    # Enable profiling GA messaging (update paths from AM1 to AM2)
    "organizations:profiling-ga": False,
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
    # Enable rule page.
    "organizations:rule-page": False,
    # Enable incidents feature
    "organizations:incidents": False,
    # Enable issue alert incompatible rule check
    "organizations:issue-alert-incompatible-rules": False,
    # Enable issue alert previews
    "organizations:issue-alert-preview": False,
    # Enable issue alert test notifications
    "organizations:issue-alert-test-notifications": False,
    # Enable issue platform
    "organizations:issue-platform": False,
    # Whether to allow issue only search on the issue list
    "organizations:issue-search-allow-postgres-only-search": False,
    # Flags for enabling CdcEventsDatasetSnubaSearchBackend in sentry.io. No effect in open-source
    # sentry at the moment.
    "organizations:issue-search-use-cdc-primary": False,
    "organizations:issue-search-use-cdc-secondary": False,
    # Enable metrics feature on the backend
    "organizations:metrics": False,
    # Enable metric alert charts in email/slack
    "organizations:metric-alert-chartcuterie": False,
    # Extract metrics for sessions during ingestion.
    "organizations:metrics-extraction": False,
    # Normalize URL transaction names during ingestion.
    "organizations:transaction-name-normalize": True,
    # Mark URL transactions scrubbed by regex patterns as "sanitized".
    # NOTE: This flag does not concern transactions rewritten by clusterer rules.
    # Those are always marked as "sanitized".
    "organizations:transaction-name-mark-scrubbed-as-sanitized": True,
    # Sanitize transaction names in the ingestion pipeline.
    "organizations:transaction-name-sanitization": False,  # DEPRECATED
    # Extraction metrics for transactions during ingestion.
    "organizations:transaction-metrics-extraction": False,
    # True if Relay should drop raw session payloads after extracting metrics from them.
    "organizations:release-health-drop-sessions": False,
    # Enable threshold period in metric alert rule builder
    "organizations:metric-alert-threshold-period": False,
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
    # Enable integration functionality to work deployment integrations like Vercel
    "organizations:integrations-deployment": True,
    # Allow orgs to automatically create Tickets in Issue Alerts
    "organizations:integrations-ticket-rules": True,
    # Allow orgs to use the stacktrace linking feature
    "organizations:integrations-stacktrace-link": False,
    # Allow orgs to install a custom source code management integration
    "organizations:integrations-custom-scm": False,
    # Limit project events endpoint to only query back a certain number of days
    "organizations:project-event-date-limit": False,
    # Enable data forwarding functionality for organizations.
    "organizations:data-forwarding": True,
    # Enable readonly dashboards
    "organizations:dashboards-basic": True,
    # Enable custom editable dashboards
    "organizations:dashboards-edit": True,
    # Enable metrics enhanced performance in dashboards
    "organizations:dashboards-mep": False,
    # Enable release health widget in dashboards
    "organizations:dashboards-rh-widget": False,
    # Enable the dynamic sampling "Transaction Name" priority in the UI
    "organizations:dynamic-sampling-transaction-name-priority": False,
    # Enable minimap in the widget viewer modal in dashboards
    "organizations:widget-viewer-modal-minimap": False,
    # Enable experimental performance improvements.
    "organizations:enterprise-perf": False,
    # Enable the API to importing CODEOWNERS for a project
    "organizations:integrations-codeowners": False,
    # Enable inviting members to organizations.
    "organizations:invite-members": True,
    # Enable rate limits for inviting members.
    "organizations:invite-members-rate-limits": True,
    # Enable new issue alert "issue owners" fallback
    "organizations:issue-alert-fallback-targeting": False,
    # Enable SQL formatting for breadcrumb items and performance spans
    "organizations:sql-format": False,
    # Enable removing issue from issue list if action taken.
    "organizations:issue-list-removal-action": False,
    # Enable better priority sort algorithm.
    "organizations:issue-list-better-priority-sort": False,
    # Adds the ttid & ttfd vitals to the frontend
    "organizations:mobile-vitals": False,
    # Display CPU and memory metrics in transactions with profiles
    "organizations:mobile-cpu-memory-in-transactions": False,
    # Enable new page filter UI
    "organizations:new-page-filter": False,
    # Prefix host with organization ID when giving users DSNs (can be
    # customized with SENTRY_ORG_SUBDOMAIN_TEMPLATE)
    "organizations:org-subdomains": False,
    # Enable project selection on the stats page
    "organizations:project-stats": True,
    # Enable interpolation of null data points in charts instead of zerofilling in performance
    "organizations:performance-chart-interpolation": False,
    # Enable views for anomaly detection
    "organizations:performance-anomaly-detection-ui": False,
    # Enable histogram view in span details
    "organizations:performance-span-histogram-view": False,
    # Enable performance on-boarding checklist
    "organizations:performance-onboarding-checklist": False,
    # Enable transaction name only search
    "organizations:performance-transaction-name-only-search": False,
    # Enable transaction name only search on indexed
    "organizations:performance-transaction-name-only-search-indexed": False,
    # Re-enable histograms for Metrics Enhanced Performance Views
    "organizations:performance-mep-reintroduce-histograms": False,
    # Enable showing INP web vital in default views
    "organizations:performance-vitals-inp": False,
    # Enables a longer stats period for the performance landing page
    "organizations:performance-landing-page-stats-period": False,
    # Enable internal view for bannerless MEP view
    "organizations:performance-mep-bannerless-ui": False,
    # Enable updated landing page widget designs
    "organizations:performance-new-widget-designs": False,
    # Enable metrics-backed transaction summary view
    "organizations:performance-metrics-backed-transaction-summary": False,
    # Enable new trends
    "organizations:performance-new-trends": False,
    # Enable debug views for trendsv2 to be used internally
    "organizations:performance-trendsv2-dev-only": False,
    # Enable consecutive db performance issue type
    "organizations:performance-consecutive-db-issue": False,
    # Enable consecutive http performance issue type
    "organizations:performance-consecutive-http-detector": False,
    # Enable consecutive http performance issue type
    "organizations:performance-large-http-payload-detector": False,
    # Enable slow DB performance issue type
    "organizations:performance-slow-db-issue": False,
    # Enable N+1 API Calls performance issue type
    "organizations:performance-n-plus-one-api-calls-detector": False,
    # Enable compressed assets performance issue type
    "organizations:performance-issues-compressed-assets-detector": False,
    # Enable render blocking assets performance issue type
    "organizations:performance-issues-render-blocking-assets-detector": False,
    # Enable MN+1 DB performance issue type
    "organizations:performance-issues-m-n-plus-one-db-detector": False,
    # Enable the new Related Events feature
    "organizations:related-events": False,
    # Enable usage of external relays, for use with Relay. See
    # https://github.com/getsentry/relay.
    "organizations:relay": True,
    # Enable Sentry Functions
    "organizations:sentry-functions": False,
    # Enable experimental session replay backend APIs
    "organizations:session-replay": False,
    # Enable Session Replay showing in the sidebar
    "organizations:session-replay-ui": True,
    # Enabled for those orgs who participated in the Replay Beta program
    "organizations:session-replay-beta-grace": False,
    # Enable replay GA messaging (update paths from AM1 to AM2)
    "organizations:session-replay-ga": False,
    # Enabled experimental session replay network data view
    "organizations:session-replay-network-details": False,
    # Enable experimental session replay SDK for recording on Sentry
    "organizations:session-replay-sdk": False,
    "organizations:session-replay-sdk-errors-only": False,
    # Enable data scrubbing of replay recording payloads in Relay.
    "organizations:session-replay-recording-scrubbing": False,
    # Enables subquery optimizations for the replay_index page
    "organizations:session-replay-index-subquery": False,
    # Enable the new suggested assignees feature
    "organizations:streamline-targeting-context": False,
    # Enable the new experimental starfish view
    "organizations:starfish-view": False,
    # Enable starfish endpoint that's used for regressing testing purposes
    "organizations:starfish-test-endpoint": False,
    # Enable Session Stats down to a minute resolution
    "organizations:minute-resolution-sessions": True,
    # Notify all project members when fallthrough is disabled, instead of just the auto-assignee
    "organizations:notification-all-recipients": False,
    # Enable performance issues dev options, includes changing detection thresholds and other parts of issues that we're using for development.
    "organizations:performance-issues-dev": False,
    # Enables updated all events tab in a performance issue
    "organizations:performance-issues-all-events-tab": False,
    # Temporary flag to test search performance that's running slow in S4S
    "organizations:performance-issues-search": True,
    # Enable version 2 of reprocessing (completely distinct from v1)
    "organizations:reprocessing-v2": False,
    # Enable the UI for the overage alert settings
    "organizations:slack-overage-notifications": False,
    # Enable basic SSO functionality, providing configurable single sign on
    # using services like GitHub / Google. This is *not* the same as the signup
    # and login with Github / Azure DevOps that sentry.io provides.
    "organizations:sso-basic": True,
    # Enable SAML2 based SSO functionality. getsentry/sentry-auth-saml2 plugin
    # must be installed to use this functionality.
    "organizations:sso-saml2": True,
    # Enable a UI where users can see bundles and their artifacts which only have debug IDs
    "organizations:source-maps-debug-ids": False,
    # Enable the new opinionated dynamic sampling
    "organizations:dynamic-sampling": False,
    # Enable view hierarchies options
    "organizations:view-hierarchies-options-dev": False,
    # Enable anr improvements ui
    "organizations:anr-improvements": False,
    # Enable anr frame analysis
    "organizations:anr-analyze-frames": False,
    # Enable device.class as a selectable column
    "organizations:device-classification": False,
    # Enables synthesis of device.class in ingest
    "organizations:device-class-synthesis": False,
    # Enable the onboarding heartbeat footer on the sdk setup page
    "organizations:onboarding-heartbeat-footer": False,
    # Enable a new behavior for deleting the freshly created project,
    # if the user clicks on the back button in the onboarding for new orgs
    "organizations:onboarding-project-deletion-on-back-click": False,
    # Disables multiselect platform in the onboarding flow
    "organizations:onboarding-remove-multiselect-platform": False,
    # Enable the project loader feature in the onboarding
    "organizations:onboarding-project-loader": False,
    # Enable the SDK selection feature in the onboarding
    "organizations:onboarding-sdk-selection": False,
    # Enable OpenAI suggestions in the issue details page
    "organizations:open-ai-suggestion": False,
    # Enable ANR rates in project details page
    "organizations:anr-rate": False,
    # Enable tag improvements in the issue details page
    "organizations:issue-details-tag-improvements": False,
    # Enable the release details performance section
    "organizations:release-comparison-performance": False,
    # Enable team insights page
    "organizations:team-insights": True,
    # Enable u2f verification on superuser form
    "organizations:u2f-superuser-form": False,
    # Enable project creation for all
    "organizations:team-project-creation-all": False,
    # Enable setting team-level roles and receiving permissions from them
    "organizations:team-roles": False,
    # Enable team member role provisioning through scim
    "organizations:scim-team-roles": False,
    # Enable the setting of org roles for team
    "organizations:org-roles-for-teams": False,
    # Enable new JS SDK Dynamic Loader
    "organizations:js-sdk-dynamic-loader": False,
    # Enable sliding window for dynamic sampling
    "organizations:ds-sliding-window": False,
    # If true certain Slack messages will be escaped to prevent rendering markdown
    "organizations:slack-escape-messages": False,
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
    # Enable suspect resolutions feature
    "projects:suspect-resolutions": False,
    # Use Kafka (instead of Celery) for ingestion pipeline.
    "projects:kafka-ingest": False,
    # Workflow 2.0 Auto associate commits to commit sha release
    "projects:auto-associate-commits-to-release": False,
    # Starfish: extract metrics from the spans
    "projects:span-metrics-extraction": False,
    # Don't add feature defaults down here! Please add them in their associated
    # group sorted alphabetically.
}

# Default time zone for localization in the UI.
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
SENTRY_DEFAULT_TIME_ZONE = "UTC"

SENTRY_DEFAULT_LANGUAGE = "en"

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

# sample rate for relay's cache invalidation task
SENTRY_RELAY_TASK_APM_SAMPLING = 0

# sample rate for ingest consumer processing functions
SENTRY_INGEST_CONSUMER_APM_SAMPLING = 0

# sample rate for Apple App Store Connect tasks transactions
SENTRY_APPCONNECT_APM_SAMPLING = SENTRY_BACKEND_APM_SAMPLING

# sample rate for suspect commits task
SENTRY_SUSPECT_COMMITS_APM_SAMPLING = 0

# sample rate for post_process_group task
SENTRY_POST_PROCESS_GROUP_APM_SAMPLING = 0

# sample rate for all reprocessing tasks (except for the per-event ones)
SENTRY_REPROCESSING_APM_SAMPLING = 0

# ----
# end APM config
# ----


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
    "preview": "sentry.utils.email.PreviewBackend",
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
SENTRY_CACHE_OPTIONS = {"is_default_cache": True}

# Attachment blob cache backend
SENTRY_ATTACHMENTS = "sentry.attachments.default.DefaultAttachmentCache"
SENTRY_ATTACHMENTS_OPTIONS = {}

# Replays blob cache backend.
#
# To ease first time setup, we default to whatever SENTRY_CACHE is configured as. If you're
# handling a large amount of replays you should consider setting up an isolated cache provider.

# To override the default configuration you need to provide the string path of a function or
# class as the `SENTRY_REPLAYS_CACHE` value and optionally provide keyword arguments on the
# `SENTRY_REPLAYS_CACHE_OPTIONS` value.  Its expected that you will use one of the classes
# defined within `sentry/cache/` but it is not required.

# For reference, this cache will store binary blobs of data up to 1MB in size.  This data is
# ephemeral and will be deleted as soon as the ingestion pipeline finishes processing a replay
# recording segment. You can determine the average size of the chunks being cached by running
# queries against the ReplayRecordingSegment model with the File model joined. The File model has
# a size attribute.
SENTRY_REPLAYS_CACHE: str = "sentry.replays.cache.default"
SENTRY_REPLAYS_CACHE_OPTIONS: Dict[str, Any] = {}

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
SENTRY_RELAY_PROJECTCONFIG_CACHE = "sentry.relay.projectconfig_cache.redis.RedisProjectConfigCache"
SENTRY_RELAY_PROJECTCONFIG_CACHE_OPTIONS = {}

# Which cache to use for debouncing cache updates to the projectconfig cache
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE = (
    "sentry.relay.projectconfig_debounce_cache.base.ProjectConfigDebounceCache"
)
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS = {}

# Rate limiting backend
SENTRY_RATELIMITER = "sentry.ratelimits.base.RateLimiter"
SENTRY_RATELIMITER_ENABLED = False
SENTRY_RATELIMITER_OPTIONS = {}
SENTRY_RATELIMITER_DEFAULT = 999
SENTRY_CONCURRENT_RATE_LIMIT_DEFAULT = 999
ENFORCE_CONCURRENT_RATE_LIMITS = False

# Rate Limit Group Category Defaults
SENTRY_CONCURRENT_RATE_LIMIT_GROUP_CLI = 999
SENTRY_RATELIMITER_GROUP_CLI = 999

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
SENTRY_METRICS_DISALLOW_BAD_TAGS = IS_DEV

# Metrics product
SENTRY_METRICS_INDEXER = "sentry.sentry_metrics.indexer.postgres.postgres_v2.PostgresIndexer"
SENTRY_METRICS_INDEXER_OPTIONS = {}
SENTRY_METRICS_INDEXER_CACHE_TTL = 3600 * 2
SENTRY_METRICS_INDEXER_TRANSACTIONS_SAMPLE_RATE = 0.1

SENTRY_METRICS_INDEXER_SPANNER_OPTIONS = {}

# Rate limits during string indexing for our metrics product.
# Which cluster to use. Example: {"cluster": "default"}
SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS = {}
SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE = (
    SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS
)

# Controls the sample rate with which we report errors to Sentry for metric messages
# dropped due to rate limits.
SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 0.01

# Cardinality limits during metric bucket ingestion.
# Which cluster to use. Example: {"cluster": "default"}
SENTRY_METRICS_INDEXER_CARDINALITY_LIMITER_OPTIONS = {}
SENTRY_METRICS_INDEXER_CARDINALITY_LIMITER_OPTIONS_PERFORMANCE = {}
SENTRY_METRICS_INDEXER_ENABLE_SLICED_PRODUCER = False

# Release Health
SENTRY_RELEASE_HEALTH = "sentry.release_health.sessions.SessionsReleaseHealthBackend"
SENTRY_RELEASE_HEALTH_OPTIONS = {}

# Release Monitor
SENTRY_RELEASE_MONITOR = (
    "sentry.release_health.release_monitor.sessions.SessionReleaseMonitorBackend"
)
SENTRY_RELEASE_MONITOR_OPTIONS = {}

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

# Secret key for OpenAI
OPENAI_API_KEY = None

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
        "desc": (
            """
            Admin privileges on any teams of which they're a member. They can
            create new teams and projects, as well as remove teams and projects
            on which they already hold membership (or all teams, if open
            membership is enabled). Additionally, they can manage memberships of
            teams that they are members of. They cannot invite members to the
            organization.
            """
        ),
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
        "is_retired": True,
    },
    {
        "id": "manager",
        "name": "Manager",
        "desc": "Gains admin access on all teams as well as the ability to add and remove members.",
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
        "is_global": True,
    },
    {
        "id": "owner",
        "name": "Owner",
        "desc": (
            """
            Unrestricted access to the organization, its data, and its settings.
            Can add, modify, and delete projects and members, as well as make
            billing and plan changes.
            """
        ),
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
        "is_global": True,
    },
)

SENTRY_TEAM_ROLES = (
    {
        "id": "contributor",
        "name": "Contributor",
        "desc": "Contributors can view and act on events, as well as view most other data within the team's projects.",
        "scopes": {
            "event:read",
            "event:write",
            # "event:admin",  # Scope granted/withdrawn by "sentry:events_member_admin" to org-level role
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
            "alerts:read",
            # "alerts:write",  # Scope granted/withdrawn by "sentry:alerts_member_write" to org-level role
        },
    },
    {
        "id": "admin",
        "name": "Team Admin",
        "desc": (
            # TODO: Editing pass
            """
            Admin privileges on the team. They can create and remove projects,
            and can manage the team's memberships. They cannot invite members to
            the organization.
            """
        ),
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
        "is_minimum_role_for": "admin",
    },
)

# See sentry/options/__init__.py for more information
SENTRY_OPTIONS = {}
SENTRY_DEFAULT_OPTIONS = {}

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = False

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

# Controls whether devserver spins up Relay, Kafka, and several ingest worker jobs to direct store traffic
# through the Relay ingestion pipeline. Without, ingestion is completely disabled. Use `bin/load-mocks` to
# generate fake data for local testing. You can also manually enable relay with the `--ingest` flag to `devserver`.
# XXX: This is disabled by default as typical development workflows do not require end-to-end services running
# and disabling optional services reduces resource consumption and complexity
SENTRY_USE_RELAY = False
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

# This flag tell DEVSERVICES to start the ingest-metrics-consumer in order to work on
# metrics in the development environment. Note: this is "metrics" the product
SENTRY_USE_METRICS_DEV = False

# This flags activates the Change Data Capture backend in the development environment
SENTRY_USE_CDC_DEV = False

# This flag activates profiling backend in the development environment
SENTRY_USE_PROFILING = False

# This flag activates consuming issue platform occurrence data in the development environment
SENTRY_USE_ISSUE_OCCURRENCE = False

# This flag activates code paths that are specific for customer domains
SENTRY_USE_CUSTOMER_DOMAINS = False

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


# platform.processor() changed at some point between these:
# 11.2.3: arm
# 12.3.1: arm64
APPLE_ARM64 = sys.platform == "darwin" and platform.processor() in {"arm", "arm64"}

SENTRY_DEVSERVICES = {
    "redis": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-library-redis:5.0-alpine",
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
            "image": f"ghcr.io/getsentry/image-mirror-library-postgres:{PG_VERSION}-alpine",
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
        }
    ),
    "zookeeper": lambda settings, options: (
        {
            # On Apple arm64, we upgrade to version 6.x to allow zookeeper to run properly on Apple's arm64
            # See details https://github.com/confluentinc/kafka-images/issues/80#issuecomment-855511438
            "image": "ghcr.io/getsentry/image-mirror-confluentinc-cp-zookeeper:6.2.0",
            "environment": {"ZOOKEEPER_CLIENT_PORT": "2181"},
            "volumes": {"zookeeper_6": {"bind": "/var/lib/zookeeper/data"}},
            "only_if": "kafka" in settings.SENTRY_EVENTSTREAM or settings.SENTRY_USE_RELAY,
        }
    ),
    "kafka": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-confluentinc-cp-kafka:6.2.0",
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
            "volumes": {"kafka_6": {"bind": "/var/lib/kafka/data"}},
            "only_if": "kafka" in settings.SENTRY_EVENTSTREAM
            or settings.SENTRY_USE_RELAY
            or settings.SENTRY_DEV_PROCESS_SUBSCRIPTIONS,
        }
    ),
    "clickhouse": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-yandex-clickhouse-server:20.3.9.70"
            if not APPLE_ARM64
            # altinity provides clickhouse support to other companies
            # Official support: https://github.com/ClickHouse/ClickHouse/issues/22222
            # This image is build with this script https://gist.github.com/filimonov/5f9732909ff66d5d0a65b8283382590d
            else "ghcr.io/getsentry/image-mirror-altinity-clickhouse-server:21.6.1.6734-testing-arm",
            "pull": True,
            "ports": {"9000/tcp": 9000, "9009/tcp": 9009, "8123/tcp": 8123},
            "ulimits": [{"name": "nofile", "soft": 262144, "hard": 262144}],
            # The arm image does not properly load the MAX_MEMORY_USAGE_RATIO
            # from the environment in loc_config.xml, thus, hard-coding it there
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
            "image": "ghcr.io/getsentry/snuba:latest",
            "pull": True,
            "ports": {"1218/tcp": 1218, "1219/tcp": 1219},
            "command": ["devserver"]
            + (["--no-workers"] if "snuba" in settings.SENTRY_EVENTSTREAM else []),
            "environment": {
                "PYTHONUNBUFFERED": "1",
                "SNUBA_SETTINGS": "docker",
                "DEBUG": "1",
                "CLICKHOUSE_HOST": "{containers[clickhouse][name]}",
                "CLICKHOUSE_PORT": "9000",
                "CLICKHOUSE_HTTP_PORT": "8123",
                "DEFAULT_BROKERS": ""
                if "snuba" in settings.SENTRY_EVENTSTREAM
                else "{containers[kafka][name]}:9093",
                "REDIS_HOST": "{containers[redis][name]}",
                "REDIS_PORT": "6379",
                "REDIS_DB": "1",
                "ENABLE_SENTRY_METRICS_DEV": "1" if settings.SENTRY_USE_METRICS_DEV else "",
                "ENABLE_PROFILES_CONSUMER": "1" if settings.SENTRY_USE_PROFILING else "",
                "ENABLE_ISSUE_OCCURRENCE_CONSUMER": "1"
                if settings.SENTRY_USE_ISSUE_OCCURRENCE
                else "",
                "ENABLE_AUTORUN_MIGRATION_SEARCH_ISSUES": "1",
            },
            "only_if": "snuba" in settings.SENTRY_EVENTSTREAM
            or "kafka" in settings.SENTRY_EVENTSTREAM,
        }
    ),
    "bigtable": lambda settings, options: (
        {
            "image": "us.gcr.io/sentryio/cbtemulator:23c02d92c7a1747068eb1fc57dddbad23907d614",
            "ports": {"8086/tcp": 8086},
            # NEED_BIGTABLE is set by CI so we don't have to pass
            # --skip-only-if when compiling which services to run.
            "only_if": os.environ.get("NEED_BIGTABLE", False)
            or "bigtable" in settings.SENTRY_NODESTORE,
        }
    ),
    "memcached": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-library-memcached:1.5-alpine",
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
            "only_if": bool(os.environ.get("SENTRY_USE_RELAY", settings.SENTRY_USE_RELAY)),
            "with_devserver": True,
        }
    ),
    "chartcuterie": lambda settings, options: (
        {
            "image": "us.gcr.io/sentryio/chartcuterie:latest",
            "pull": True,
            "volumes": {settings.CHARTCUTERIE_CONFIG_DIR: {"bind": "/etc/chartcuterie"}},
            "environment": {
                "CHARTCUTERIE_CONFIG": "/etc/chartcuterie/config.js",
                "CHARTCUTERIE_CONFIG_POLLING": "true",
            },
            "ports": {"9090/tcp": 7901},
            # NEED_CHARTCUTERIE is set by CI so we don't have to pass --skip-only-if when compiling which services to run.
            "only_if": os.environ.get("NEED_CHARTCUTERIE", False)
            or options.get("chart-rendering.enabled"),
        }
    ),
    "cdc": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/cdc:latest",
            "pull": True,
            "only_if": settings.SENTRY_USE_CDC_DEV,
            "command": ["cdc", "-c", "/etc/cdc/configuration.yaml", "producer"],
            "volumes": {settings.CDC_CONFIG_DIR: {"bind": "/etc/cdc"}},
        }
    ),
}

# Max file size for serialized file uploads in API
SENTRY_MAX_SERIALIZED_FILE_SIZE = 5000000

# Max file size for avatar photo uploads
SENTRY_MAX_AVATAR_SIZE = 5000000

# The maximum age of raw events before they are deleted
SENTRY_RAW_EVENT_MAX_AGE_DAYS = 10

# statuspage.io support
STATUS_PAGE_ID = None
STATUS_PAGE_API_HOST = "statuspage.io"

SENTRY_SELF_HOSTED = True

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
    "release": sentry.__semantic_version__,
    "environment": ENVIRONMENT,
    "in_app_include": ["sentry", "sentry_plugins"],
    "debug": True,
    "send_default_pii": True,
    "auto_enabling_integrations": False,
    "_experiments": {
        "custom_measurements": True,
    },
}

SENTRY_DEV_DSN = os.environ.get("SENTRY_DEV_DSN")
if SENTRY_DEV_DSN:
    # In production, this value is *not* set via an env variable
    # https://github.com/getsentry/getsentry/blob/16a07f72853104b911a368cc8ae2b4b49dbf7408/getsentry/conf/settings/prod.py#L604-L606
    # This is used in case you want to report traces of your development set up to a project of your choice
    SENTRY_SDK_CONFIG["dsn"] = SENTRY_DEV_DSN

# The sample rate to use for profiles. This is conditional on the usage of
# traces_sample_rate. So that means the true sample rate will be approximately
# traces_sample_rate * profiles_sample_rate
# (subject to things like the traces_sampler)
SENTRY_PROFILES_SAMPLE_RATE = 0

# We want to test a few schedulers possible in the profiler. Some are platform
# specific, and each have their own pros/cons. See the sdk for more details.
SENTRY_PROFILER_MODE = "sleep"

# To have finer control over which process will have profiling enabled, this
# environment variable will be required to enable profiling.
#
# This is because profiling requires that we run some stuff globally, and we
# are not ready to run this on the more critical parts of the codebase such as
# the ingest workers yet.
#
# This will allow us to have finer control over where we are running the
# profiler. For example, only on the web server.
SENTRY_PROFILING_ENABLED = os.environ.get("SENTRY_PROFILING_ENABLED", False)

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
# alerting the user of outdated SDKs.
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
        "filters": {"filetypes": ["pe", "pdb", "portablepdb"]},
        "url": "https://msdl.microsoft.com/download/symbols/",
        "is_public": True,
    },
    "nuget": {
        "type": "http",
        "id": "sentry:nuget",
        "name": "NuGet.org",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["portablepdb"]},
        "url": "https://symbols.nuget.org/download/symbols/",
        "is_public": True,
    },
    "citrix": {
        "type": "http",
        "id": "sentry:citrix",
        "name": "Citrix",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "url": "http://ctxsym.citrix.com/symbols/",
        "is_public": True,
    },
    "intel": {
        "type": "http",
        "id": "sentry:intel",
        "name": "Intel",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "url": "https://software.intel.com/sites/downloads/symbols/",
        "is_public": True,
    },
    "amd": {
        "type": "http",
        "id": "sentry:amd",
        "name": "AMD",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "url": "https://download.amd.com/dir/bin/",
        "is_public": True,
    },
    "nvidia": {
        "type": "http",
        "id": "sentry:nvidia",
        "name": "NVIDIA",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "url": "https://driver-symbols.nvidia.com/",
        "is_public": True,
    },
    "chromium": {
        "type": "http",
        "id": "sentry:chromium",
        "name": "Chromium",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "url": "https://chromium-browser-symsrv.commondatastorage.googleapis.com/",
        "is_public": True,
    },
    "unity": {
        "type": "http",
        "id": "sentry:unity",
        "name": "Unity",
        "layout": {"type": "symstore"},
        "filters": {"filetypes": ["pe", "pdb"]},
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
    # === Various Linux distributions ===
    # The `https://debuginfod.elfutils.org/` symbol server is set up to federate
    # to a bunch of distro-specific servers, and they explicitly state that:
    # > If your distro offers a server, you may prefer to link to that one directly
    # In the future, we could add the following servers as well after validating:
    # - https://debuginfod.opensuse.org/
    # - https://debuginfod.debian.net/
    # - https://debuginfod.fedoraproject.org/
    # - https://debuginfod.archlinux.org/
    # - https://debuginfod.centos.org/
    # A couple more servers for less widespread distros are also listed, and there
    # might be even more that are not listed on that page.
    # NOTE: The `debuginfod` layout in symbolicator requires the `/buildid/` prefix
    # to be part of the `url`.
    "ubuntu": {
        "type": "http",
        "id": "sentry:ubuntu",
        "name": "Ubuntu",
        "layout": {"type": "debuginfod"},
        "url": "https://debuginfod.ubuntu.com/buildid/",
        "filters": {"filetypes": ["elf_code", "elf_debug"]},
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
# This should be the url pointing to the JS SDK. It may contain up to two "%s".
# The first "%s" will be replaced with the SDK version, the second one is used
# to inject a bundle modifier in the JS SDK CDN loader. e.g:
# - 'https://browser.sentry-cdn.com/%s/bundle%s.min.js' will become
# 'https://browser.sentry-cdn.com/7.0.0/bundle.es5.min.js'
# - 'https://browser.sentry-cdn.com/%s/bundle.min.js' will become
# 'https://browser.sentry-cdn.com/7.0.0/bundle.min.js'
# - 'https://browser.sentry-cdn.com/6.19.7/bundle.min.js' will stay the same.
JS_SDK_LOADER_DEFAULT_SDK_URL = ""

# block domains which are generally used by spammers -- keep this configurable
# in case a self-hosted install wants to allow it
INVALID_EMAIL_ADDRESS_PATTERN = re.compile(r"\@qq\.com$", re.I)

# This is customizable for sentry.io, but generally should only be additive
# (currently the values not used anymore so this is more for documentation purposes)
SENTRY_USER_PERMISSIONS = ("broadcasts.admin", "users.admin", "options.admin")

# WARNING(iker): there are two different formats for KAFKA_CLUSTERS: the one we
# use below, and a legacy one still used in `getsentry`.
# Reading items from this default configuration directly might break deploys.
# To correctly read items from this dictionary and not worry about the format,
# see `sentry.utils.kafka_config.get_kafka_consumer_cluster_options`.
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

# These constants define kafka topic names, as well as keys into `KAFKA_TOPICS`
# which contains cluster mappings for these topics. Follow these steps to
# override a kafka topic name:
#
#  1. Change the value of the `KAFKA_*` constant (e.g. KAFKA_EVENTS).
#  2. For changes in override files, such as `sentry.conf.py` or in getsentry's
#     `prod.py`, also override the entirety of `KAFKA_TOPICS` to ensure the keys
#     pick up the change.

KAFKA_EVENTS = "events"
KAFKA_EVENTS_COMMIT_LOG = "snuba-commit-log"
KAFKA_TRANSACTIONS = "transactions"
KAFKA_TRANSACTIONS_COMMIT_LOG = "snuba-transactions-commit-log"
KAFKA_OUTCOMES = "outcomes"
KAFKA_OUTCOMES_BILLING = "outcomes-billing"
KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS = "events-subscription-results"
KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS = "transactions-subscription-results"
KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS = "generic-metrics-subscription-results"

KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS = "sessions-subscription-results"
KAFKA_METRICS_SUBSCRIPTIONS_RESULTS = "metrics-subscription-results"
KAFKA_INGEST_EVENTS = "ingest-events"
KAFKA_INGEST_ATTACHMENTS = "ingest-attachments"
KAFKA_INGEST_TRANSACTIONS = "ingest-transactions"
KAFKA_INGEST_METRICS = "ingest-metrics"
KAFKA_SNUBA_METRICS = "snuba-metrics"
KAFKA_PROFILES = "profiles"
KAFKA_INGEST_PERFORMANCE_METRICS = "ingest-performance-metrics"
KAFKA_SNUBA_GENERIC_METRICS = "snuba-generic-metrics"
KAFKA_INGEST_REPLAY_EVENTS = "ingest-replay-events"
KAFKA_INGEST_REPLAYS_RECORDINGS = "ingest-replay-recordings"
KAFKA_INGEST_OCCURRENCES = "ingest-occurrences"
KAFKA_INGEST_MONITORS = "ingest-monitors"
KAFKA_EVENTSTREAM_GENERIC = "generic-events"
KAFKA_GENERIC_EVENTS_COMMIT_LOG = "snuba-generic-events-commit-log"

KAFKA_SUBSCRIPTION_RESULT_TOPICS = {
    "events": KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS,
    "transactions": KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
    "generic-metrics": KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS,
    "sessions": KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS,
    "metrics": KAFKA_METRICS_SUBSCRIPTIONS_RESULTS,
}

# Cluster configuration for each Kafka topic by name.
KAFKA_TOPICS = {
    KAFKA_EVENTS: {"cluster": "default"},
    KAFKA_EVENTS_COMMIT_LOG: {"cluster": "default"},
    KAFKA_TRANSACTIONS: {"cluster": "default"},
    KAFKA_TRANSACTIONS_COMMIT_LOG: {"cluster": "default"},
    KAFKA_OUTCOMES: {"cluster": "default"},
    # When OUTCOMES_BILLING is None, it inherits from OUTCOMES and does not
    # create a separate producer. Check ``track_outcome`` for details.
    KAFKA_OUTCOMES_BILLING: None,
    KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS: {"cluster": "default"},
    KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS: {"cluster": "default"},
    KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS: {"cluster": "default"},
    KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS: {"cluster": "default"},
    KAFKA_METRICS_SUBSCRIPTIONS_RESULTS: {"cluster": "default"},
    # Topic for receiving simple events (error events without attachments) from Relay
    KAFKA_INGEST_EVENTS: {"cluster": "default"},
    # Topic for receiving 'complex' events (error events with attachments) from Relay
    KAFKA_INGEST_ATTACHMENTS: {"cluster": "default"},
    # Topic for receiving transaction events (APM events) from Relay
    KAFKA_INGEST_TRANSACTIONS: {"cluster": "default"},
    # Topic for receiving metrics from Relay
    KAFKA_INGEST_METRICS: {"cluster": "default"},
    # Topic for indexer translated metrics
    KAFKA_SNUBA_METRICS: {"cluster": "default"},
    # Topic for receiving profiles from Relay
    KAFKA_PROFILES: {"cluster": "default"},
    KAFKA_INGEST_PERFORMANCE_METRICS: {"cluster": "default"},
    KAFKA_SNUBA_GENERIC_METRICS: {"cluster": "default"},
    KAFKA_INGEST_REPLAY_EVENTS: {"cluster": "default"},
    KAFKA_INGEST_REPLAYS_RECORDINGS: {"cluster": "default"},
    KAFKA_INGEST_OCCURRENCES: {"cluster": "default"},
    KAFKA_INGEST_MONITORS: {"cluster": "default"},
    KAFKA_EVENTSTREAM_GENERIC: {"cluster": "default"},
    KAFKA_GENERIC_EVENTS_COMMIT_LOG: {"cluster": "default"},
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
    "sentry.replays",
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
SYMBOLICATOR_POLL_TIMEOUT = 5

# When retrying symbolication requests or querying for the result this set the
# max number of second to wait between subsequent attempts.
SYMBOLICATOR_MAX_RETRY_AFTER = 2

# The `url` of the different Symbolicator pools.
# We want to route different workloads to a different set of Symbolicator pools.
# This can be as fine-grained as using a different pool for normal "native"
# symbolication, `js` symbolication, and for `lpq` / `lpq-js`.
# (See `SENTRY_LPQ_OPTIONS` and related settings)
# The keys here should match the `SymbolicatorPools` enum
# defined in `src/sentry/lang/native/symbolicator.py`.
# If a specific setting does not exist, this will fall back to the `default` pool.
# If that is not configured, it will fall back to the `url` configured in
# `symbolicator.options`.
# The settings here are intentionally empty and will fall back to
# `symbolicator.options` for backwards compatibility.
SYMBOLICATOR_POOL_URLS = {
    # "js": "...",
    # "default": "...",
    # "lpq": "...",
    # "lpq_js": "...",
}

SENTRY_REQUEST_METRIC_ALLOWED_PATHS = (
    "sentry.web.api",
    "sentry.web.frontend",
    "sentry.api.endpoints",
    "sentry.data_export.endpoints",
    "sentry.discover.endpoints",
    "sentry.incidents.endpoints",
    "sentry.replays.endpoints",
    "sentry.monitors.endpoints",
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

# If this is turned on, then sentry will perform automatic grouping updates.
SENTRY_GROUPING_AUTO_UPDATE_ENABLED = False

# How long is the migration phase for grouping updates?
SENTRY_GROUPING_UPDATE_MIGRATION_PHASE = 30 * 24 * 3600  # 30 days

SENTRY_USE_UWSGI = True

# When copying attachments for to-be-reprocessed events into processing store,
# how large is an individual file chunk? Each chunk is stored as Redis key.
SENTRY_REPROCESSING_ATTACHMENT_CHUNK_SIZE = 2**20

# Which cluster is used to store auxiliary data for reprocessing. Note that
# this cluster is not used to store attachments etc, that still happens on
# rc-processing. This is just for buffering up event IDs and storing a counter
# for synchronization/progress report.
SENTRY_REPROCESSING_SYNC_REDIS_CLUSTER = "default"

# How long tombstones from reprocessing will live.
SENTRY_REPROCESSING_TOMBSTONES_TTL = 24 * 3600

# How long reprocessing counters are kept in Redis before they expire.
SENTRY_REPROCESSING_SYNC_TTL = 30 * 24 * 3600  # 30 days

# How many events to query for at once while paginating through an entire
# issue. Note that this needs to be kept in sync with the time-limits on
# `sentry.tasks.reprocessing2.reprocess_group`. That task is responsible for
# copying attachments from filestore into redis and can easily take a couple of
# seconds per event. Better play it safe!
SENTRY_REPROCESSING_PAGE_SIZE = 10

# How many event IDs to buffer up in Redis before sending them to Snuba. This
# is about "remaining events" exclusively.
SENTRY_REPROCESSING_REMAINING_EVENTS_BUF_SIZE = 500

# Which backend to use for RealtimeMetricsStore.
#
# Currently, only redis is supported.
SENTRY_REALTIME_METRICS_BACKEND = (
    "sentry.processing.realtime_metrics.dummy.DummyRealtimeMetricsStore"
)
SENTRY_REALTIME_METRICS_OPTIONS = {
    # The redis cluster used for the realtime store redis backend.
    "cluster": "default",
    # Length of the sliding symbolicate_event budgeting window, in seconds.
    #
    # The LPQ selection is computed based on the `SENTRY_LPQ_OPTIONS["project_budget"]`
    # defined below.
    "budget_time_window": 2 * 60,
    # The bucket size of the project budget metric.
    #
    # The size (in seconds) of the buckets that events are sorted into.
    "budget_bucket_size": 10,
    # Number of seconds to wait after a project is made eligible or ineligible for the LPQ
    # before its eligibility can be changed again.
    #
    # This backoff is only applied to automatic changes to project eligibility, and has zero effect
    # on any manually-triggered changes to a project's presence in the LPQ.
    "backoff_timer": 5 * 60,
}

# Tunable knobs for automatic LPQ eligibility.
#
# LPQ eligibility is based on the average spent budget in a sliding time window
# defined in `SENTRY_REALTIME_METRICS_OPTIONS["budget_time_window"]` above.
#
# The `project_budget` option is defined as the average per-second
# "symbolication time budget" a project can spend.
# See `RealtimeMetricsStore.record_project_duration` for an explanation of how
# this works.
# The "regular interval" at which symbolication time is submitted is defined by
# a combination of `SYMBOLICATOR_POLL_TIMEOUT` and `SYMBOLICATOR_MAX_RETRY_AFTER`.
#
# This value is already adjusted according to the
# `symbolicate-event.low-priority.metrics.submission-rate` option.
SENTRY_LPQ_OPTIONS = {
    # This is the per-project budget in per-second "symbolication time budget".
    #
    # This has been arbitrarily chosen as `5.0` for now, which means an average of:
    # -  1x 5-second event per second, or
    # -  5x 1-second events per second, or
    # - 10x 0.5-second events per second
    #
    # Cost increases quadratically with symbolication time.
    "project_budget": 5.0
}

# XXX(meredith): Temporary metrics indexer
SENTRY_METRICS_INDEXER_REDIS_CLUSTER = "default"

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

# A set of extra tasks to sample
ADDITIONAL_SAMPLED_TASKS = {}

# This controls whether Sentry is run in a demo mode.
# Enabling this will allow users to create accounts without an email or password.
DEMO_MODE = False

# all demo orgs are owned by the user with this email
DEMO_ORG_OWNER_EMAIL = None

# parameters that determine how demo events are generated
DEMO_DATA_GEN_PARAMS = {}

# parameters for an org when quickly generating them synchronously
DEMO_DATA_QUICK_GEN_PARAMS = {}

# adds an extra JS to HTML template
INJECTED_SCRIPT_ASSETS = []

# Whether badly behaving projects will be automatically
# sent to the low priority queue
SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE = False

PG_VERSION = os.getenv("PG_VERSION") or "14"

# Zero Downtime Migrations settings as defined at
# https://github.com/tbicr/django-pg-zero-downtime-migrations#settings
ZERO_DOWNTIME_MIGRATIONS_RAISE_FOR_UNSAFE = True
ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT = None
ZERO_DOWNTIME_MIGRATIONS_STATEMENT_TIMEOUT = None

if int(PG_VERSION.split(".", maxsplit=1)[0]) < 12:
    # In v0.6 of django-pg-zero-downtime-migrations this settings is deprecated for PostreSQLv12+
    # https://github.com/tbicr/django-pg-zero-downtime-migrations/blob/7b3f5c045b40e656772859af4206acf3f11c0951/CHANGES.md#06

    # Note: The docs have this backwards. We set this to False here so that we always add check
    # constraints instead of setting the column to not null.
    ZERO_DOWNTIME_MIGRATIONS_USE_NOT_NULL = False

ANOMALY_DETECTION_URL = "127.0.0.1:9091"
ANOMALY_DETECTION_TIMEOUT = 30

# This is the URL to the profiling service
SENTRY_PROFILING_SERVICE_URL = "http://localhost:8085"

SENTRY_REPLAYS_SERVICE_URL = "http://localhost:8090"


SENTRY_ISSUE_ALERT_HISTORY = "sentry.rules.history.backends.postgres.PostgresRuleHistoryBackend"
SENTRY_ISSUE_ALERT_HISTORY_OPTIONS = {}

# This is useful for testing SSO expiry flows
SENTRY_SSO_EXPIRY_SECONDS = os.environ.get("SENTRY_SSO_EXPIRY_SECONDS", None)

# Set to an iterable of strings matching services so only logs from those services show up
# eg. DEVSERVER_LOGS_ALLOWLIST = {"server", "webpack", "worker"}
DEVSERVER_LOGS_ALLOWLIST = None

LOG_API_ACCESS = not IS_DEV or os.environ.get("SENTRY_LOG_API_ACCESS")

VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON = True
DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL = False

# determines if we enable analytics or not
ENABLE_ANALYTICS = False

MAX_ISSUE_ALERTS_PER_PROJECT = 100
MAX_QUERY_SUBSCRIPTIONS_PER_ORG = 1000

MAX_REDIS_SNOWFLAKE_RETRY_COUNTER = 5

SNOWFLAKE_VERSION_ID = 1
SENTRY_SNOWFLAKE_EPOCH_START = datetime(2022, 8, 8, 0, 0).timestamp()
SENTRY_USE_SNOWFLAKE = False

SENTRY_DEFAULT_LOCKS_BACKEND_OPTIONS = {
    "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
    "options": {"cluster": "default"},
}

SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS = {
    "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
    "options": {"cluster": "default"},
}

# maximum number of projects allowed to query snuba with for the organization_vitals_overview endpoint
ORGANIZATION_VITALS_OVERVIEW_PROJECT_LIMIT = 300


# Default string indexer cache options
SENTRY_STRING_INDEXER_CACHE_OPTIONS = {
    "cache_name": "default",
}
SENTRY_POSTGRES_INDEXER_RETRY_COUNT = 2

SENTRY_FUNCTIONS_PROJECT_NAME = None

SENTRY_FUNCTIONS_REGION = "us-central1"

# Settings related to SiloMode
SILO_MODE = os.environ.get("SENTRY_SILO_MODE", None)
FAIL_ON_UNAVAILABLE_API_CALL = False
DEV_HYBRID_CLOUD_RPC_SENDER = os.environ.get("SENTRY_DEV_HYBRID_CLOUD_RPC_SENDER", None)

DISALLOWED_CUSTOMER_DOMAINS = []

SENTRY_PERFORMANCE_ISSUES_RATE_LIMITER_OPTIONS = {}
SENTRY_PERFORMANCE_ISSUES_REDUCE_NOISE = False

SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS = {}
SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT = 10000

SENTRY_REGION = os.environ.get("SENTRY_REGION", None)
SENTRY_REGION_CONFIG: Union[Iterable[Region], str] = ()

# How long we should wait for a gateway proxy request to return before giving up
GATEWAY_PROXY_TIMEOUT = None

SENTRY_SLICING_LOGICAL_PARTITION_COUNT = 256
# This maps a Sliceable for slicing by name and (lower logical partition, upper physical partition)
# to a given slice. A slice is a set of physical resources in Sentry and Snuba.
#
# For each Sliceable, the range [0, SENTRY_SLICING_LOGICAL_PARTITION_COUNT) must be mapped
# to a slice ID
SENTRY_SLICING_CONFIG: Mapping[str, Mapping[Tuple[int, int], int]] = {}

# Show banners on the login page that are defined in layout.html
SHOW_LOGIN_BANNER = False

# Mapping of (logical topic names, slice id) to physical topic names
# and kafka broker names. The kafka broker names are used to construct
# the broker config from KAFKA_CLUSTERS. This is used for slicing only.
# Example:
# SLICED_KAFKA_TOPICS = {
#   ("KAFKA_SNUBA_GENERIC_METRICS", 0): {
#       "topic": "generic_metrics_0",
#       "cluster": "cluster_1",
#   },
#   ("KAFKA_SNUBA_GENERIC_METRICS", 1): {
#       "topic": "generic_metrics_1",
#       "cluster": "cluster_2",
# }
# And then in KAFKA_CLUSTERS:
# KAFKA_CLUSTERS = {
#   "cluster_1": {
#       "bootstrap.servers": "kafka1:9092",
#   },
#   "cluster_2": {
#       "bootstrap.servers": "kafka2:9092",
#   },
# }
SLICED_KAFKA_TOPICS: Mapping[Tuple[str, int], Mapping[str, Any]] = {}

# Used by silo tests -- when requests pass through decorated endpoints, switch the server silo mode to match that
# decorator.
SINGLE_SERVER_SILO_MODE = False

# Set the URL for signup page that we redirect to for the setup wizard if signup=1 is in the query params
SENTRY_SIGNUP_URL = None

SENTRY_ORGANIZATION_ONBOARDING_TASK = "sentry.onboarding_tasks.backends.organization_onboarding_task.OrganizationOnboardingTaskBackend"

# Temporary allowlist for specially configured organizations to use the direct-storage
# driver.
SENTRY_REPLAYS_STORAGE_ALLOWLIST = []
SENTRY_REPLAYS_DOM_CLICK_SEARCH_ALLOWLIST = []

SENTRY_FEATURE_ADOPTION_CACHE_OPTIONS = {
    "path": "sentry.models.featureadoption.FeatureAdoptionRedisBackend",
    "options": {"cluster": "default"},
}

# Monitor limits to prevent abuse
MAX_MONITORS_PER_ORG = 10000
MAX_ENVIRONMENTS_PER_MONITOR = 1000

# Raise schema validation errors and make the indexer crash (only useful in
# tests)
SENTRY_METRICS_INDEXER_RAISE_VALIDATION_ERRORS = False
