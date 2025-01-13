"""
These settings act as the default (base) settings for the Sentry-provided web-server
"""

from __future__ import annotations

import os
import os.path
import platform
import re
import socket
import sys
import tempfile
from collections.abc import Callable, Mapping, MutableSequence
from datetime import datetime, timedelta
from typing import Any, Final, Union, overload
from urllib.parse import urlparse

import sentry
from sentry.conf.api_pagination_allowlist_do_not_modify import (
    SENTRY_API_PAGINATION_ALLOWLIST_DO_NOT_MODIFY,
)
from sentry.conf.types.celery import SplitQueueSize, SplitQueueTaskRoute
from sentry.conf.types.kafka_definition import ConsumerDefinition, Topic
from sentry.conf.types.logging_config import LoggingConfig
from sentry.conf.types.role_dict import RoleDict
from sentry.conf.types.sdk_config import ServerSdkConfig
from sentry.conf.types.sentry_config import SentryMode
from sentry.conf.types.service_options import ServiceOptions
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.utils import json  # NOQA (used in getsentry config)
from sentry.utils.celery import make_split_task_queues
from sentry.utils.types import Type, type_from_value


def gettext_noop(s: str) -> str:
    return s


socket.setdefaulttimeout(5)


_EnvTypes = Union[str, float, int, list, dict]


@overload
def env(key: str) -> str: ...


@overload
def env(key: str, default: _EnvTypes, type: Type | None = None) -> _EnvTypes: ...


def env(
    key: str,
    default: str | _EnvTypes = "",
    type: Type | None = None,
) -> _EnvTypes:
    """
    Extract an environment variable for use in configuration

    :param key: The environment variable to be extracted.
    :param default: The value to be returned if `key` is not found.
    :param type: The type of the returned object (defaults to the type of `default`).
       Type parsers must come from sentry.utils.types and not python stdlib.
    :return: The environment variable if it exists, else `default`.
    """

    # First check an internal cache, so we can `pop` multiple times
    # without actually losing the value.
    try:
        rv = _env_cache[key]
    except KeyError:
        if "SENTRY_RUNNING_UWSGI" in os.environ:
            # We do this so when the process forks off into uwsgi
            # we want to actually be popping off values. This is so that
            # at runtime, the variables aren't actually available.
            fn: Callable[[str], str] = os.environ.pop
        else:
            fn = os.environ.__getitem__

        try:
            rv = fn(key)
            _env_cache[key] = rv
        except KeyError:
            rv = default

    if type is None:
        type = type_from_value(default)

    return type(rv)


_env_cache: dict[str, object] = {}

ENVIRONMENT = os.environ.get("SENTRY_ENVIRONMENT", "production")

IS_DEV = ENVIRONMENT == "development"

DEBUG = IS_DEV
# override the settings dumped in the debug view
DEFAULT_EXCEPTION_REPORTER_FILTER = (
    "sentry.debug.utils.exception_reporter_filter.NoSettingsExceptionReporterFilter"
)

ENFORCE_PAGINATION = True if DEBUG else False

ADMINS = ()

# Hosts that are considered in the same network (including VPNs).
INTERNAL_IPS = ()

# List of IP subnets which should not be accessible
SENTRY_DISALLOWED_IPS = ()

# When resolving DNS for external sources (source map fetching, webhooks, etc),
# ensure that domains are fully resolved first to avoid poking internal
# search domains.
SENTRY_ENSURE_FQDN = False

# XXX [!!]: When adding a new key here BE SURE to configure it in getsentry, as
#           it can not be `default`. The default cluster in sentry.io
#           production is NOT a true redis cluster and WILL error in prod.
SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER = "default"
SENTRY_INCIDENT_RULES_REDIS_CLUSTER = "default"
SENTRY_RATE_LIMIT_REDIS_CLUSTER = "default"
SENTRY_RULE_TASK_REDIS_CLUSTER = "default"
SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER = "default"
SENTRY_WEBHOOK_LOG_REDIS_CLUSTER = "default"
SENTRY_ARTIFACT_BUNDLES_INDEXING_REDIS_CLUSTER = "default"
SENTRY_INTEGRATION_ERROR_LOG_REDIS_CLUSTER = "default"
SENTRY_DEBUG_FILES_REDIS_CLUSTER = "default"
SENTRY_MONITORS_REDIS_CLUSTER = "default"
SENTRY_STATISTICAL_DETECTORS_REDIS_CLUSTER = "default"
SENTRY_METRIC_META_REDIS_CLUSTER = "default"
SENTRY_ESCALATION_THRESHOLDS_REDIS_CLUSTER = "default"
SENTRY_SPAN_BUFFER_CLUSTER = "default"
SENTRY_ASSEMBLE_CLUSTER = "default"
SENTRY_UPTIME_DETECTOR_CLUSTER = "default"
SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER = "default"

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


# This should always be UTC.
TIME_ZONE = "UTC"

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = "en-us"

