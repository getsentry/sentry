"""
These settings act as the default (base) settings for the Sentry-provided
web-server
"""

import logging
import os.path
from collections import namedtuple
from datetime import timedelta
from typing import Dict, List, Optional, Sequence, Tuple, cast

import sentry_relay
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from typing_extensions import TypeAlias

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


MODULE_ROOT = os.path.dirname(cast(str, __import__("sentry").__file__))
DATA_ROOT = os.path.join(MODULE_ROOT, "data")

BAD_RELEASE_CHARS = "\r\n\f\x0c\t/\\"
MAX_VERSION_LENGTH = 200
MAX_COMMIT_LENGTH = 64
COMMIT_RANGE_DELIMITER = ".."

# semver constants
SEMVER_FAKE_PACKAGE = "__sentry_fake__"

SORT_OPTIONS = {
    "priority": _("Priority"),
    "date": _("Last Seen"),
    "new": _("First Seen"),
    "freq": _("Frequency"),
}

SEARCH_SORT_OPTIONS = {
    "score": _("Score"),
    "date": _("Last Seen"),
    "new": _("First Seen"),
}

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
        "404",
        "500",
        "_admin",
        "_experiment",
        "_static",
        "about",
        "accept",
        "access",
        "account",
        "accountspayable",
        "acl",
        "admin",
        "answers",
        "ap",
        "api",
        "app",
        "at",
        "au1",
        "auth",
        "authentication",
        "avatar",
        "billing",
        "blog",
        "branding",
        "careers",
        "client",
        "clients",
        "community",
        "contact",
        "corp",
        "customers",
        "de",
        "debug",
        "devinfra",
        "docs",
        "enterprise",
        "eu",
        "events",
        "expenses",
        "ext",
        "extension",
        "extensions",
        "features",
        "finance",
        "for",
        "from",
        "get-cli",
        "github-deployment-gate",
        "guide",
        "help",
        "ingest",
        "integration-platform",
        "integrations",
        "invoice",
        "invoices",
        "ja",
        "jobs",
        "legal",
        "login",
        "logout",
        "lp",
        "mail",
        "manage",
        "my",
        "onboarding",
        "organization-avatar",
        "organizations",
        "out",
        "payment",
        "payments",
        "platforms",
        "plugins",
        "policy",
        "pricing",
        "privacy",
        "project-avatar",
        "projects",
        "receipt",
        "receipts",
        "referrals",
        "register",
        "remote",
        "resources",
        "sa1",
        "sales",
        "security",
        "sentry-apps",
        "settings",
        "signup",
        "sponsorship",
        "ssh",
        "sso",
        "staff",
        "subscribe",
        "support",
        "team-avatar",
        "teams",
        "terms",
        "thanks",
        "themonitor",
        "trust",
        "us",
        "vs",
        "welcome",
    )
)

