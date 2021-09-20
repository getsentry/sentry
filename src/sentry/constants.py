"""
These settings act as the default (base) settings for the Sentry-provided
web-server
"""

import logging
import os.path
from collections import OrderedDict, namedtuple
from datetime import timedelta
from typing import Dict, List, Optional, Sequence, Tuple

import sentry_relay
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

from sentry.utils.geo import rust_geoip
from sentry.utils.integrationdocs import load_doc


def get_all_languages() -> List[str]:
    results = []
    for path in os.listdir(os.path.join(MODULE_ROOT, "locale")):
        if path.startswith("."):
            continue
        if "_" in path:
            pre, post = path.split("_", 1)
            path = f"{pre}-{post.lower()}"
        results.append(path)
    return results


MODULE_ROOT = os.path.dirname(__import__("sentry").__file__)
DATA_ROOT = os.path.join(MODULE_ROOT, "data")

BAD_RELEASE_CHARS = "\r\n\f\x0c\t/\\"
MAX_VERSION_LENGTH = 200
MAX_COMMIT_LENGTH = 64
COMMIT_RANGE_DELIMITER = ".."

# semver constants
SEMVER_FAKE_PACKAGE = "__sentry_fake__"

SORT_OPTIONS = OrderedDict(
    (
        ("priority", _("Priority")),
        ("date", _("Last Seen")),
        ("new", _("First Seen")),
        ("freq", _("Frequency")),
    )
)

SEARCH_SORT_OPTIONS = OrderedDict(
    (("score", _("Score")), ("date", _("Last Seen")), ("new", _("First Seen")))
)

# XXX: Deprecated: use GroupStatus instead
STATUS_UNRESOLVED = 0
STATUS_RESOLVED = 1
STATUS_IGNORED = 2

# Normalize counts to the 15 minute marker. This value MUST be less than 60. A
# value of 0 would store counts for every minute, and is the lowest level of
# accuracy provided.
MINUTE_NORMALIZATION = 15

MAX_TAG_KEY_LENGTH = 32
MAX_TAG_VALUE_LENGTH = 200
MAX_CULPRIT_LENGTH = 200
MAX_EMAIL_FIELD_LENGTH = 75

ENVIRONMENT_NAME_PATTERN = r"^[^\n\r\f\/]*$"
ENVIRONMENT_NAME_MAX_LENGTH = 64

SENTRY_APP_SLUG_MAX_LENGTH = 64

# Maximum number of results we are willing to fetch when calculating rollup
# Clients should adapt the interval width based on their display width.
MAX_ROLLUP_POINTS = 10000


# Organization slugs which may not be used. Generally these are top level URL patterns
# which we don't want to worry about conflicts on.
RESERVED_ORGANIZATION_SLUGS = frozenset(
    (
        "admin",
        "manage",
        "login",
        "account",
        "register",
        "api",
        "accept",
        "organizations",
        "teams",
        "projects",
        "help",
        "docs",
        "logout",
        "404",
        "500",
        "_static",
        "out",
        "debug",
        "remote",
        "get-cli",
        "blog",
        "welcome",
        "features",
        "customers",
        "integrations",
        "signup",
        "pricing",
        "subscribe",
        "enterprise",
        "about",
        "jobs",
        "thanks",
        "guide",
        "privacy",
        "security",
        "terms",
        "from",
        "sponsorship",
        "for",
        "at",
        "platforms",
        "branding",
        "vs",
        "answers",
        "_admin",
        "support",
        "contact",
        "onboarding",
        "ext",
        "extension",
        "extensions",
        "plugins",
        "themonitor",
        "settings",
        "legal",
        "avatar",
        "organization-avatar",
        "project-avatar",
        "team-avatar",
        "careers",
        "_experiment",
        "sentry-apps",
        "resources",
        "integration-platform",
        "trust",
        "legal",
        "community",
        "referrals",
        "demo",
    )
)

RESERVED_PROJECT_SLUGS = frozenset(
    (
        "api-keys",
        "audit-log",
        "auth",
        "members",
        "projects",
        "rate-limits",
        "repos",
        "settings",
        "teams",
        "billing",
        "payments",
        "legal",
        "subscription",
        "support",
        "integrations",
        "developer-settings",
        "usage",
    )
)

LOG_LEVELS = {
    logging.NOTSET: "sample",
    logging.DEBUG: "debug",
    logging.INFO: "info",
    logging.WARNING: "warning",
    logging.ERROR: "error",
    logging.FATAL: "fatal",
}
DEFAULT_LOG_LEVEL = "error"
DEFAULT_LOGGER_NAME = ""
LOG_LEVELS_MAP = {v: k for k, v in LOG_LEVELS.items()}