LANGUAGES: tuple[tuple[str, str], ...] = (
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

USE_TZ = True

# CAVEAT: If you're adding a middleware that modifies a response's content,
# and appears before CommonMiddleware, you must either reorder your middleware
# so that responses aren't modified after Content-Length is set, or have the
# response modifying middleware reset the Content-Length header.
# This is because CommonMiddleware Sets the Content-Length header for non-streaming responses.
MIDDLEWARE: tuple[str, ...] = (
    "csp.middleware.CSPMiddleware",
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
    "sentry.hybridcloud.apigateway.middleware.ApiGatewayMiddleware",
    "sentry.middleware.customer_domain.CustomerDomainMiddleware",
    "sentry.middleware.sudo.SudoMiddleware",
    "sentry.middleware.superuser.SuperuserMiddleware",
    "sentry.middleware.staff.StaffMiddleware",
    "sentry.middleware.locale.SentryLocaleMiddleware",
    "sentry.middleware.ratelimit.RatelimitMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "sentry.middleware.devtoolbar.DevToolbarAnalyticsMiddleware",
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

SENTRY_OUTBOX_MODELS: Mapping[str, list[str]] = {
    "CONTROL": ["sentry.ControlOutbox"],
    "REGION": ["sentry.RegionOutbox"],
}

# Do not modify reordering
# The applications listed first in INSTALLED_APPS have precedence
INSTALLED_APPS: tuple[str, ...] = (
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.humanize",
    "django.contrib.messages",
    "django.contrib.postgres",
    "django.contrib.sessions",
    "django.contrib.sites",
    "drf_spectacular",
    "crispy_forms",
    "rest_framework",
    "sentry",
    "sentry.analytics",
    "sentry.incidents.apps.Config",
    "sentry.deletions",
    "sentry.discover",
    "sentry.analytics.events",
    "sentry.nodestore",
    "sentry.users",
    "sentry.sentry_apps",
    "sentry.integrations",
    "sentry.notifications",
    "sentry.flags",
    "sentry.monitors",
    "sentry.uptime",
    "sentry.tempest",
    "sentry.replays",
    "sentry.release_health",
    "sentry.search",
    "sentry.sentry_metrics",
    "sentry.sentry_metrics.indexer.postgres.apps.Config",
    "sentry.snuba",
    "sentry.lang.java.apps.Config",
    "sentry.lang.javascript.apps.Config",
    "sentry.plugins.sentry_interface_types.apps.Config",
    "sentry.plugins.sentry_urls.apps.Config",
    "sentry.plugins.sentry_useragents.apps.Config",
    "sentry.plugins.sentry_webhooks.apps.Config",
    "social_auth",
    "sudo",
    "sentry.eventstream",
    "sentry.auth.providers.google.apps.Config",
    "sentry.auth.providers.fly.apps.Config",
    "django.contrib.staticfiles",
    "sentry.issues.apps.Config",
    "sentry.feedback",
    "sentry.hybridcloud",
    "sentry.remote_subscriptions.apps.Config",
    "sentry.data_secrecy",
    "sentry.workflow_engine",
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
    "*.algolia.net",
    "*.algolianet.com",
    "*.algolia.io",
]
CSP_FRAME_ANCESTORS = [
    "'none'",
]
CSP_OBJECT_SRC = [
    "'none'",
]
CSP_WORKER_SRC = [
    "'none'",
]
CSP_BASE_URI = [
    "'none'",
]
CSP_STYLE_SRC = [
    "'unsafe-inline'",
    "*",  # required for replays
]
CSP_IMG_SRC = [
    "blob:",
    "data:",
    "*",  # required for replays
]
CSP_MEDIA_SRC = [
    "*",  # required for replays
]

if ENVIRONMENT == "development":
    CSP_SCRIPT_SRC += [
        "'unsafe-eval'",
    ]
    CSP_CONNECT_SRC += [
        "ws://127.0.0.1:8000",
        "http://localhost:8969/stream",
        "webpack-internal:",
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

# URL origin from where the static files are served.
STATIC_ORIGIN = None

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

AUTH_PASSWORD_VALIDATORS: list[dict[str, Any]] = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
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
    {
        "NAME": "sentry.auth.password_validation.PwnedPasswordsValidator",
        "OPTIONS": {"threshold": 20},
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


def SOCIAL_AUTH_DEFAULT_USERNAME() -> str:
    return random.choice(["Darth Vader", "Obi-Wan Kenobi", "R2-D2", "C-3PO", "Yoda"])


SOCIAL_AUTH_PROTECTED_USER_FIELDS = ["email"]
SOCIAL_AUTH_FORCE_POST_DISCONNECT = True

# Hybrid cloud multi-silo configuration #

# Defined by `sentry devserver` to enable siloed local development
SILO_DEVSERVER = os.environ.get("SENTRY_SILO_DEVSERVER", False)

# Which silo this instance runs as (CONTROL|REGION|MONOLITH|None) are the expected values
SILO_MODE = os.environ.get("SENTRY_SILO_MODE", None)

# This supersedes SENTRY_SINGLE_TENANT and SENTRY_SELF_HOSTED.
# An enum is better because there shouldn't be multiple "modes".
SENTRY_MODE = SentryMode.SELF_HOSTED

# If this instance is a region silo, which region is it running in?
SENTRY_REGION = os.environ.get("SENTRY_REGION", None)

# Returns the customer single tenant ID.
CUSTOMER_ID = os.environ.get("CUSTOMER_ID", None)

# List of the available regions, or a JSON string
# that is parsed.
SENTRY_REGION_CONFIG: Any = ()

# Shared secret used to sign cross-region RPC requests.
RPC_SHARED_SECRET: list[str] | None = None

# Timeout for RPC requests between regions
RPC_TIMEOUT = 5.0

# TODO: Replace both of these secrets with mutual TLS and simplify our rpc channels.
# Shared secret used to sign cross-region RPC requests from the seer microservice.
SEER_RPC_SHARED_SECRET: list[str] | None = None
# Shared secret used to sign cross-region RPC requests to the seer microservice.
SEER_API_SHARED_SECRET: str = ""

# The protocol, host and port for control silo
# Usecases include sending requests to the Integration Proxy Endpoint and RPC requests.
SENTRY_CONTROL_ADDRESS: str | None = os.environ.get("SENTRY_CONTROL_ADDRESS", None)

# Fallback region name for monolith deployments
# This region name is also used by the ApiGateway to proxy org-less region
# requests.
SENTRY_MONOLITH_REGION: str = "--monolith--"

# The key used for generating or verifying the HMAC signature for Integration Proxy Endpoint requests.
SENTRY_SUBNET_SECRET = os.environ.get("SENTRY_SUBNET_SECRET", None)


# Queue configuration
from kombu import Exchange, Queue

BROKER_URL = "redis://127.0.0.1:6379"
BROKER_TRANSPORT_OPTIONS: dict[str, int] = {}

# Ensure workers run async by default
# in Development you might want them to run in-process
TASK_WORKER_ALWAYS_EAGER = False

# Ensure workers run async by default
# in Development you might want them to run in-process
# though it would cause timeouts/recursions in some cases
CELERY_ALWAYS_EAGER = False

# Complain about bad use of pickle.  See sentry.celery.SentryTask.apply_async for how
# this works.
CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE = False

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
    "sentry.deletions.tasks.groups",
    "sentry.deletions.tasks.scheduled",
    "sentry.deletions.tasks.hybrid_cloud",
    "sentry.hybridcloud.tasks.deliver_webhooks",
    "sentry.hybridcloud.tasks.backfill_outboxes",
    "sentry.hybridcloud.tasks.deliver_from_outbox",
    "sentry.incidents.tasks",
    "sentry.integrations.github.tasks",
    "sentry.integrations.github.tasks.pr_comment",
    "sentry.integrations.jira.tasks",
    "sentry.integrations.opsgenie.tasks",
    "sentry.sentry_apps.tasks",
    "sentry.snuba.tasks",
    "sentry.replays.tasks",
    "sentry.monitors.tasks.clock_pulse",
    "sentry.monitors.tasks.detect_broken_monitor_envs",
    "sentry.tasks.assemble",
    "sentry.tasks.auth",
    "sentry.tasks.auto_remove_inbox",
    "sentry.tasks.auto_resolve_issues",
    "sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project",
    "sentry.tasks.beacon",
    "sentry.tasks.check_auth",
    "sentry.tasks.check_new_issue_threshold_met",
    "sentry.tasks.clear_expired_snoozes",
    "sentry.tasks.clear_expired_rulesnoozes",
    "sentry.tasks.codeowners.code_owners_auto_sync",
    "sentry.tasks.codeowners.update_code_owners_schema",
    "sentry.tasks.collect_project_platforms",
    "sentry.tasks.commits",
    "sentry.tasks.commit_context",
    "sentry.tasks.digests",
    "sentry.tasks.email",
    "sentry.tasks.files",
    "sentry.tasks.groupowner",
    "sentry.tasks.merge",
    "sentry.tasks.options",
    "sentry.tasks.ping",
    "sentry.tasks.post_process",
    "sentry.tasks.process_buffer",
    "sentry.tasks.relay",
    "sentry.tasks.release_registry",
    "sentry.tasks.relocation",
    "sentry.tasks.summaries.weekly_reports",
    "sentry.tasks.summaries.daily_summary",
    "sentry.tasks.reprocessing2",
    "sentry.tasks.servicehooks",
    "sentry.tasks.store",
    "sentry.tasks.symbolication",
    "sentry.tasks.unmerge",
    "sentry.tasks.update_user_reports",
    "sentry.tasks.user_report",
    "sentry.profiles.task",
    "sentry.release_health.tasks",
    "sentry.rules.processing.delayed_processing",
    "sentry.dynamic_sampling.tasks.boost_low_volume_projects",
    "sentry.dynamic_sampling.tasks.boost_low_volume_transactions",
    "sentry.dynamic_sampling.tasks.recalibrate_orgs",
    "sentry.dynamic_sampling.tasks.sliding_window_org",
    "sentry.dynamic_sampling.tasks.utils",
    "sentry.dynamic_sampling.tasks.custom_rule_notifications",
    "sentry.tasks.auto_source_code_configs",
    "sentry.ingest.transaction_clusterer.tasks",
    "sentry.tasks.auto_enable_codecov",
    "sentry.tasks.weekly_escalating_forecast",
    "sentry.tasks.auto_ongoing_issues",
    "sentry.tasks.check_am2_compatibility",
    "sentry.tasks.statistical_detectors",
    "sentry.debug_files.tasks",
    "sentry.tasks.on_demand_metrics",
    "sentry.middleware.integrations.tasks",
    "sentry.replays.usecases.ingest.issue_creation",
    "sentry.integrations.slack.tasks",
    "sentry.uptime.detectors.tasks",
    "sentry.uptime.subscriptions.tasks",
    "sentry.integrations.vsts.tasks",
    "sentry.integrations.vsts.tasks.kickoff_subscription_check",
    "sentry.integrations.tasks",
)

# Enable split queue routing
CELERY_ROUTES = ("sentry.queue.routers.SplitQueueTaskRouter",)

# Mapping from task names to split queues. This can be used when the
# task does not have to specify the queue and can rely on Celery to
# do the routing.
# Each route has a task name as key and a tuple containing a list of queues
# and a default one as destination. The default one is used when the
# rollout option is not active.
CELERY_SPLIT_QUEUE_TASK_ROUTES_REGION: Mapping[str, SplitQueueTaskRoute] = {
    "sentry.tasks.store.save_event_transaction": {
        "default_queue": "events.save_event_transaction",
        "queues_config": {
            "total": 3,
            "in_use": 3,
        },
    },
    "sentry.profiles.task.process_profile": {
        "default_queue": "profiles.process",
        "queues_config": {
            "total": 3,
            "in_use": 3,
        },
    },
}
CELERY_SPLIT_TASK_QUEUES_REGION = make_split_task_queues(CELERY_SPLIT_QUEUE_TASK_ROUTES_REGION)

# Mapping from queue name to split queues to be used by SplitQueueRouter.
# This is meant to be used in those case where we have to specify the
# queue name when issuing a task. Example: post process.
CELERY_SPLIT_QUEUE_ROUTES: Mapping[str, SplitQueueSize] = {}

default_exchange = Exchange("default", type="direct")
control_exchange = default_exchange

if SILO_DEVSERVER:
    control_exchange = Exchange("control", type="direct")


CELERY_QUEUES_CONTROL = [
    Queue("app_platform.control", routing_key="app_platform.control", exchange=control_exchange),
    Queue("auth.control", routing_key="auth.control", exchange=control_exchange),
    Queue("cleanup.control", routing_key="cleanup.control", exchange=control_exchange),
    Queue("email.control", routing_key="email.control", exchange=control_exchange),
    Queue("integrations.control", routing_key="integrations.control", exchange=control_exchange),
    Queue("files.delete.control", routing_key="files.delete.control", exchange=control_exchange),
    Queue(
        "hybrid_cloud.control_repair",
        routing_key="hybrid_cloud.control_repair",
        exchange=control_exchange,
    ),
    Queue("options.control", routing_key="options.control", exchange=control_exchange),
    Queue("outbox.control", routing_key="outbox.control", exchange=control_exchange),
    Queue("webhook.control", routing_key="webhook.control", exchange=control_exchange),
]

CELERY_ISSUE_STATES_QUEUE = Queue(
    "auto_transition_issue_states", routing_key="auto_transition_issue_states"
)

CELERY_QUEUES_REGION = [
    Queue("activity.notify", routing_key="activity.notify"),
    Queue("auth", routing_key="auth"),
    Queue("alerts", routing_key="alerts"),
    Queue("app_platform", routing_key="app_platform"),
    Queue("assemble", routing_key="assemble"),
    Queue("backfill_seer_grouping_records", routing_key="backfill_seer_grouping_records"),
    Queue("buffers.process_pending", routing_key="buffers.process_pending"),
    Queue("buffers.process_pending_batch", routing_key="buffers.process_pending_batch"),
    Queue("buffers.incr", routing_key="buffers.incr"),
    Queue("cleanup", routing_key="cleanup"),
    Queue("code_owners", routing_key="code_owners"),
    Queue("commits", routing_key="commits"),
    Queue("data_export", routing_key="data_export"),
    Queue("default", routing_key="default"),
    Queue("delayed_rules", routing_key="delayed_rules"),
    Queue(
        "delete_seer_grouping_records_by_hash", routing_key="delete_seer_grouping_records_by_hash"
    ),
    Queue("digests.delivery", routing_key="digests.delivery"),
    Queue("digests.scheduling", routing_key="digests.scheduling"),
    Queue("email", routing_key="email"),
    Queue("email.inbound", routing_key="email.inbound"),
    Queue("events.preprocess_event", routing_key="events.preprocess_event"),
    Queue("events.process_event", routing_key="events.process_event"),
    Queue(
        "events.reprocessing.preprocess_event", routing_key="events.reprocessing.preprocess_event"
    ),
    Queue("events.reprocessing.process_event", routing_key="events.reprocessing.process_event"),
    Queue(
        "events.reprocessing.symbolicate_event", routing_key="events.reprocessing.symbolicate_event"
    ),
    Queue("events.save_event", routing_key="events.save_event"),
    Queue("events.save_event_highcpu", routing_key="events.save_event_highcpu"),
    Queue("events.save_event_transaction", routing_key="events.save_event_transaction"),
    Queue("events.save_event_attachments", routing_key="events.save_event_attachments"),
    Queue("events.symbolicate_event", routing_key="events.symbolicate_event"),
    Queue("events.symbolicate_js_event", routing_key="events.symbolicate_js_event"),
    Queue("events.symbolicate_jvm_event", routing_key="events.symbolicate_jvm_event"),
    Queue("files.copy", routing_key="files.copy"),
    Queue("files.delete", routing_key="files.delete"),
    Queue(
        "group_owners.process_suspect_commits", routing_key="group_owners.process_suspect_commits"
    ),
    Queue("group_owners.process_commit_context", routing_key="group_owners.process_commit_context"),
    Queue("integrations", routing_key="integrations"),
    Queue(
        "releasemonitor",
        routing_key="releasemonitor",
    ),
    Queue(
        "dynamicsampling",
        routing_key="dynamicsampling",
    ),
    Queue("tempest", routing_key="tempest"),
    Queue("incidents", routing_key="incidents"),
    Queue("incident_snapshots", routing_key="incident_snapshots"),
    Queue("incidents", routing_key="incidents"),
    Queue("merge", routing_key="merge"),
    Queue("notifications", routing_key="notifications"),
    Queue("options", routing_key="options"),
    Queue("outbox", routing_key="outbox"),
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
    Queue("unmerge", routing_key="unmerge"),
    Queue("update", routing_key="update"),
    Queue("uptime", routing_key="uptime"),
    Queue("profiles.process", routing_key="profiles.process"),
    Queue("replays.ingest_replay", routing_key="replays.ingest_replay"),
    Queue("replays.delete_replay", routing_key="replays.delete_replay"),
    Queue("counters-0", routing_key="counters-0"),
    Queue("triggers-0", routing_key="triggers-0"),
    # XXX: To be renamed to auto_source_code_configs
    Queue("derive_code_mappings", routing_key="derive_code_mappings"),
    Queue("transactions.name_clusterer", routing_key="transactions.name_clusterer"),
    Queue("auto_enable_codecov", routing_key="auto_enable_codecov"),
    Queue("weekly_escalating_forecast", routing_key="weekly_escalating_forecast"),
    Queue("relocation", routing_key="relocation"),
    Queue("performance.statistical_detector", routing_key="performance.statistical_detector"),
    Queue("profiling.statistical_detector", routing_key="profiling.statistical_detector"),
    CELERY_ISSUE_STATES_QUEUE,
    Queue("nudge.invite_missing_org_members", routing_key="invite_missing_org_members"),
    Queue("auto_resolve_issues", routing_key="auto_resolve_issues"),
    Queue("on_demand_metrics", routing_key="on_demand_metrics"),
    Queue("check_new_issue_threshold_met", routing_key="check_new_issue_threshold_met"),
    Queue("integrations_slack_activity_notify", routing_key="integrations_slack_activity_notify"),
]

from celery.schedules import crontab

# Only tasks that work with users/integrations and shared subsystems
# are run in control silo.
CELERYBEAT_SCHEDULE_CONTROL = {
    "check-auth": {
        "task": "sentry.tasks.check_auth",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60, "queue": "auth.control"},
    },
    "sync-options-control": {
        "task": "sentry.tasks.options.sync_options_control",
        # Run every 10 seconds
        "schedule": timedelta(seconds=10),
        "options": {"expires": 10, "queue": "options.control"},
    },
    "deliver-from-outbox-control": {
        "task": "sentry.tasks.enqueue_outbox_jobs_control",
        # Run every 10 seconds to keep consistency times low
        "schedule": timedelta(seconds=10),
        "options": {"expires": 60, "queue": "outbox.control"},
    },
    "schedule-deletions-control": {
        "task": "sentry.deletions.tasks.run_scheduled_deletions_control",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25, "queue": "cleanup.control"},
    },
    "reattempt-deletions-control": {
        "task": "sentry.deletions.tasks.reattempt_deletions_control",
        # 03:00 PDT, 07:00 EDT, 10:00 UTC
        "schedule": crontab(hour="10", minute="0"),
        "options": {"expires": 60 * 25, "queue": "cleanup.control"},
    },
    "schedule-hybrid-cloud-foreign-key-jobs-control": {
        "task": "sentry.deletions.tasks.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs_control",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "cleanup.control"},
    },
    "schedule-vsts-integration-subscription-check": {
        "task": "sentry.integrations.vsts.tasks.kickoff_vsts_subscription_check",
        # Run every 6 hours
        "schedule": crontab(hour="*/6"),
        "options": {"expires": 60 * 25, "queue": "integrations.control"},
    },
    "deliver-webhooks-control": {
        "task": "sentry.hybridcloud.tasks.deliver_webhooks.schedule_webhook_delivery",
        # Run every 10 seconds as integration webhooks are delivered by this task
        "schedule": timedelta(seconds=10),
        "options": {"expires": 60, "queue": "webhook.control"},
    },
}