RESERVED_PROJECT_SLUGS = frozenset(
    (
        "$all",
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
    "sentry.rules.actions.sentry_apps.notify_event.NotifyEventSentryAppAction",
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
    "sentry.rules.filters.issue_category.IssueCategoryFilter",
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

SENTRY_APP_ACTIONS = frozenset(
    ["sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction"]
)

# methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
HTTP_METHODS = ("GET", "POST", "PUT", "OPTIONS", "HEAD", "DELETE", "TRACE", "CONNECT", "PATCH")

# See https://github.com/getsentry/relay/blob/master/relay-general/src/protocol/constants.rs
VALID_PLATFORMS = sentry_relay.VALID_PLATFORMS

OK_PLUGIN_ENABLED = _("The {name} integration has been enabled.")

OK_PLUGIN_DISABLED = _("The {name} integration has been disabled.")

OK_PLUGIN_SAVED = _("Configuration for the {name} integration has been saved.")

WARN_SESSION_EXPIRED = _("Your session has expired.")

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
    "application/x-il2cpp-json": "il2cpp",
    "application/x-portable-pdb": "portablepdb",
}

NATIVE_UNKNOWN_STRING = "<unknown>"

# Maximum number of release files that can be "skipped" (i.e., maximum paginator offset)
# inside release files API endpoints.
# If this number is too large, it may cause problems because of inefficient
# LIMIT-OFFSET database queries.
# These problems should be solved after we implement artifact bundles workflow.
MAX_RELEASE_FILES_OFFSET = 20000
MAX_ARTIFACT_BUNDLE_FILES_OFFSET = MAX_RELEASE_FILES_OFFSET

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
    DELETION_IN_PROGRESS = 4
    UNPUBLISHED_STR = "unpublished"
    PUBLISHED_STR = "published"
    INTERNAL_STR = "internal"
    PUBLISH_REQUEST_INPROGRESS_STR = "publish_request_inprogress"
    DELETION_IN_PROGRESS_STR = "deletion_in_progress"

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            (cls.UNPUBLISHED, cls.UNPUBLISHED_STR),
            (cls.PUBLISHED, cls.PUBLISHED_STR),
            (cls.INTERNAL, cls.INTERNAL_STR),
            (cls.PUBLISH_REQUEST_INPROGRESS, cls.PUBLISH_REQUEST_INPROGRESS_STR),
            (cls.DELETION_IN_PROGRESS, cls.DELETION_IN_PROGRESS_STR),
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
        elif status == cls.DELETION_IN_PROGRESS:
            return cls.DELETION_IN_PROGRESS_STR
        else:
            return None

    @classmethod
    def as_int(cls, status: str) -> Optional[int]:
        if status == cls.UNPUBLISHED_STR:
            return cls.UNPUBLISHED
        elif status == cls.PUBLISHED_STR:
            return cls.PUBLISHED
        elif status == cls.INTERNAL_STR:
            return cls.INTERNAL
        elif status == cls.PUBLISH_REQUEST_INPROGRESS_STR:
            return cls.PUBLISH_REQUEST_INPROGRESS
        elif status == cls.DELETION_IN_PROGRESS_STR:
            return cls.DELETION_IN_PROGRESS
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
ALL_ACCESS_PROJECTS_SLUG = "$all"

# Most number of events for the top-n graph
MAX_TOP_EVENTS = 10

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
AI_SUGGESTED_SOLUTION = True
GITHUB_PR_BOT_DEFAULT = True

# `sentry:events_member_admin` - controls whether the 'member' role gets the event:admin scope
EVENTS_MEMBER_ADMIN_DEFAULT = True
ALERTS_MEMBER_WRITE_DEFAULT = True

# Defined at https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
DataCategory: TypeAlias = sentry_relay.DataCategory

CRASH_RATE_ALERT_SESSION_COUNT_ALIAS = "_total_count"
CRASH_RATE_ALERT_AGGREGATE_ALIAS = "_crash_rate_alert_aggregate"

# Dynamic sampling denylist composed manually from
# 1. `src/sentry/event_manager.py:save`. We have function
# `_derive_interface_tags_many(jobs)` which iterates across all interfaces
# and execute `iter_tags`, so i've searched usage of `iter_tags`.
# 2. `src/sentry/event_manager.py:_pull_out_data` we have `set_tag`.
# 3. `src/sentry/event_manager.py:_get_event_user_many` we have `set_tag`.
# 4. `src/sentry/event_manager.py:_get_or_create_release_many` we have `set_tag`.
# 5. `src/sentry/interfaces/exception.py:Mechanism` we have `iter_tags`.
# 6. `src/sentry/plugins/sentry_urls/models.py:UrlsPlugin`.
# 7. `sentry/src/sentry/plugins/sentry_interface_types/models.py`.
# 8. `src/sentry/plugins/sentry_useragents/models.py:UserAgentPlugin`.
# Note:
# should be sorted alphabetically so that it is easy to maintain in future
# if you update this list please add explanation or source of it
DS_DENYLIST = frozenset(
    [
        "app.device",
        "browser",
        "browser.name",
        "device",
        "device.family",
        "environment",
        "gpu.name",
        "gpu.vendor",
        "handled",
        "interface_type",
        "level",
        "logger",
        "mechanism",
        "monitor.id",
        "os",
        "os.name",
        "os.rooted",
        "runtime",
        "runtime.name",
        "sentry:dist",
        "sentry:release",
        "sentry:user",
        "transaction",
        "url",
    ]
)


# DESCRIBES the globs used to check if a transaction is for a healthcheck endpoint
# https://kubernetes.io/docs/reference/using-api/health-checks/
# Also it covers: livez, readyz
HEALTH_CHECK_GLOBS = [
    "*healthcheck*",
    "*healthy*",
    "*live*",
    "*ready*",
    "*heartbeat*",
    "*/health",
    "*/healthz",
    "*/ping",
]