# Default alerting threshold values
DEFAULT_ALERT_PROJECT_THRESHOLD = (500, 25)  # 500%, 25 events
DEFAULT_ALERT_GROUP_THRESHOLD = (1000, 25)  # 1000%, 25 events

# Default sort option for the group stream
DEFAULT_SORT_OPTION = "date"

# Setup languages for only available locales
_language_map = dict(settings.LANGUAGES)
LANGUAGES = [(k, _language_map[k]) for k in get_all_languages() if k in _language_map]
del _language_map

# TODO(dcramer): We eventually want to make this user-editable
TAG_LABELS = {
    "exc_type": "Exception Type",
    "sentry:user": "User",
    "sentry:release": "Release",
    "sentry:dist": "Distribution",
    "os": "OS",
    "url": "URL",
    "server_name": "Server",
}

PROTECTED_TAG_KEYS = frozenset(["environment", "release", "sentry:release"])

# Don't use this variable directly. If you want a list of rules that are registered in
# the system, access them via the `rules` registry in sentry/rules/__init__.py
_SENTRY_RULES = (
    "sentry.mail.actions.NotifyEmailAction",
    "sentry.rules.actions.notify_event.NotifyEventAction",
    "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
    "sentry.rules.conditions.every_event.EveryEventCondition",
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
    "sentry.rules.conditions.regression_event.RegressionEventCondition",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
    "sentry.rules.conditions.tagged_event.TaggedEventCondition",
    "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
    "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
    "sentry.rules.conditions.event_attribute.EventAttributeCondition",
    "sentry.rules.conditions.level.LevelCondition",
    "sentry.rules.filters.age_comparison.AgeComparisonFilter",
    "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
    "sentry.rules.filters.assigned_to.AssignedToFilter",
    "sentry.rules.filters.latest_release.LatestReleaseFilter",
    # The following filters are duplicates of their respective conditions and are conditionally shown if the user has issue alert-filters
    "sentry.rules.filters.event_attribute.EventAttributeFilter",
    "sentry.rules.filters.tagged_event.TaggedEventFilter",
    "sentry.rules.filters.level.LevelFilter",
)

MIGRATED_CONDITIONS = frozenset(
    [
        "sentry.rules.conditions.tagged_event.TaggedEventCondition",
        "sentry.rules.conditions.event_attribute.EventAttributeCondition",
        "sentry.rules.conditions.level.LevelCondition",
    ]
)