# Most tasks run in the regions
CELERYBEAT_SCHEDULE_REGION = {
    "send-beacon": {
        "task": "sentry.tasks.send_beacon",
        # Run every 1 hour
        "schedule": crontab(minute="0", hour="*/1"),
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
        # Run every 10 seconds
        "schedule": timedelta(seconds=10),
        "options": {"expires": 10, "queue": "buffers.process_pending"},
    },
    "flush-buffers-batch": {
        "task": "sentry.tasks.process_buffer.process_pending_batch",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 10, "queue": "buffers.process_pending_batch"},
    },
    "sync-options": {
        "task": "sentry.tasks.options.sync_options",
        # Run every 10 seconds
        "schedule": timedelta(seconds=10),
        "options": {"expires": 10, "queue": "options"},
    },
    "schedule-digests": {
        "task": "sentry.tasks.digests.schedule_digests",
        # Run every 30 seconds
        "schedule": timedelta(seconds=30),
        "options": {"expires": 30},
    },
    "monitors-clock-pulse": {
        "task": "sentry.monitors.tasks.clock_pulse",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60},
    },
    "monitors-detect-broken-monitor-envs": {
        "task": "sentry.monitors.tasks.detect_broken_monitor_envs",
        # 8:00 PDT, 11:00 EDT, 15:00 UTC
        "schedule": crontab(minute="0", hour="15", day_of_week="mon-fri"),
        "options": {"expires": 15 * 60},
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
    "collect-project-platforms": {
        "task": "sentry.tasks.collect_project_platforms",
        # 19:00 PDT, 22:00 EDT, 3:00 UTC
        "schedule": crontab(hour="3"),
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
        "schedule": crontab(minute="*/10"),
        "options": {"expires": 60 * 25},
    },
    "auto-remove-inbox": {
        "task": "sentry.tasks.auto_remove_inbox",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25},
    },
    "schedule-deletions": {
        "task": "sentry.deletions.tasks.run_scheduled_deletions",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
        "options": {"expires": 60 * 25},
    },
    "reattempt-deletions": {
        "task": "sentry.deletions.tasks.reattempt_deletions",
        # 03:00 PDT, 07:00 EDT, 10:00 UTC
        "schedule": crontab(hour="10", minute="0"),
        "options": {"expires": 60 * 25},
    },
    "schedule-weekly-organization-reports-new": {
        "task": "sentry.tasks.summaries.weekly_reports.schedule_organizations",
        # 05:00 PDT, 09:00 EDT, 12:00 UTC
        "schedule": crontab(minute="0", hour="12", day_of_week="sat"),
        "options": {"expires": 60 * 60 * 3},
    },
    "schedule-hybrid-cloud-foreign-key-jobs": {
        "task": "sentry.deletions.tasks.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs",
        # Run every 15 minutes
        "schedule": crontab(minute="*/15"),
    },
    "monitor-release-adoption": {
        "task": "sentry.release_health.tasks.monitor_release_adoption",
        # Run every 1 hour
        "schedule": crontab(minute="0"),
        "options": {"expires": 3600, "queue": "releasemonitor"},
    },
    "fetch-release-registry-data": {
        "task": "sentry.tasks.release_registry.fetch_release_registry_data",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 3600},
    },
    "snuba-subscription-checker": {
        "task": "sentry.snuba.tasks.subscription_checker",
        # Run every 20 minutes
        "schedule": crontab(minute="*/20"),
        "options": {"expires": 20 * 60},
    },
    "uptime-subscription-checker": {
        "task": "sentry.uptime.tasks.subscription_checker",
        "schedule": crontab(minute="*/10"),
        "options": {"expires": 10 * 60},
    },
    "transaction-name-clusterer": {
        "task": "sentry.ingest.transaction_clusterer.tasks.spawn_clusterers",
        # Run every 1 hour at minute 17
        "schedule": crontab(minute="17"),
        "options": {"expires": 3600},
    },
    "auto-enable-codecov": {
        "task": "sentry.tasks.auto_enable_codecov.enable_for_org",
        # Run every day at 00:30
        "schedule": crontab(minute="30", hour="0"),
        "options": {"expires": 3600},
    },
    "dynamic-sampling-boost-low-volume-projects": {
        "task": "sentry.dynamic_sampling.tasks.boost_low_volume_projects",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "dynamic-sampling-boost-low-volume-transactions": {
        "task": "sentry.dynamic_sampling.tasks.boost_low_volume_transactions",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "dynamic-sampling-recalibrate-orgs": {
        "task": "sentry.dynamic_sampling.tasks.recalibrate_orgs",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "dynamic-sampling-sliding-window-org": {
        "task": "sentry.dynamic_sampling.tasks.sliding_window_org",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "custom_rule_notifications": {
        "task": "sentry.dynamic_sampling.tasks.custom_rule_notifications",
        # Run every 10 minutes
        "schedule": crontab(minute="*/10"),
    },
    "clean_custom_rule_notifications": {
        "task": "sentry.dynamic_sampling.tasks.clean_custom_rule_notifications",
        # Run every 7 minutes
        "schedule": crontab(minute="*/7"),
    },
    "weekly-escalating-forecast": {
        "task": "sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
        # Run once a day at 00:00
        "schedule": crontab(minute="0", hour="0"),
        "options": {"expires": 60 * 60 * 3},
    },
    "schedule_auto_transition_to_ongoing": {
        "task": "sentry.tasks.schedule_auto_transition_to_ongoing",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 3600},
    },
    "github_comment_reactions": {
        "task": "sentry.integrations.github.tasks.github_comment_reactions",
        # 9:00 PDT, 12:00 EDT, 16:00 UTC
        "schedule": crontab(minute="0", hour="16"),
    },
    "statistical-detectors-detect-regressions": {
        "task": "sentry.tasks.statistical_detectors.run_detection",
        # Run every 1 hour
        "schedule": crontab(minute="0", hour="*/1"),
    },
    "refresh-artifact-bundles-in-use": {
        "task": "sentry.debug_files.tasks.refresh_artifact_bundles_in_use",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
        "options": {"expires": 60},
    },
    "on-demand-metrics-schedule-on-demand-check": {
        "task": "sentry.tasks.on_demand_metrics.schedule_on_demand_check",
        # Run every 5 minutes
        "schedule": crontab(minute="*/5"),
    },
    "uptime-detection-scheduler": {
        "task": "sentry.uptime.detectors.tasks.schedule_detections",
        # Run every 1 minute
        "schedule": crontab(minute="*/1"),
    },
}

# Assign the configuration keys celery uses based on our silo mode.
if SILO_MODE == "CONTROL":
    CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), "sentry-celerybeat-control")
    CELERYBEAT_SCHEDULE = CELERYBEAT_SCHEDULE_CONTROL
    CELERY_QUEUES = CELERY_QUEUES_CONTROL
    CELERY_SPLIT_QUEUE_TASK_ROUTES: Mapping[str, SplitQueueTaskRoute] = {}

elif SILO_MODE == "REGION":
    CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), "sentry-celerybeat-region")
    CELERYBEAT_SCHEDULE = CELERYBEAT_SCHEDULE_REGION
    CELERY_QUEUES = CELERY_QUEUES_REGION + CELERY_SPLIT_TASK_QUEUES_REGION
    CELERY_SPLIT_QUEUE_TASK_ROUTES = CELERY_SPLIT_QUEUE_TASK_ROUTES_REGION

else:
    CELERYBEAT_SCHEDULE = {**CELERYBEAT_SCHEDULE_CONTROL, **CELERYBEAT_SCHEDULE_REGION}
    CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), "sentry-celerybeat")
    CELERY_QUEUES = CELERY_QUEUES_REGION + CELERY_QUEUES_CONTROL + CELERY_SPLIT_TASK_QUEUES_REGION
    CELERY_SPLIT_QUEUE_TASK_ROUTES = CELERY_SPLIT_QUEUE_TASK_ROUTES_REGION

for queue in CELERY_QUEUES:
    queue.durable = False

# set celery max durations for tasks
CELERY_TASK_SOFT_TIME_LIMIT = int(timedelta(hours=3).total_seconds())
CELERY_TASK_TIME_LIMIT = int(timedelta(hours=3, seconds=15).total_seconds())

# Queues that belong to the processing pipeline and need to be monitored
# for backpressure management
PROCESSING_QUEUES = [
    "events.preprocess_event",
    "events.process_event",
    "events.process_event_proguard",
    "events.reprocessing.preprocess_event",
    "events.reprocessing.process_event",
    "events.reprocessing.symbolicate_event",
    "events.save_event",
    "events.save_event_highcpu",
    "events.save_event_attachments",
    "events.save_event_transaction",
    "events.symbolicate_event",
    "events.symbolicate_js_event",
    "post_process_errors",
    "post_process_issue_platform",
    "post_process_transactions",
    "profiles.process",
]

# We prefer using crontab, as the time for timedelta will reset on each deployment. More information:  https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html#periodic-tasks
TIMEDELTA_ALLOW_LIST = {
    "deliver-from-outbox-control",
    "deliver-webhooks-control",
    "flush-buffers",
    "sync-options",
    "sync-options-control",
    "schedule-digests",
}

BGTASKS = {
    "sentry.bgtasks.clean_dsymcache:clean_dsymcache": {"interval": 5 * 60, "roles": ["worker"]},
    "sentry.bgtasks.clean_releasefilecache:clean_releasefilecache": {
        "interval": 5 * 60,
        "roles": ["worker"],
    },
}

# Taskworker settings #
# The list of modules that workers will import after starting up
# Like celery, taskworkers need to import task modules to make tasks
# accessible to the worker.
TASKWORKER_IMPORTS: tuple[str, ...] = (
    # Used for tests
    "sentry.taskworker.tasks.examples",
)
TASKWORKER_ROUTER: str = "sentry.taskworker.router.DefaultRouter"
TASKWORKER_ROUTES: dict[str, str] = {}

# Sentry logs to two major places: stdout, and its internal project.
# To disable logging to the internal project, add a logger whose only
# handler is 'console' and disable propagating upwards.
# Additionally, Sentry has the ability to override logger levels by
# providing the cli with -l/--loglevel or the SENTRY_LOG_LEVEL env var.
# The loggers that it overrides are root and any in LOGGING.overridable.
# Be very careful with this in a production system, because the celery
# logger can be extremely verbose when given INFO or DEBUG.
LOGGING: LoggingConfig = {
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
        "sentry.profiles": {"level": "INFO"},
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


def custom_parameter_sort(parameter: dict) -> tuple[str, int]:
    """
    Sort parameters by type then if the parameter is required or not.
    It should group path parameters first, then query parameters.
    In each group, required parameters should come before optional parameters.
    """
    param_type = parameter["in"]
    required = parameter.get("required", False)
    return param_type, 0 if required else 1


if os.environ.get("OPENAPIGENERATE", False):
    OLD_OPENAPI_JSON_PATH = "tests/apidocs/openapi-deprecated.json"
    from sentry.apidocs.build import OPENAPI_TAGS, get_old_json_components, get_old_json_paths

    SPECTACULAR_SETTINGS = {
        "APPEND_COMPONENTS": get_old_json_components(OLD_OPENAPI_JSON_PATH),
        "APPEND_PATHS": get_old_json_paths(OLD_OPENAPI_JSON_PATH),
        "AUTHENTICATION_WHITELIST": ["sentry.api.authentication.UserAuthTokenAuthentication"],
        "COMPONENT_SPLIT_PATCH": False,
        "COMPONENT_SPLIT_REQUEST": False,
        "CONTACT": {"email": "partners@sentry.io"},
        "DEFAULT_GENERATOR_CLASS": "sentry.apidocs.hooks.CustomGenerator",
        "DESCRIPTION": "Sentry Public API",
        "DISABLE_ERRORS_AND_WARNINGS": False,
        # We override the default behavior to skip adding the choice name to the bullet point if
        # it's identical to the choice value by monkey patching build_choice_description_list.
        "ENUM_GENERATE_CHOICE_DESCRIPTION": True,
        "LICENSE": {"name": "Apache 2.0", "url": "http://www.apache.org/licenses/LICENSE-2.0.html"},
        "PARSER_WHITELIST": ["rest_framework.parsers.JSONParser"],
        "POSTPROCESSING_HOOKS": ["sentry.apidocs.hooks.custom_postprocessing_hook"],
        "PREPROCESSING_HOOKS": ["sentry.apidocs.hooks.custom_preprocessing_hook"],
        "SERVERS": [
            {
                "url": "https://{region}.sentry.io",
                "variables": {
                    "region": {
                        "default": "us",
                        "description": "The data-storage-location for an organization",
                        "enum": ["us", "de"],
                    },
                },
            },
        ],
        "SORT_OPERATION_PARAMETERS": custom_parameter_sort,
        "TAGS": OPENAPI_TAGS,
        "TITLE": "API Reference",
        "TOS": "http://sentry.io/terms/",
        "VERSION": "v0",
    }

CRISPY_TEMPLATE_PACK = "bootstrap3"

# Sentry and internal client configuration

SENTRY_EARLY_FEATURES = {
    "organizations:anr-analyze-frames": "Enable anr frame analysis",
    "organizations:device-classification": "Enable device.class as a selectable column",
    "organizations:gitlab-disable-on-broken": "Enable disabling gitlab integrations when broken is detected",
    "organizations:mobile-cpu-memory-in-transactions": "Display CPU and memory metrics in transactions with profiles",
    "organizations:performance-metrics-backed-transaction-summary": "Enable metrics-backed transaction summary view",
    "organizations:performance-new-trends": "Enable new trends",
    "organizations:performance-new-widget-designs": "Enable updated landing page widget designs",
    "organizations:performance-span-histogram-view": "Enable histogram view in span details",
    "organizations:performance-transaction-name-only-search-indexed": "Enable transaction name only search on indexed",
    "organizations:profiling-global-suspect-functions": "Enable global suspect functions in profiling",
    "organizations:user-feedback-ui": "Enable User Feedback v2 UI",
}

# NOTE: Features can have their default value set when calling
# `features.manager.add()`. Defining feature defaults here is deprecated.
# If you must add a feature here, please maintain alphabetical ordering
SENTRY_FEATURES: dict[str, bool | None] = {
    # NOTE: Don't add feature defaults down here! Please add a default to
    # the manager.add() call that defines the feature.
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
SENTRY_LOGIN_URL: str | None = None

# Default project ID (for internal errors)
SENTRY_PROJECT = 1
SENTRY_PROJECT_KEY: int | None = None

# Default organization to represent the Internal Sentry project.
# Used as a default when in SINGLE_ORGANIZATION mode.
SENTRY_ORGANIZATION: int | None = None

# Project ID for recording frontend (javascript) exceptions
SENTRY_FRONTEND_PROJECT: int | None = None
# DSN for the frontend to use explicitly, which takes priority
# over SENTRY_FRONTEND_PROJECT or SENTRY_PROJECT
SENTRY_FRONTEND_DSN: str | None = None
# DSN for tracking all client HTTP requests (which can be noisy) [experimental]
SENTRY_FRONTEND_REQUESTS_DSN: str | None = None

# Configuration for the JavaScript SDK's allowUrls option - defaults to ALLOWED_HOSTS
SENTRY_FRONTEND_WHITELIST_URLS: list[str] | None = None

# Configuration for the JavaScript SDK's tracePropagationTargets option - defaults to an empty array
SENTRY_FRONTEND_TRACE_PROPAGATION_TARGETS: list[str] | None = None

# ----
# APM config
# ----

# sample rate for transactions initiated from the frontend
SENTRY_FRONTEND_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for transactions in the backend
SENTRY_BACKEND_APM_SAMPLING = 1 if DEBUG else 0

# Sample rate for symbolicate_event task transactions
SENTRY_SYMBOLICATE_EVENT_APM_SAMPLING = 1 if DEBUG else 0

# Sample rate for the process_event task transactions
SENTRY_PROCESS_EVENT_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for relay's cache invalidation task
SENTRY_RELAY_TASK_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for ingest consumer processing functions
SENTRY_INGEST_CONSUMER_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for suspect commits task
SENTRY_SUSPECT_COMMITS_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for post_process_group task
SENTRY_POST_PROCESS_GROUP_APM_SAMPLING = 1 if DEBUG else 0

# sample rate for all reprocessing tasks (except for the per-event ones)
SENTRY_REPROCESSING_APM_SAMPLING = 1 if DEBUG else 0

# ----
# end APM config
# ----

# Web Service
SENTRY_WEB_HOST = "127.0.0.1"
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS: dict[str, Any] = {}

# SMTP Service
SENTRY_SMTP_HOST = "127.0.0.1"
SENTRY_SMTP_PORT = 1025

SENTRY_INTERFACES = {
    "csp": "sentry.interfaces.security.Csp",
    "hpkp": "sentry.interfaces.security.Hpkp",
    "expectct": "sentry.interfaces.security.ExpectCT",
    "expectstaple": "sentry.interfaces.security.ExpectStaple",
    "nel": "sentry.interfaces.nel.Nel",
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

SENTRY_UPLOAD_RETRY_TIME = 60  # 1 min

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Will an invite be sent when a member is added to an organization?
SENTRY_ENABLE_INVITES = True

# Origins allowed for session-based API access (via the Access-Control-Allow-Origin header)
SENTRY_ALLOW_ORIGIN: str | None = None

# Origins that are allowed to use credentials. This list is in addition
# to all subdomains of system.url-prefix
ALLOWED_CREDENTIAL_ORIGINS: list[str] = []

# Buffer backend
SENTRY_BUFFER = "sentry.buffer.Buffer"
SENTRY_BUFFER_OPTIONS: dict[str, str] = {}

# Cache backend
# XXX: We explicitly require the cache to be configured as its not optional
# and causes serious confusion with the default django cache
SENTRY_CACHE: str | None = None
SENTRY_CACHE_OPTIONS = {"is_default_cache": True}

# Attachment blob cache backend
SENTRY_ATTACHMENTS = "sentry.attachments.default.DefaultAttachmentCache"
SENTRY_ATTACHMENTS_OPTIONS: dict[str, str] = {}

# Events blobs processing backend
SENTRY_EVENT_PROCESSING_STORE = (
    "sentry.eventstore.processing.redis.RedisClusterEventProcessingStore"
)
SENTRY_EVENT_PROCESSING_STORE_OPTIONS: dict[str, str] = {}

# Transactions processing backend
# If these are set, transactions will be written to a different processing store
# than errors. If these are set to none, Events(errors) and transactions will
# both write to the EVENT_PROCESSING_STORE.
SENTRY_TRANSACTION_PROCESSING_STORE: str | None = None
SENTRY_TRANSACTION_PROCESSING_STORE_OPTIONS: dict[str, str] = {}


# The internal Django cache is still used in many places
# TODO(dcramer): convert uses over to Sentry's backend
CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}

# The cache version affects both Django's internal cache (at runtime) as well
# as Sentry's cache. This automatically overrides VERSION on the default
# CACHES backend.
CACHE_VERSION = 1

# Digests backend
SENTRY_DIGESTS = "sentry.digests.backends.dummy.DummyBackend"
SENTRY_DIGESTS_OPTIONS: dict[str, Any] = {}

# Quota backend
SENTRY_QUOTAS = "sentry.quotas.Quota"
SENTRY_QUOTA_OPTIONS: dict[str, str] = {}

# Cache for Relay project configs
SENTRY_RELAY_PROJECTCONFIG_CACHE = "sentry.relay.projectconfig_cache.redis.RedisProjectConfigCache"
SENTRY_RELAY_PROJECTCONFIG_CACHE_OPTIONS: dict[str, str] = {}

# Which cache to use for debouncing cache updates to the projectconfig cache
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE = (
    "sentry.relay.projectconfig_debounce_cache.base.ProjectConfigDebounceCache"
)
SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS: dict[str, str] = {}

# Rate limiting backend
SENTRY_RATELIMITER = "sentry.ratelimits.base.RateLimiter"
SENTRY_RATELIMITER_ENABLED = False
SENTRY_RATELIMITER_OPTIONS: dict[str, Any] = {}
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
SENTRY_NODESTORE_OPTIONS: dict[str, Any] = {}

# Node storage backend used for ArtifactBundle indexing (aka FlatFileIndex aka BundleIndex)
SENTRY_INDEXSTORE = "sentry.nodestore.django.DjangoNodeStorage"
SENTRY_INDEXSTORE_OPTIONS: dict[str, Any] = {}

# Tag storage backend
SENTRY_TAGSTORE = os.environ.get("SENTRY_TAGSTORE", "sentry.tagstore.snuba.SnubaTagStorage")
SENTRY_TAGSTORE_OPTIONS: dict[str, Any] = {}

# Search backend
SENTRY_SEARCH = os.environ.get(
    "SENTRY_SEARCH", "sentry.search.snuba.EventsDatasetSnubaSearchBackend"
)
SENTRY_SEARCH_OPTIONS: dict[str, Any] = {}
# SENTRY_SEARCH_OPTIONS = {
#     'urls': ['http://127.0.0.1:9200/'],
#     'timeout': 5,
# }

# Time-series storage backend
SENTRY_TSDB = "sentry.tsdb.dummy.DummyTSDB"
SENTRY_TSDB_OPTIONS: dict[str, Any] = {}

SENTRY_NEWSLETTER = "sentry.newsletter.base.Newsletter"
SENTRY_NEWSLETTER_OPTIONS: dict[str, Any] = {}

SENTRY_EVENTSTREAM = "sentry.eventstream.snuba.SnubaEventStream"
SENTRY_EVENTSTREAM_OPTIONS: dict[str, Any] = {}

# rollups must be ordered from highest granularity to lowest
SENTRY_TSDB_ROLLUPS = (
    # (time in seconds, samples to keep)
    (10, 360),  # 60 minutes at 10 seconds
    (3600, 24 * 7),  # 7 days at 1 hour
    (3600 * 24, 90),  # 90 days at 1 day
)

# Internal metrics
SENTRY_METRICS_BACKEND = "sentry.metrics.dummy.DummyMetricsBackend"
SENTRY_METRICS_OPTIONS: dict[str, Any] = {}
SENTRY_METRICS_SAMPLE_RATE = 1.0
SENTRY_METRICS_PREFIX = "sentry."
SENTRY_METRICS_SKIP_INTERNAL_PREFIXES: list[str] = []  # Order this by most frequent prefixes.
SENTRY_METRICS_SKIP_ALL_INTERNAL = False
SENTRY_METRICS_DISALLOW_BAD_TAGS = IS_DEV

# Metrics product
SENTRY_METRICS_INDEXER = "sentry.sentry_metrics.indexer.postgres.postgres_v2.PostgresIndexer"
SENTRY_METRICS_INDEXER_OPTIONS: dict[str, Any] = {}
SENTRY_METRICS_INDEXER_CACHE_TTL = 3600 * 2
SENTRY_METRICS_INDEXER_TRANSACTIONS_SAMPLE_RATE = 0.1  # relative to SENTRY_BACKEND_APM_SAMPLING

SENTRY_METRICS_INDEXER_SPANNER_OPTIONS: dict[str, Any] = {}

SENTRY_METRICS_INDEXER_REINDEXED_INTS: dict[int, str] = {}

# Rate limits during string indexing for our metrics product.
# Which cluster to use. Example: {"cluster": "default"}
SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS: dict[str, str] = {}
SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE = (
    SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS
)

# Controls the sample rate with which we report errors to Sentry for metric messages
# dropped due to rate limits.
SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 0.01

SENTRY_METRICS_INDEXER_ENABLE_SLICED_PRODUCER = False

# Render charts on the backend. This uses the Chartcuterie external service.
SENTRY_CHART_RENDERER = "sentry.charts.chartcuterie.Chartcuterie"
SENTRY_CHART_RENDERER_OPTIONS: dict[str, Any] = {}

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT: str | None = None
SENTRY_PUBLIC_ENDPOINT: str | None = None

# Hostname prefix to add for organizations that are opted into the
# `organizations:org-ingest-subdomains` feature.
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
# How many frames are used in jira issues
SENTRY_MAX_STACKTRACE_FRAMES = 100

# Gravatar service base url
SENTRY_GRAVATAR_BASE_URL = "https://gravatar.com"

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
SENTRY_CACHE_MAX_VALUE_SIZE: int | None = None

# Fields which managed users cannot change via Sentry UI. Username and password
# cannot be changed by managed users. Optionally include 'email' and
# 'name' in SENTRY_MANAGED_USER_FIELDS.
SENTRY_MANAGED_USER_FIELDS = ()

# Secret key for OpenAI
OPENAI_API_KEY: str | None = None

# AI Suggested Fix default model
SENTRY_AI_SUGGESTED_FIX_MODEL: str = os.getenv("SENTRY_AI_SUGGESTED_FIX_MODEL", "gpt-4o-mini")

SENTRY_API_PAGINATION_ALLOWLIST = SENTRY_API_PAGINATION_ALLOWLIST_DO_NOT_MODIFY

SENTRY_SCOPES = {
    "org:read",
    "org:write",
    "org:admin",
    "org:integrations",
    "org:ci",
    # "org:superuser",  Do not use for any type of superuser permission/access checks
    # Assigned to active SU sessions in src/sentry/auth/access.py to enable UI elements
    "member:invite",
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
    # openid, profile, and email aren't prefixed to maintain compliance with the OIDC spec.
    # https://auth0.com/docs/get-started/apis/scopes/openid-connect-scopes.
    "openid",
    "profile",
    "email",
}

SENTRY_READONLY_SCOPES = {
    "org:read",
    "member:read",
    "team:read",
    "project:read",
    "event:read",
    "alerts:read",
}

SENTRY_SCOPE_HIERARCHY_MAPPING = {
    "org:read": {"org:read"},
    "org:write": {"org:read", "org:write"},
    "org:admin": {"org:read", "org:write", "org:admin", "org:integrations"},
    "org:integrations": {"org:integrations"},
    "org:ci": {"org:ci"},
    "member:invite": {"member:read", "member:invite"},
    "member:read": {"member:read"},
    "member:write": {"member:read", "member:invite", "member:write"},
    "member:admin": {"member:read", "member:invite", "member:write", "member:admin"},
    "team:read": {"team:read"},
    "team:write": {"team:read", "team:write"},
    "team:admin": {"team:read", "team:write", "team:admin"},
    "project:read": {"project:read"},
    "project:write": {"project:read", "project:write"},
    "project:admin": {"project:read", "project:write", "project:admin"},
    "project:releases": {"project:releases"},
    "event:read": {"event:read"},
    "event:write": {"event:read", "event:write"},
    "event:admin": {"event:read", "event:write", "event:admin"},
    "alerts:read": {"alerts:read"},
    "alerts:write": {"alerts:read", "alerts:write"},
    "openid": {"openid"},
    "profile": {"profile"},
    "email": {"email"},
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
        ("member:invite", "Member invite access to organization members."),
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
    (("openid", "Confirms authentication status and provides basic information."),),
    (
        (
            "profile",
            "Read personal information like name, avatar, date of joining etc. Requires openid scope.",
        ),
    ),
    (("email", "Read email address and verification status. Requires openid scope."),),
)

SENTRY_API_PAGINATION_ALLOWLIST = SENTRY_API_PAGINATION_ALLOWLIST_DO_NOT_MODIFY

SENTRY_DEFAULT_ROLE = "member"

# Roles are ordered, which represents a sort-of hierarchy, as well as how
# they're presented in the UI. This is primarily important in that a member
# that is earlier in the chain cannot manage the settings of a member later
# in the chain (they still require the appropriate scope).
SENTRY_ROLES: tuple[RoleDict, ...] = (
    {
        "id": "member",
        "name": "Member",
        "desc": "Members can view and act on events, as well as view most other data within the organization. By default, they can invite members to the organization unless the organization has disabled this feature.",
        "scopes": {
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:invite",
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
            teams that they are members of. By default, they can invite members
            to the organization unless the organization has disabled this feature.
            """
        ),
        "scopes": {
            "event:read",
            "event:write",
            "event:admin",
            "org:read",
            "member:read",
            "member:invite",
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
            "member:invite",
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
            "member:invite",
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

SENTRY_TEAM_ROLES: tuple[RoleDict, ...] = (
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
            and can manage the team's memberships.
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
SENTRY_OPTIONS: dict[str, Any] = {}
SENTRY_DEFAULT_OPTIONS: dict[str, Any] = {}
# Raise an error in dev on failed lookups
SENTRY_OPTIONS_COMPLAIN_ON_ERRORS = True

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

SENTRY_DEV_USE_REDIS_CLUSTER = bool(os.getenv("SENTRY_DEV_USE_REDIS_CLUSTER", False))

# To use RabbitMQ as a Celery tasks broker
# BROKER_URL = "amqp://guest:guest@localhost:5672/sentry"
# more info https://develop.sentry.dev/services/queue/
SENTRY_DEV_USE_RABBITMQ = bool(os.getenv("SENTRY_DEV_USE_RABBITMQ", False))

# The chunk size for attachments in blob store. Should be a power of two.
SENTRY_ATTACHMENT_BLOB_SIZE = 8 * 1024 * 1024  # 8MB

# The chunk size for files in the chunk upload. This is used for native debug
# files and source maps, and directly translates to the chunk size in blob
# store. MUST be a power of two.
#
# Note: Even if the power of two restriction is lifted in Sentry, Sentry CLI
# versions ≤2.39.1 will error if the chunkSize returned by the server is
# not a power of two. Changing this value to a non-power-of-two is therefore
# a breaking API change.
SENTRY_CHUNK_UPLOAD_BLOB_SIZE = 8 * 1024 * 1024  # 8MB

# This flag tell DEVSERVICES to start the ingest-metrics-consumer in order to work on
# metrics in the development environment. Note: this is "metrics" the product
SENTRY_USE_METRICS_DEV = False

# This flag activates profiling backend in the development environment
SENTRY_USE_PROFILING = False

# This flag activates indexed spans backend in the development environment
SENTRY_USE_SPANS = False

# This flag activates spans consumer in the sentry backend in development environment
SENTRY_USE_SPANS_BUFFER = False

# This flag activates consuming issue platform occurrence data in the development environment
SENTRY_USE_ISSUE_OCCURRENCE = False

# This flag activates consuming GroupAttribute messages in the development environment
SENTRY_USE_GROUP_ATTRIBUTES = True

# This flag activates uptime checks in the developemnt environment
SENTRY_USE_UPTIME = False

# This flag activates the taskbroker in devservices
SENTRY_USE_TASKBROKER = False

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


# platform.processor() changed at some point between these:
# 11.2.3: arm
# 12.3.1: arm64
# ubuntu: aarch64
ARM64 = platform.processor() in {"arm", "arm64", "aarch64"}

SENTRY_DEVSERVICES: dict[str, Callable[[Any, Any], dict[str, Any]]] = {
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
    "redis-cluster": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/docker-redis-cluster:7.0.10",
            "ports": {f"700{idx}/tcp": f"700{idx}" for idx in range(6)},
            "volumes": {"redis-cluster": {"bind": "/redis-data"}},
            "environment": {"IP": "0.0.0.0"},
            "only_if": settings.SENTRY_DEV_USE_REDIS_CLUSTER,
        }
    ),
    "rabbitmq": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-library-rabbitmq:3-management",
            "ports": {"5672/tcp": 5672, "15672/tcp": 15672},
            "environment": {"IP": "0.0.0.0"},
            "only_if": settings.SENTRY_DEV_USE_RABBITMQ,
        }
    ),
    "postgres": lambda settings, options: (
        {
            "image": f"ghcr.io/getsentry/image-mirror-library-postgres:{PG_VERSION}-alpine",
            "ports": {"5432/tcp": 5432},
            "environment": {"POSTGRES_DB": "sentry", "POSTGRES_HOST_AUTH_METHOD": "trust"},
            "volumes": {
                "postgres": {"bind": "/var/lib/postgresql/data"},
                "wal2json": {"bind": "/wal2json"},
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
        }
    ),
    "kafka": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/image-mirror-confluentinc-cp-kafka:7.5.0",
            "ports": {"9092/tcp": 9092},
            # https://docs.confluent.io/platform/current/installation/docker/config-reference.html#cp-kakfa-example
            "environment": {
                "KAFKA_PROCESS_ROLES": "broker,controller",
                "KAFKA_CONTROLLER_QUORUM_VOTERS": "1@127.0.0.1:29093",
                "KAFKA_CONTROLLER_LISTENER_NAMES": "CONTROLLER",
                "KAFKA_NODE_ID": "1",
                "CLUSTER_ID": "MkU3OEVBNTcwNTJENDM2Qk",
                "KAFKA_LISTENERS": "PLAINTEXT://0.0.0.0:29092,INTERNAL://0.0.0.0:9093,EXTERNAL://0.0.0.0:9092,CONTROLLER://0.0.0.0:29093",
                "KAFKA_ADVERTISED_LISTENERS": "PLAINTEXT://127.0.0.1:29092,INTERNAL://sentry_kafka:9093,EXTERNAL://127.0.0.1:9092",
                "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP": "PLAINTEXT:PLAINTEXT,INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT",
                "KAFKA_INTER_BROKER_LISTENER_NAME": "PLAINTEXT",
                "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR": "1",
                "KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS": "1",
                "KAFKA_LOG_RETENTION_HOURS": "24",
                "KAFKA_MESSAGE_MAX_BYTES": "50000000",
                "KAFKA_MAX_REQUEST_SIZE": "50000000",
            },
            "volumes": {"kafka": {"bind": "/var/lib/kafka/data"}},
            "only_if": "kafka" in settings.SENTRY_EVENTSTREAM
            or settings.SENTRY_USE_RELAY
            or settings.SENTRY_DEV_PROCESS_SUBSCRIPTIONS
            or settings.SENTRY_USE_PROFILING,
        }
    ),
    "clickhouse": lambda settings, options: (
        {
            "image": (
                "ghcr.io/getsentry/image-mirror-altinity-clickhouse-server:23.8.11.29.altinitystable"
            ),
            "ports": {"9000/tcp": 9000, "9009/tcp": 9009, "8123/tcp": 8123},
            "ulimits": [{"name": "nofile", "soft": 262144, "hard": 262144}],
            # The arm image does not properly load the MAX_MEMORY_USAGE_RATIO
            # from the environment in loc_config.xml, thus, hard-coding it there
            "volumes": {
                (
                    "clickhouse_dist"
                    if settings.SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES
                    else "clickhouse"
                ): {"bind": "/var/lib/clickhouse"},
                os.path.join(
                    settings.DEVSERVICES_CONFIG_DIR,
                    "clickhouse",
                    (
                        "dist_config.xml"
                        if settings.SENTRY_DISTRIBUTED_CLICKHOUSE_TABLES
                        else "loc_config.xml"
                    ),
                ): {"bind": "/etc/clickhouse-server/config.d/sentry.xml"},
            },
        }
    ),
    "snuba": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/snuba:latest",
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
                "DEFAULT_BROKERS": (
                    ""
                    if "snuba" in settings.SENTRY_EVENTSTREAM
                    else "{containers[kafka][name]}:9093"
                ),
                "REDIS_HOST": "{containers[redis][name]}",
                "REDIS_PORT": "6379",
                "REDIS_DB": "1",
                "ENABLE_SENTRY_METRICS_DEV": "1" if settings.SENTRY_USE_METRICS_DEV else "",
                "ENABLE_PROFILES_CONSUMER": "1" if settings.SENTRY_USE_PROFILING else "",
                "ENABLE_SPANS_CONSUMER": "1" if settings.SENTRY_USE_SPANS else "",
                "ENABLE_ISSUE_OCCURRENCE_CONSUMER": (
                    "1" if settings.SENTRY_USE_ISSUE_OCCURRENCE else ""
                ),
                "ENABLE_AUTORUN_MIGRATION_SEARCH_ISSUES": "1",
                # TODO: remove setting
                "ENABLE_GROUP_ATTRIBUTES_CONSUMER": (
                    "1" if settings.SENTRY_USE_GROUP_ATTRIBUTES else ""
                ),
            },
            "only_if": "snuba" in settings.SENTRY_EVENTSTREAM
            or "kafka" in settings.SENTRY_EVENTSTREAM,
            # we don't build linux/arm64 snuba images anymore
            # apple silicon users should have working emulation under colima 0.6.2
            # or docker desktop
            "platform": "linux/amd64",
        }
    ),
    "taskbroker": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/taskbroker:latest",
            "ports": {"50051/tcp": 50051},
            "environment": {
                "TASKBROKER_KAFKA_CLUSTER": (
                    "kafka-kafka-1"
                    if os.environ.get("USE_NEW_DEVSERVICES") == "1"
                    else "sentry_kafka"
                ),
            },
            "only_if": settings.SENTRY_USE_TASKBROKER,
            "platform": "linux/amd64",
        }
    ),
    "bigtable": lambda settings, options: (
        {
            "image": "ghcr.io/getsentry/cbtemulator:d28ad6b63e461e8c05084b8c83f1c06627068c04",
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
            "image": "us-central1-docker.pkg.dev/sentryio/symbolicator/image:nightly",
            "ports": {"3021/tcp": 3021},
            "volumes": {settings.SYMBOLICATOR_CONFIG_DIR: {"bind": "/etc/symbolicator"}},
            "command": ["run", "--config", "/etc/symbolicator/config.yml"],
            "only_if": options.get("symbolicator.enabled"),
        }
    ),
    "relay": lambda settings, options: (
        {
            "image": "us-central1-docker.pkg.dev/sentryio/relay/relay:nightly",
            "ports": {"7899/tcp": settings.SENTRY_RELAY_PORT},
            "volumes": {settings.RELAY_CONFIG_DIR: {"bind": "/etc/relay"}},
            "command": ["run", "--config", "/etc/relay"],
            "only_if": bool(os.environ.get("SENTRY_USE_RELAY", settings.SENTRY_USE_RELAY)),
            "with_devserver": True,
        }
    ),
    "chartcuterie": lambda settings, options: (
        {
            "image": "us-central1-docker.pkg.dev/sentryio/chartcuterie/image:latest",
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
    "vroom": lambda settings, options: (
        {
            "image": "us-central1-docker.pkg.dev/sentryio/vroom/vroom:latest",
            "volumes": {"profiles": {"bind": "/var/lib/sentry-profiles"}},
            "environment": {
                "SENTRY_KAFKA_BROKERS_PROFILING": "{containers[kafka][name]}:9093",
                "SENTRY_KAFKA_BROKERS_OCCURRENCES": "{containers[kafka][name]}:9093",
                "SENTRY_SNUBA_HOST": "http://{containers[snuba][name]}:1218",
            },
            "ports": {"8085/tcp": 8085},
            "only_if": settings.SENTRY_USE_PROFILING,
        }
    ),
}

# Max file size for serialized file uploads in API
SENTRY_MAX_SERIALIZED_FILE_SIZE = 5000000

# Max file size for avatar photo uploads
SENTRY_MAX_AVATAR_SIZE = 5000000

# statuspage.io support
STATUS_PAGE_ID: str | None = None
STATUS_PAGE_API_HOST = "statuspage.io"

# For compatibility only. Prefer using SENTRY_MODE.
SENTRY_SELF_HOSTED = SENTRY_MODE == SentryMode.SELF_HOSTED

SENTRY_SELF_HOSTED_ERRORS_ONLY = False
# only referenced in getsentry to provide the stable beacon version
# updated with scripts/bump-version.sh
SELF_HOSTED_STABLE_VERSION = "24.12.1"

# Whether we should look at X-Forwarded-For header or not
# when checking REMOTE_ADDR ip addresses
SENTRY_USE_X_FORWARDED_FOR = True

SENTRY_DEFAULT_INTEGRATIONS = (
    "sentry.integrations.bitbucket.integration.BitbucketIntegrationProvider",
    "sentry.integrations.bitbucket_server.integration.BitbucketServerIntegrationProvider",
    "sentry.integrations.slack.SlackIntegrationProvider",
    "sentry.integrations.github.integration.GitHubIntegrationProvider",
    "sentry.integrations.github_enterprise.integration.GitHubEnterpriseIntegrationProvider",
    "sentry.integrations.gitlab.integration.GitlabIntegrationProvider",
    "sentry.integrations.jira.JiraIntegrationProvider",
    "sentry.integrations.jira_server.JiraServerIntegrationProvider",
    "sentry.integrations.vsts.VstsIntegrationProvider",
    "sentry.integrations.vsts_extension.VstsExtensionIntegrationProvider",
    "sentry.integrations.pagerduty.integration.PagerDutyIntegrationProvider",
    "sentry.integrations.vercel.VercelIntegrationProvider",
    "sentry.integrations.msteams.MsTeamsIntegrationProvider",
    "sentry.integrations.aws_lambda.AwsLambdaIntegrationProvider",
    "sentry.integrations.discord.DiscordIntegrationProvider",
    "sentry.integrations.opsgenie.OpsgenieIntegrationProvider",
)


SENTRY_SDK_CONFIG: ServerSdkConfig = {
    "release": sentry.__semantic_version__,
    "environment": ENVIRONMENT,
    "project_root": "/usr/src",
    "in_app_include": ["sentry", "sentry_plugins"],
    "debug": True,
    "send_default_pii": True,
    "auto_enabling_integrations": False,
    "enable_db_query_source": True,
    # Keep alive is enabled to help avoid losing events due to network
    # connectivity issues. We are specifically enabling this to help ensure
    # cron monitor check-ins make it through.
    "keep_alive": True,
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
SENTRY_PROFILES_SAMPLE_RATE = 1 if DEBUG else 0

# We want to test a few schedulers possible in the profiler. Some are platform
# specific, and each have their own pros/cons. See the sdk for more details.
SENTRY_PROFILER_MODE: Final = "sleep"

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

# To have finer control over which process will have continuous profiling enabled,
# this environment variable will be required to enable continuous profiling.
#
# This setting takes precedence over `SENTRY_PROFILING_ENABLED` forcing the SDK
# to operate under the continuous profiling model.
SENTRY_CONTINUOUS_PROFILING_ENABLED = os.environ.get("SENTRY_CONTINUOUS_PROFILING_ENABLED", False)

# Callable to bind additional context for the Sentry SDK
#
# def get_org_context(scope, organization, **kwargs):
#    scope.set_tag('organization.cool', '1')
#
# SENTRY_ORGANIZATION_CONTEXT_HELPER = get_org_context
SENTRY_ORGANIZATION_CONTEXT_HELPER: Callable[..., object] | None = None

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
SENTRY_RELEASE_REGISTRY_BASEURL: str | None = None

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

TERMS_URL: str | None = None
PRIVACY_URL: str | None = None

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
GEOIP_PATH_MMDB: str | None = None

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
KAFKA_CLUSTERS: dict[str, dict[str, Any]] = {
    "default": {
        "common": {"bootstrap.servers": "127.0.0.1:9092"},
        "producers": {
            "compression.type": "lz4",
            "message.max.bytes": 50000000,  # 50MB, default is 1MB
        },
        "consumers": {},
    }
}


# Mapping of default Kafka topic name to custom names
KAFKA_TOPIC_OVERRIDES: Mapping[str, str] = {}


# Mapping of default Kafka topic name to cluster name
# as per KAFKA_CLUSTERS.
# This must be the default name that matches the topic
# in sentry.conf.types.kafka_definition and sentry-kafka-schemas
# and not any environment-specific override value
KAFKA_TOPIC_TO_CLUSTER: Mapping[str, str] = {
    "events": "default",
    "ingest-events-dlq": "default",
    "snuba-commit-log": "default",
    "transactions": "default",
    "snuba-transactions-commit-log": "default",
    "outcomes": "default",
    "outcomes-dlq": "default",
    "outcomes-billing": "default",
    "outcomes-billing-dlq": "default",
    "events-subscription-results": "default",
    "transactions-subscription-results": "default",
    "generic-metrics-subscription-results": "default",
    "metrics-subscription-results": "default",
    "eap-spans-subscription-results": "default",
    "ingest-events": "default",
    "ingest-feedback-events": "default",
    "ingest-feedback-events-dlq": "default",
    "ingest-attachments": "default",
    "ingest-attachments-dlq": "default",
    "ingest-transactions": "default",
    "ingest-transactions-dlq": "default",
    "ingest-transactions-backlog": "default",
    "ingest-metrics": "default",
    "ingest-metrics-dlq": "default",
    "snuba-metrics": "default",
    "profiles": "default",
    "ingest-performance-metrics": "default",
    "ingest-generic-metrics-dlq": "default",
    "snuba-generic-metrics": "default",
    "ingest-replay-events": "default",
    "ingest-replay-recordings": "default",
    "ingest-occurrences": "default",
    "ingest-monitors": "default",
    "monitors-clock-tick": "default",
    "monitors-clock-tasks": "default",
    "monitors-incident-occurrences": "default",
    "uptime-configs": "default",
    "uptime-results": "default",
    "uptime-configs": "default",
    "snuba-uptime-results": "default",
    "generic-events": "default",
    "snuba-generic-events-commit-log": "default",
    "group-attributes": "default",
    "snuba-spans": "default",
    "shared-resources-usage": "default",
    "buffered-segments": "default",
    "buffered-segments-dlq": "default",
    "task-worker": "default",
}


# If True, sentry.utils.arroyo.run_task_with_multiprocessing will actually be
# single-threaded under the hood for performance
KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING = False


# For Jira, only approved apps can use the access_email_addresses scope
# This scope allows Sentry to use the email endpoint (https://developer.atlassian.com/cloud/jira/platform/rest/v3/#api-rest-api-3-user-email-get)
# We use the email with Jira 2-way sync in order to match the user
JIRA_USE_EMAIL_SCOPE = False

# Specifies the list of django apps to include in the lockfile. If Falsey then include
# all apps with migrations
MIGRATIONS_LOCKFILE_APP_WHITELIST = (
    "nodestore",
    "replays",
    "sentry",
    "social_auth",
    "feedback",
    "hybridcloud",
    "remote_subscriptions",
    "uptime",
    "workflow_engine",
    "tempest",
)
# Where to write the lockfile to.
MIGRATIONS_LOCKFILE_PATH = os.path.join(PROJECT_ROOT, os.path.pardir, os.path.pardir)

# Log error and abort processing (without dropping event, but marking it as failed to process)
# when `symbolicate_event` is taking more than n seconds to process an event.
SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT = 15 * 60

# Log warning when `symbolicate_event` is taking more than n seconds to process an event.
SYMBOLICATOR_PROCESS_EVENT_WARN_TIMEOUT = 2 * 60

# Block `symbolicate_event` for this many seconds to wait for a response from Symbolicator.
SYMBOLICATOR_POLL_TIMEOUT = 5

# The `url` of the different Symbolicator pools.
# We want to route different workloads to a different set of Symbolicator pools.
# This can be as fine-grained as using a different pool for normal "native"
# symbolication, `js` symbolication, and `jvm` symbolication.
# The keys here should match the `SymbolicatorPools` enum
# defined in `src/sentry/lang/native/symbolicator.py`.
# If a specific setting does not exist, this will fall back to the `default` pool.
# If that is not configured, it will fall back to the `url` configured in
# `symbolicator.options`.
# The settings here are intentionally empty and will fall back to
# `symbolicator.options` for backwards compatibility.
SYMBOLICATOR_POOL_URLS: dict[str, str] = {
    # "default": "...",
    # "js": "...",
    # "jvm": "...",
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
    "sentry.issues.endpoints",
    "sentry.integrations.api.endpoints",
    "sentry.users.api.endpoints",
    "sentry.sentry_apps.api.endpoints",
)
SENTRY_MAIL_ADAPTER_BACKEND = "sentry.mail.adapter.MailAdapter"

# Project ID used by synthetic monitoring
# Synthetic monitoring recurringly send events, prepared with specific
# attributes, which can be identified through the whole processing pipeline and
# observed mainly for producing stable metrics.
SENTRY_SYNTHETIC_MONITORING_PROJECT_ID: int | None = None

# Similarity cluster to use
# Similarity-v1: uses hardcoded set of event properties for diffing
SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER = "default"

# Unused legacy option, there to satisfy getsentry CI. Remove from getsentry, then here
SENTRY_SIMILARITY2_INDEX_REDIS_CLUSTER = None

# How long the migration phase for grouping lasts
SENTRY_GROUPING_UPDATE_MIGRATION_PHASE = 30 * 24 * 3600  # 30 days

SENTRY_USE_UWSGI = True

# Configure service wrapper for reprocessing2 state
SENTRY_REPROCESSING_STORE = "sentry.eventstore.reprocessing.redis.RedisReprocessingStore"
# Which cluster is used to store auxiliary data for reprocessing. Note that
# this cluster is not used to store attachments etc, that still happens on
# rc-processing. This is just for buffering up event IDs and storing a counter
# for synchronization/progress report.
SENTRY_REPROCESSING_STORE_OPTIONS = {"cluster": "default"}

# When copying attachments for to-be-reprocessed events into processing store,
# how large is an individual file chunk? Each chunk is stored as Redis key.
SENTRY_REPROCESSING_ATTACHMENT_CHUNK_SIZE = 2**20

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

# XXX(meredith): Temporary metrics indexer
SENTRY_METRICS_INDEXER_REDIS_CLUSTER = "default"

# Timeout for the project counter statement execution.
# In case of contention on the project counter, prevent workers saturation with
# save_event tasks from single project.
# Value is in milliseconds. Set to `None` to disable.
SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT = 1000

# Implemented in getsentry to run additional devserver workers.
SENTRY_EXTRA_WORKERS: MutableSequence[str] = []

SAMPLED_DEFAULT_RATE = 1.0

# A set of extra URLs to sample
ADDITIONAL_SAMPLED_URLS: dict[str, float] = {}

# A set of extra tasks to sample
ADDITIONAL_SAMPLED_TASKS: dict[str, float] = {}

# all demo orgs are owned by the user with this email
DEMO_ORG_OWNER_EMAIL: str | None = None

# adds an extra JS to HTML template
INJECTED_SCRIPT_ASSETS: list[str] = []

PG_VERSION: str = os.getenv("PG_VERSION") or "14"

# Zero Downtime Migrations settings as defined at
# https://github.com/tbicr/django-pg-zero-downtime-migrations#settings
ZERO_DOWNTIME_MIGRATIONS_RAISE_FOR_UNSAFE = True
ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT = None
ZERO_DOWNTIME_MIGRATIONS_STATEMENT_TIMEOUT = None
ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT_FORCE = False
ZERO_DOWNTIME_MIGRATIONS_IDEMPOTENT_SQL = False

if int(PG_VERSION.split(".", maxsplit=1)[0]) < 12:
    # In v0.6 of django-pg-zero-downtime-migrations this settings is deprecated for PostreSQLv12+
    # https://github.com/tbicr/django-pg-zero-downtime-migrations/blob/7b3f5c045b40e656772859af4206acf3f11c0951/CHANGES.md#06

    # Note: The docs have this backwards. We set this to False here so that we always add check
    # constraints instead of setting the column to not null.
    ZERO_DOWNTIME_MIGRATIONS_USE_NOT_NULL = False

SEER_DEFAULT_URL = "http://127.0.0.1:9091"  # for local development
SEER_DEFAULT_TIMEOUT = 5

SEER_BREAKPOINT_DETECTION_URL = SEER_DEFAULT_URL  # for local development, these share a URL
SEER_BREAKPOINT_DETECTION_TIMEOUT = 5

SEER_SEVERITY_URL = SEER_DEFAULT_URL  # for local development, these share a URL
SEER_SEVERITY_TIMEOUT = 0.3  # 300 milliseconds
SEER_SEVERITY_RETRIES = 1

SEER_AUTOFIX_URL = SEER_DEFAULT_URL  # for local development, these share a URL

SEER_GROUPING_URL = SEER_DEFAULT_URL  # for local development, these share a URL
SEER_GROUPING_TIMEOUT = 1

SEER_GROUPING_BACKFILL_URL = SEER_DEFAULT_URL

SEER_ANOMALY_DETECTION_MODEL_VERSION = "v1"
SEER_ANOMALY_DETECTION_URL = SEER_DEFAULT_URL  # for local development, these share a URL
SEER_ANOMALY_DETECTION_TIMEOUT = 5

SEER_ANOMALY_DETECTION_ENDPOINT_URL = (
    f"/{SEER_ANOMALY_DETECTION_MODEL_VERSION}/anomaly-detection/detect"
)

SEER_ALERT_DELETION_URL = (
    f"/{SEER_ANOMALY_DETECTION_MODEL_VERSION}/anomaly-detection/delete-alert-data"
)

SEER_AUTOFIX_GITHUB_APP_USER_ID = 157164994

SEER_AUTOFIX_FORCE_USE_REPOS: list[dict] = []


# This is the URL to the profiling service
SENTRY_VROOM = os.getenv("VROOM", "http://127.0.0.1:8085")

SENTRY_REPLAYS_SERVICE_URL = "http://localhost:8090"


SENTRY_ISSUE_ALERT_HISTORY = "sentry.rules.history.backends.postgres.PostgresRuleHistoryBackend"
SENTRY_ISSUE_ALERT_HISTORY_OPTIONS: dict[str, Any] = {}

# This is useful for testing SSO expiry flows
SENTRY_SSO_EXPIRY_SECONDS = os.environ.get("SENTRY_SSO_EXPIRY_SECONDS", None)

# Set to an iterable of strings matching services so only logs from those services show up
# eg. DEVSERVER_LOGS_ALLOWLIST = {"server", "webpack", "worker"}
DEVSERVER_LOGS_ALLOWLIST: set[str] | None = None

# Filter for logs of incoming requests, which matches on substrings. For example, to prevent the
# server from logging
#
#   `POST 200 /api/0/relays/projectconfigs/?version=3 HTTP/1.1 1915`,
#
# add "/api/0/relays/projectconfigs/" to the list, or to suppress logging of all requests to
# `relays/xxx` endpoints, add "/api/0/relays/".
DEVSERVER_REQUEST_LOG_EXCLUDES: list[str] = []

LOG_API_ACCESS = not IS_DEV or os.environ.get("SENTRY_LOG_API_ACCESS")

# We should not run access logging middleware on some endpoints as
# it is very noisy, and these views are hit by internal services.
ACCESS_LOGS_EXCLUDE_PATHS = ("/api/0/internal/", "/api/0/relays/", "/_warmup/")

VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON = True
DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL = False
SUPERUSER_STAFF_EMAIL_SUFFIX: str | None = None

# determines if we enable analytics or not
ENABLE_ANALYTICS = False

MAX_SLOW_CONDITION_ISSUE_ALERTS = 100
MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS = 400
MAX_FAST_CONDITION_ISSUE_ALERTS = 500
MAX_QUERY_SUBSCRIPTIONS_PER_ORG = 1000
MAX_MORE_FAST_CONDITION_ISSUE_ALERTS = 1000

MAX_REDIS_SNOWFLAKE_RETRY_COUNTER = 5

SNOWFLAKE_VERSION_ID = 1
SENTRY_SNOWFLAKE_EPOCH_START = datetime(2022, 8, 8, 0, 0).timestamp()
SENTRY_USE_SNOWFLAKE = False

SENTRY_DEFAULT_LOCKS_BACKEND_OPTIONS: ServiceOptions = {
    "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
    "options": {"cluster": "default"},
}

SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS: ServiceOptions = {
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

# Settings related to SiloMode
FAIL_ON_UNAVAILABLE_API_CALL = False

DISALLOWED_CUSTOMER_DOMAINS: list[str] = []

SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS: dict[str, str] = {}
SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT = 10000

SENTRY_GROUP_ATTRIBUTES_FUTURES_MAX_LIMIT = 10000

# How long we should wait for a gateway proxy request to return before giving up
GATEWAY_PROXY_TIMEOUT = None

SENTRY_SLICING_LOGICAL_PARTITION_COUNT = 256
# This maps a Sliceable for slicing by name and (lower logical partition, upper physical partition)
# to a given slice. A slice is a set of physical resources in Sentry and Snuba.
#
# For each Sliceable, the range [0, SENTRY_SLICING_LOGICAL_PARTITION_COUNT) must be mapped
# to a slice ID
SENTRY_SLICING_CONFIG: Mapping[str, Mapping[tuple[int, int], int]] = {}

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
SLICED_KAFKA_TOPICS: Mapping[tuple[str, int], Mapping[str, Any]] = {}

# Used by silo tests -- activate all silo mode test decorators even if not marked stable
FORCE_SILOED_TESTS = os.environ.get("SENTRY_FORCE_SILOED_TESTS", False)

# Set the URL for signup page that we redirect to for the setup wizard if signup=1 is in the query params
SENTRY_SIGNUP_URL: str | None = None

SENTRY_ORGANIZATION_ONBOARDING_TASK = "sentry.onboarding_tasks.backends.organization_onboarding_task.OrganizationOnboardingTaskBackend"

# Previously replays were ingested using the filestore interface and service. Both the
# interface and the service were dropped in favor of reusing the metadata contained
# within ClickHouse and uploading directly to the cloud storage provider.
#
# Default: true. Disabling this option may make older records unretrievable. No data is
# lost as a result of toggling this setting.
SENTRY_REPLAYS_ATTEMPT_LEGACY_FILESTORE_LOOKUP = True

SENTRY_FEATURE_ADOPTION_CACHE_OPTIONS: ServiceOptions = {
    "path": "sentry.models.featureadoption.FeatureAdoptionRedisBackend",
    "options": {"cluster": "default"},
}

ADDITIONAL_BULK_QUERY_DELETES: list[tuple[str, str, str | None]] = []

# Monitor limits to prevent abuse
MAX_MONITORS_PER_ORG = 1500
MAX_ENVIRONMENTS_PER_MONITOR = 1000

# Raise schema validation errors and make the indexer crash (only useful in
# tests)
SENTRY_METRICS_INDEXER_RAISE_VALIDATION_ERRORS = False

# The Redis cluster to use for monitoring the service / consumer health.
SENTRY_SERVICE_MONITORING_REDIS_CLUSTER = "default"

# This is a view of which abstract processing service is backed by which infrastructure.
# Right now, the infrastructure can be `redis` or `rabbitmq`.
#
# For `redis`, one has to provide the cluster id.
# It has to match a cluster defined in `redis.redis_clusters`.
#
# For `rabbitmq`, one has to provide a list of server URLs.
# The URL is in the format `http://{user}:{password}@{hostname}:{port}/`.
#
# The definition can also be empty, in which case nothing is checked and
# the service is assumed to be healthy.
# However, the service *must* be defined.
SENTRY_PROCESSING_SERVICES: Mapping[str, Any] = {
    "celery": {"redis": "default"},
    "attachments-store": {"redis": "default"},
    "processing-store": {},  # "redis": "processing"},
    "processing-store-transactions": {},
    "processing-locks": {"redis": "default"},
    "post-process-locks": {"redis": "default"},
}


# If set to true, model cache will read by default from DB read replica in case of cache misses.
# NB: Set to true only if you have multi db setup and django db routing configured.
#     See sentry.db.models.manager.base_query_set how qs.using_replica() works for more details db
#     router implementation.
SENTRY_MODEL_CACHE_USE_REPLICA = False

# Additional consumer definitions beyond the ones defined in sentry.consumers.
# Necessary for getsentry to define custom consumers.
SENTRY_KAFKA_CONSUMERS: Mapping[str, ConsumerDefinition] = {}

# sentry devserver should _always_ start the following consumers, identified by
# key in SENTRY_KAFKA_CONSUMERS or sentry.consumers.KAFKA_CONSUMERS
DEVSERVER_START_KAFKA_CONSUMERS: MutableSequence[str] = []


# If set to True, buffer.incr will be spawned as background celery task. If false it's a direct call
# to the buffer service.
SENTRY_BUFFER_INCR_AS_CELERY_TASK = False

# Feature flag to turn off role-swapping to help bridge getsentry transition.
USE_ROLE_SWAPPING_IN_TESTS = True

# Threshold for the number of timeouts needed in a day to disable an integration
BROKEN_TIMEOUT_THRESHOLD = 1000

# This webhook url can be configured to log the changes made to runtime options as they
# are changed by sentry configoptions.
OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL: str | None = None

OPTIONS_AUTOMATOR_HMAC_SECRET: str | None = None

SENTRY_METRICS_INTERFACE_BACKEND = "sentry.sentry_metrics.client.snuba.SnubaMetricsBackend"
SENTRY_METRICS_INTERFACE_BACKEND_OPTIONS: dict[str, Any] = {}

# Controls whether the SDK will send the metrics upstream to the S4S transport.
SENTRY_SDK_UPSTREAM_METRICS_ENABLED = False

# Backwards compatibility for URLs that don't
# have enough context to route via organization.
# New usage of these endpoints should use the region domains,
# but existing customers have been using these routes
# on the main domain for a long time.
REGION_PINNED_URL_NAMES = {
    # These paths have organization scoped aliases
    "sentry-api-0-builtin-symbol-sources",
    "sentry-api-0-grouping-configs",
    "sentry-api-0-prompts-activity",
    # Unprefixed issue URLs
    "sentry-api-0-group-details",
    "sentry-api-0-group-activities",
    "sentry-api-0-group-events",
    "sentry-api-0-group-event-details",
    "sentry-api-0-group-notes",
    "sentry-api-0-group-note-details",
    "sentry-api-0-group-hashes",
    "sentry-api-0-group-reprocessing",
    "sentry-api-0-group-stats",
    "sentry-api-0-group-tags",
    "sentry-api-0-group-tag-key-details",
    "sentry-api-0-group-tag-key-values",
    "sentry-api-0-group-user-reports",
    "sentry-api-0-group-attachments",
    "sentry-api-0-group-similar",
    "sentry-api-0-group-similar-issues-embeddings",
    "sentry-api-0-group-external-issues",
    "sentry-api-0-group-external-issues-details",
    "sentry-api-0-group-integrations",
    "sentry-api-0-group-integration-details",
    "sentry-api-0-group-current-release",
    "sentry-api-0-shared-group-details",
    # Unscoped profiling URLs
    "sentry-api-0-profiling-project-profile",
    # These paths are used by relay which is implicitly region scoped
    "sentry-api-0-relays-index",
    "sentry-api-0-relay-register-challenge",
    "sentry-api-0-relay-register-response",
    "sentry-api-0-relay-projectconfigs",
    "sentry-api-0-relay-projectids",
    "sentry-api-0-relay-publickeys",
    "sentry-api-0-relays-healthcheck",
    "sentry-api-0-relays-details",
    # Backwards compatibility for US customers.
    # New usage of these is region scoped.
    "sentry-js-sdk-loader",
    "sentry-release-hook",
    "sentry-api-0-organizations",
    "sentry-api-0-projects",
    "sentry-api-0-accept-project-transfer",
    "sentry-organization-avatar-url",
    "sentry-chartcuterie-config",
    "sentry-robots-txt",
}
# Used in tests to skip forwarding relay paths to a region silo that does not exist.
APIGATEWAY_PROXY_SKIP_RELAY = False

# Shared resource ids for accounting
EVENT_PROCESSING_STORE = "rc_processing_redis"
COGS_EVENT_STORE_LABEL = "bigtable_nodestore"

# Disable DDM entirely
SENTRY_DDM_DISABLE = os.getenv("SENTRY_DDM_DISABLE", "0") in ("1", "true", "True")

SEER_SIMILARITY_MODEL_VERSION = "v0"
SEER_SIMILAR_ISSUES_URL = f"/{SEER_SIMILARITY_MODEL_VERSION}/issues/similar-issues"
SEER_MAX_GROUPING_DISTANCE = 0.01
SEER_MAX_SIMILARITY_DISTANCE = 0.15  # Not yet in use - Seer doesn't obey this right now
SEER_GROUPING_RECORDS_URL = (
    f"/{SEER_SIMILARITY_MODEL_VERSION}/issues/similar-issues/grouping-record"
)
SEER_PROJECT_GROUPING_RECORDS_DELETE_URL = (
    f"/{SEER_SIMILARITY_MODEL_VERSION}/issues/similar-issues/grouping-record/delete"
)
SEER_HASH_GROUPING_RECORDS_DELETE_URL = (
    f"/{SEER_SIMILARITY_MODEL_VERSION}/issues/similar-issues/grouping-record/delete-by-hash"
)
SEER_SIMILARITY_CIRCUIT_BREAKER_KEY = "seer.similarity"

SEER_ANOMALY_DETECTION_VERSION = "v1"
SEER_ANOMALY_DETECTION_STORE_DATA_URL = f"/{SEER_ANOMALY_DETECTION_VERSION}/anomaly-detection/store"

UPTIME_REGIONS = [
    UptimeRegionConfig(
        slug="default",
        name="Default Region",
        config_topic=Topic.UPTIME_CONFIGS,
        enabled=True,
    ),
]


# Devserver configuration overrides.
ngrok_host = os.environ.get("SENTRY_DEVSERVER_NGROK")
if ngrok_host:
    SENTRY_OPTIONS["system.url-prefix"] = f"https://{ngrok_host}"
    SENTRY_OPTIONS["system.base-hostname"] = ngrok_host
    SENTRY_OPTIONS["system.region-api-url-template"] = ""

    # No multi-region in non-siloed ngrok dev.
    SENTRY_FEATURES["system:multi-region"] = False

    CSRF_TRUSTED_ORIGINS = [f"https://*.{ngrok_host}", f"https://{ngrok_host}"]
    ALLOWED_HOSTS = [f".{ngrok_host}", "localhost", "127.0.0.1", ".docker.internal"]

    SESSION_COOKIE_DOMAIN: str = f".{ngrok_host}"
    CSRF_COOKIE_DOMAIN = SESSION_COOKIE_DOMAIN
    SUDO_COOKIE_DOMAIN = SESSION_COOKIE_DOMAIN

if SILO_DEVSERVER:
    # Add connections for the region & control silo databases.
    DATABASES["control"] = DATABASES["default"].copy()
    DATABASES["control"]["NAME"] = "control"

    # Use the region database in the default connection as region
    # silo database is the 'default' elsewhere in application logic.
    DATABASES["default"]["NAME"] = "region"

    DATABASE_ROUTERS = ("sentry.db.router.SiloRouter",)

    # Addresses are hardcoded based on the defaults
    # we use in commands/devserver.
    region_port = os.environ.get("SENTRY_REGION_SILO_PORT", "8010")
    SENTRY_REGION_CONFIG = [
        {
            "name": "us",
            "snowflake_id": 1,
            "category": "MULTI_TENANT",
            "address": f"http://127.0.0.1:{region_port}",
            "api_token": "dev-region-silo-token",
        }
    ]
    SENTRY_MONOLITH_REGION = SENTRY_REGION_CONFIG[0]["name"]

    # Cross region RPC authentication
    RPC_SHARED_SECRET = [
        "a-long-value-that-is-shared-but-also-secret",
    ]
    RPC_TIMEOUT = 15.0
    SEER_RPC_SHARED_SECRET = ["seers-also-very-long-value-haha"]

    # Key for signing integration proxy requests.
    SENTRY_SUBNET_SECRET = "secret-subnet-signature"

    control_port = os.environ.get("SENTRY_CONTROL_SILO_PORT", "8000")
    SENTRY_CONTROL_ADDRESS = f"http://127.0.0.1:{control_port}"

    # Webserver config
    bind_address = os.environ.get("SENTRY_DEVSERVER_BIND")
    if bind_address:
        bind = str(bind_address).split(":")
        SENTRY_WEB_HOST = bind[0]
        SENTRY_WEB_PORT = int(bind[1])

    CELERYBEAT_SCHEDULE_FILENAME = f"celerybeat-schedule-{SILO_MODE}"

if ngrok_host and SILO_DEVSERVER:
    # In siloed mode + ngrok we enable multi-region so that
    # the region API URL template is set to the ngrok host.
    SENTRY_OPTIONS["system.region-api-url-template"] = f"https://{{region}}.{ngrok_host}"
    SENTRY_FEATURES["system:multi-region"] = True