TICKET_ACTIONS = frozenset(
    [
        "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    ]
)

# methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
HTTP_METHODS = ("GET", "POST", "PUT", "OPTIONS", "HEAD", "DELETE", "TRACE", "CONNECT", "PATCH")

# See https://github.com/getsentry/relay/blob/master/relay-general/src/protocol/constants.rs
VALID_PLATFORMS = sentry_relay.VALID_PLATFORMS

OK_PLUGIN_ENABLED = _("The {name} integration has been enabled.")

OK_PLUGIN_DISABLED = _("The {name} integration has been disabled.")

OK_PLUGIN_SAVED = _("Configuration for the {name} integration has been saved.")

WARN_SESSION_EXPIRED = "Your session has expired."  # TODO: translate this

# Maximum length of a symbol
MAX_SYM = 256

# Known debug information file mimetypes
KNOWN_DIF_FORMATS: Dict[str, str] = {
    "text/x-breakpad": "breakpad",
    "application/x-mach-binary": "macho",
    "application/x-elf-binary": "elf",
    "application/x-dosexec": "pe",
    "application/x-ms-pdb": "pdb",
    "application/wasm": "wasm",
    "text/x-proguard+plain": "proguard",
    "application/x-sentry-bundle+zip": "sourcebundle",
    "application/x-bcsymbolmap": "bcsymbolmap",
    "application/x-debugid-map": "uuidmap",
}

NATIVE_UNKNOWN_STRING = "<unknown>"

# Maximum number of release files that can be "skipped" (i.e., maximum paginator offset)
# inside release files API endpoints.
# If this number is too large, it may cause problems because of inefficient
# LIMIT-OFFSET database queries.
# These problems should be solved after we implement artifact bundles workflow.
MAX_RELEASE_FILES_OFFSET = 20000

# to go from an integration id (in _platforms.json) to the platform
# data, such as documentation url or humanized name.
# example: java-logback -> {"type": "framework",
#                           "link": "https://docs.sentry.io/clients/java/integrations/#logback",
#                           "id": "java-logback",
#                           "name": "Logback"}
INTEGRATION_ID_TO_PLATFORM_DATA: Dict[str, Dict[str, str]] = {}


def _load_platform_data() -> None:
    INTEGRATION_ID_TO_PLATFORM_DATA.clear()
    data = load_doc("_platforms")

    if not data:
        return

    for platform in data["platforms"]:
        integrations = platform.pop("integrations")
        if integrations:
            for integration in integrations:
                integration_id = integration.pop("id")
                if integration["type"] != "language":
                    integration["language"] = platform["id"]
                INTEGRATION_ID_TO_PLATFORM_DATA[integration_id] = integration


_load_platform_data()

# special cases where the marketing slug differs from the integration id
# (in _platforms.json). missing values (for example: "java") should assume
# the marketing slug is the same as the integration id:
# javascript, node, python, php, ruby, go, swift, objc, java, perl, elixir
MARKETING_SLUG_TO_INTEGRATION_ID = {
    "kotlin": "java",
    "scala": "java",
    "spring": "java",
    "android": "java-android",
    "react": "javascript-react",
    "angular": "javascript-angular",
    "angular2": "javascript-angular2",
    "ember": "javascript-ember",
    "backbone": "javascript-backbone",
    "vue": "javascript-vue",
    "express": "node-express",
    "koa": "node-koa",
    "django": "python-django",
    "flask": "python-flask",
    "sanic": "python-sanic",
    "tornado": "python-tornado",
    "celery": "python-celery",
    "rq": "python-rq",
    "bottle": "python-bottle",
    "pythonawslambda": "python-awslambda",
    "pyramid": "python-pyramid",
    "pylons": "python-pylons",
    "laravel": "php-laravel",
    "symfony": "php-symfony2",
    "rails": "ruby-rails",
    "sinatra": "ruby-sinatra",
    "dotnet": "csharp",
}


# to go from a marketing page slug like /for/android/ to the integration id
# (in _platforms.json), for looking up documentation urls, etc.
def get_integration_id_for_marketing_slug(slug: str) -> Optional[str]:
    if slug in MARKETING_SLUG_TO_INTEGRATION_ID:
        return MARKETING_SLUG_TO_INTEGRATION_ID[slug]

    if slug in INTEGRATION_ID_TO_PLATFORM_DATA:
        return slug

    return None


# special cases where the integration sent with the SDK differ from
# the integration id (in _platforms.json)
# {PLATFORM: {INTEGRATION_SENT: integration_id, ...}, ...}
PLATFORM_INTEGRATION_TO_INTEGRATION_ID = {
    "java": {"java.util.logging": "java-logging"},
    # TODO: add more special cases...
}


# to go from event data to the integration id (in _platforms.json),
# for example an event like:
# {"platform": "java",
#  "sdk": {"name": "sentry-java",
#          "integrations": ["java.util.logging"]}} -> java-logging
def get_integration_id_for_event(
    platform: str, sdk_name: str, integrations: List[str]
) -> Optional[str]:
    if integrations:
        for integration in integrations:
            # check special cases
            if (
                platform in PLATFORM_INTEGRATION_TO_INTEGRATION_ID
                and integration in PLATFORM_INTEGRATION_TO_INTEGRATION_ID[platform]
            ):
                return PLATFORM_INTEGRATION_TO_INTEGRATION_ID[platform][integration]

            # try <platform>-<integration>, for example "java-log4j"
            integration_id = f"{platform}-{integration}"
            if integration_id in INTEGRATION_ID_TO_PLATFORM_DATA:
                return integration_id

    # try sdk name, for example "sentry-java" -> "java" or "raven-java:log4j" -> "java-log4j"
    sdk_name = sdk_name.lower().replace("sentry-", "").replace("raven-", "").replace(":", "-")
    if sdk_name in INTEGRATION_ID_TO_PLATFORM_DATA:
        return sdk_name

    # try platform name, for example "java"
    if platform in INTEGRATION_ID_TO_PLATFORM_DATA:
        return platform

    return None


class ObjectStatus:
    VISIBLE = 0
    HIDDEN = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3

    ACTIVE = 0
    DISABLED = 1

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            (cls.ACTIVE, "active"),
            (cls.DISABLED, "disabled"),
            (cls.PENDING_DELETION, "pending_deletion"),
            (cls.DELETION_IN_PROGRESS, "deletion_in_progress"),
        )


class SentryAppStatus:
    UNPUBLISHED = 0
    PUBLISHED = 1
    INTERNAL = 2
    PUBLISH_REQUEST_INPROGRESS = 3
    UNPUBLISHED_STR = "unpublished"
    PUBLISHED_STR = "published"
    INTERNAL_STR = "internal"
    PUBLISH_REQUEST_INPROGRESS_STR = "publish_request_inprogress"

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            (cls.UNPUBLISHED, cls.UNPUBLISHED_STR),
            (cls.PUBLISHED, cls.PUBLISHED_STR),
            (cls.INTERNAL, cls.INTERNAL_STR),
            (cls.PUBLISH_REQUEST_INPROGRESS, cls.PUBLISH_REQUEST_INPROGRESS_STR),
        )

    @classmethod
    def as_str(cls, status: int) -> Optional[str]:
        if status == cls.UNPUBLISHED:
            return cls.UNPUBLISHED_STR
        elif status == cls.PUBLISHED:
            return cls.PUBLISHED_STR
        elif status == cls.INTERNAL:
            return cls.INTERNAL_STR
        elif status == cls.PUBLISH_REQUEST_INPROGRESS:
            return cls.PUBLISH_REQUEST_INPROGRESS_STR
        else:
            return None


class SentryAppInstallationStatus:
    PENDING = 0
    INSTALLED = 1
    PENDING_STR = "pending"
    INSTALLED_STR = "installed"

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            (cls.PENDING, cls.PENDING_STR),
            (cls.INSTALLED, cls.INSTALLED_STR),
        )

    @classmethod
    def as_str(cls, status: int) -> Optional[str]:
        if status == cls.PENDING:
            return cls.PENDING_STR
        elif status == cls.INSTALLED:
            return cls.INSTALLED_STR
        else:
            return None


class ExportQueryType:
    ISSUES_BY_TAG = 0
    DISCOVER = 1
    ISSUES_BY_TAG_STR = "Issues-by-Tag"
    DISCOVER_STR = "Discover"

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return ((cls.ISSUES_BY_TAG, cls.ISSUES_BY_TAG_STR), (cls.DISCOVER, cls.DISCOVER_STR))

    @classmethod
    def as_str_choices(cls) -> Sequence[Tuple[str, str]]:
        return (
            (cls.ISSUES_BY_TAG_STR, cls.ISSUES_BY_TAG_STR),
            (cls.DISCOVER_STR, cls.DISCOVER_STR),
        )

    @classmethod
    def as_str(cls, integer: int) -> Optional[str]:
        if integer == cls.ISSUES_BY_TAG:
            return cls.ISSUES_BY_TAG_STR
        elif integer == cls.DISCOVER:
            return cls.DISCOVER_STR
        else:
            return None

    @classmethod
    def from_str(cls, string: str) -> Optional[int]:
        if string == cls.ISSUES_BY_TAG_STR:
            return cls.ISSUES_BY_TAG
        elif string == cls.DISCOVER_STR:
            return cls.DISCOVER
        else:
            return None


StatsPeriod = namedtuple("StatsPeriod", ("segments", "interval"))

LEGACY_RATE_LIMIT_OPTIONS = frozenset(("sentry:project-rate-limit", "sentry:account-rate-limit"))


# We need to limit the range of valid timestamps of an event because that
# timestamp is used to control data retention.
MAX_SECS_IN_FUTURE = 60
MAX_SECS_IN_PAST = 2592000  # 30 days
ALLOWED_FUTURE_DELTA = timedelta(seconds=MAX_SECS_IN_FUTURE)

DEFAULT_STORE_NORMALIZER_ARGS = dict(
    geoip_lookup=rust_geoip,
    max_secs_in_future=MAX_SECS_IN_FUTURE,
    max_secs_in_past=MAX_SECS_IN_PAST,
    enable_trimming=True,
)

INTERNAL_INTEGRATION_TOKEN_COUNT_MAX = 20

ALL_ACCESS_PROJECTS = {-1}

# Most number of events for the top-n graph
MAX_TOP_EVENTS = 5

# org option default values
PROJECT_RATE_LIMIT_DEFAULT = 100
ACCOUNT_RATE_LIMIT_DEFAULT = 0
REQUIRE_SCRUB_DATA_DEFAULT = False
REQUIRE_SCRUB_DEFAULTS_DEFAULT = False
SENSITIVE_FIELDS_DEFAULT = None
SAFE_FIELDS_DEFAULT = None
ATTACHMENTS_ROLE_DEFAULT = settings.SENTRY_DEFAULT_ROLE
DEBUG_FILES_ROLE_DEFAULT = "admin"
EVENTS_ADMIN_ROLE_DEFAULT = settings.SENTRY_DEFAULT_ROLE
REQUIRE_SCRUB_IP_ADDRESS_DEFAULT = False
SCRAPE_JAVASCRIPT_DEFAULT = True
TRUSTED_RELAYS_DEFAULT = None
JOIN_REQUESTS_DEFAULT = True
APDEX_THRESHOLD_DEFAULT = 300

# `sentry:events_member_admin` - controls whether the 'member' role gets the event:admin scope
EVENTS_MEMBER_ADMIN_DEFAULT = True
ALERTS_MEMBER_WRITE_DEFAULT = True

# Defined at https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
DataCategory = sentry_relay.DataCategory
