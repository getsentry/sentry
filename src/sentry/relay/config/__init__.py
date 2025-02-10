from __future__ import annotations

import logging
import uuid
from collections.abc import Iterable, Mapping, MutableMapping, Sequence
from datetime import datetime, timezone
from typing import Any, Literal, NotRequired, TypedDict

import sentry_sdk
from sentry_sdk import capture_exception

from sentry import features, killswitches, options, quotas, utils
from sentry.constants import HEALTH_CHECK_GLOBS, ObjectStatus
from sentry.datascrubbing import get_datascrubbing_settings, get_pii_config
from sentry.dynamic_sampling import generate_rules
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.ingest.inbound_filters import (
    FilterStatKeys,
    FilterTypes,
    _FilterSpec,
    get_all_filter_specs,
    get_filter_key,
    get_generic_filters,
)
from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.meta import get_clusterer_meta
from sentry.ingest.transaction_clusterer.rules import (
    TRANSACTION_NAME_RULE_TTL_SECS,
    get_sorted_rules,
)
from sentry.interfaces.security import DEFAULT_DISALLOWED_SOURCES
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.relay.config.experimental import TimeChecker, add_experimental_config
from sentry.relay.config.metric_extraction import (
    get_metric_conditional_tagging_rules,
    get_metric_extraction_config,
)
from sentry.relay.utils import to_camel_case_name
from sentry.sentry_metrics.use_case_id_registry import CARDINALITY_LIMIT_USE_CASES
from sentry.utils import metrics
from sentry.utils.http import get_origins
from sentry.utils.options import sample_modulo

from .measurements import CUSTOM_MEASUREMENT_LIMIT

# These features will be listed in the project config.
EXPOSABLE_FEATURES = [
    "organizations:continuous-profiling",
    "organizations:continuous-profiling-beta",
    "organizations:continuous-profiling-beta-ingest",
    "organizations:device-class-synthesis",
    "organizations:performance-queries-mongodb-extraction",
    "organizations:profiling",
    "organizations:session-replay-combined-envelope-items",
    "organizations:session-replay-recording-scrubbing",
    "organizations:session-replay-video-disabled",
    "organizations:session-replay",
    "organizations:standalone-span-ingestion",
    "projects:discard-transaction",
    "projects:profiling-ingest-unsampled-profiles",
    "projects:span-metrics-extraction",
    "projects:span-metrics-extraction-addons",
    "organizations:indexed-spans-extraction",
    "organizations:ingest-spans-in-eap",
    "projects:relay-otel-endpoint",
    "organizations:ourlogs-ingestion",
    "organizations:view-hierarchy-scrubbing",
    "projects:ourlogs-breadcrumb-extraction",
]

EXTRACT_METRICS_VERSION = 1
EXTRACT_ABNORMAL_MECHANISM_VERSION = 2

#: How often the transaction clusterer should run before we trust its output as "complete",
#: and start marking all URL transactions as sanitized.
MIN_CLUSTERER_RUNS = 10

logger = logging.getLogger(__name__)


def get_exposed_features(project: Project) -> Sequence[str]:
    active_features = []
    for feature in EXPOSABLE_FEATURES:
        if feature.startswith("organizations:"):
            has_feature = features.has(feature, project.organization)
        elif feature.startswith("projects:"):
            has_feature = features.has(feature, project)
        else:
            raise RuntimeError("EXPOSABLE_FEATURES must start with 'organizations:' or 'projects:'")

        if has_feature:
            metrics.incr(
                "sentry.relay.config.features",
                tags={"outcome": "enabled", "feature": feature},
            )
            active_features.append(feature)
        else:
            metrics.incr(
                "sentry.relay.config.features",
                tags={"outcome": "disabled", "feature": feature},
            )

    return active_features


def get_public_key_configs(
    project_keys: Iterable[ProjectKey] | None = None,
) -> list[Mapping[str, Any]]:
    public_keys: list[Mapping[str, Any]] = []
    for project_key in project_keys or ():
        key = {
            "publicKey": project_key.public_key,
            "numericId": project_key.id,
            # Disabled keys are omitted from the config, this is just there so
            # old Relays don't break (we haven't investigated whether there are
            # actual relays relying on this value)
            #
            # Removed that value in https://github.com/getsentry/relay/pull/778/files#diff-e66f275002251930fbfc361b4cca64ab41ff2435029f65c2fd6ffb729129909dL372
            "isEnabled": True,
        }

        public_keys.append(key)

    return public_keys


def get_filter_settings(project: Project) -> Mapping[str, Any]:
    filter_settings = {}

    for flt in get_all_filter_specs():
        filter_id = get_filter_key(flt)
        settings = _load_filter_settings(flt, project)

        if settings is not None and settings.get("isEnabled", True):
            filter_settings[filter_id] = settings

    error_messages: list[str] = []
    if features.has("projects:custom-inbound-filters", project):
        invalid_releases = project.get_option(f"sentry:{FilterTypes.RELEASES}")
        if invalid_releases:
            filter_settings["releases"] = {"releases": invalid_releases}

        error_messages += project.get_option(f"sentry:{FilterTypes.ERROR_MESSAGES}") or []

    if error_messages:
        filter_settings["errorMessages"] = {"patterns": error_messages}

    blacklisted_ips = project.get_option("sentry:blacklisted_ips")
    if blacklisted_ips:
        filter_settings["clientIps"] = {"blacklistedIps": blacklisted_ips}

    csp_disallowed_sources: list[str] = []
    if bool(project.get_option("sentry:csp_ignored_sources_defaults", True)):
        csp_disallowed_sources += DEFAULT_DISALLOWED_SOURCES
    csp_disallowed_sources += project.get_option("sentry:csp_ignored_sources", [])
    if csp_disallowed_sources:
        filter_settings["csp"] = {"disallowedSources": csp_disallowed_sources}

    if options.get("relay.emit-generic-inbound-filters"):
        try:
            # At the end we compute the generic inbound filters, which are inbound filters expressible with a
            # conditional DSL that Relay understands.
            generic_filters = get_generic_filters(project)
            if generic_filters is not None:
                filter_settings["generic"] = generic_filters
        except Exception as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Exception while building Relay project config: error building generic filters"
            )

    return filter_settings


def get_quotas(project: Project, keys: Iterable[ProjectKey] | None = None) -> list[str]:
    try:
        computed_quotas = [
            quota.to_json() for quota in quotas.backend.get_quotas(project, keys=keys)
        ]
    except BaseException:
        metrics.incr("relay.config.get_quotas", tags={"success": False}, sample_rate=1.0)
        raise
    else:
        metrics.incr("relay.config.get_quotas", tags={"success": True}, sample_rate=1.0)
        return computed_quotas


class SlidingWindow(TypedDict):
    windowSeconds: int
    granularitySeconds: int


class CardinalityLimit(TypedDict):
    id: str
    passive: NotRequired[bool]
    window: SlidingWindow
    limit: int
    scope: Literal["organization", "project"]
    namespace: str | None


class CardinalityLimitOption(TypedDict):
    rollout_rate: NotRequired[float]
    limit: CardinalityLimit
    projects: NotRequired[list[int]]


def get_metrics_config(timeout: TimeChecker, project: Project) -> Mapping[str, Any] | None:
    metrics_config = {}

    passive_limits = options.get("relay.cardinality-limiter.passive-limits-by-org").get(
        str(project.organization.id), []
    )

    existing_ids: set[str] = set()
    cardinality_limits: list[CardinalityLimit] = []
    for namespace in CARDINALITY_LIMIT_USE_CASES:
        timeout.check()
        option = options.get(f"sentry-metrics.cardinality-limiter.limits.{namespace.value}.per-org")
        if not option or not len(option) == 1:
            # Multiple quotas are not supported
            continue

        quota = option[0]
        id = namespace.value

        limit: CardinalityLimit = {
            "id": id,
            "window": {
                "windowSeconds": quota["window_seconds"],
                "granularitySeconds": quota["granularity_seconds"],
            },
            "limit": quota["limit"],
            "scope": "organization",
            "namespace": namespace.value,
        }
        if id in passive_limits:
            limit["passive"] = True
        cardinality_limits.append(limit)
        existing_ids.add(id)

    project_limit_options: list[CardinalityLimitOption] = project.get_option(
        "relay.cardinality-limiter.limits", []
    )
    organization_limit_options: list[CardinalityLimitOption] = project.organization.get_option(
        "relay.cardinality-limiter.limits", []
    )
    option_limit_options: list[CardinalityLimitOption] = options.get(
        "relay.cardinality-limiter.limits", []
    )

    for clo in project_limit_options + organization_limit_options + option_limit_options:
        rollout_rate = clo.get("rollout_rate", 1.0)
        if (project.organization.id % 100000) / 100000 >= rollout_rate:
            continue

        projects = clo.get("projects")
        if projects is not None and project.id not in projects:
            # projects list is defined but the current project is not in the list
            continue

        try:
            limit = clo["limit"]
            if clo["limit"]["id"] in existing_ids:
                # skip if a limit with the same id already exists
                continue
            cardinality_limits.append(limit)
            existing_ids.add(clo["limit"]["id"])
        except KeyError:
            pass

    metrics_config["cardinalityLimits"] = cardinality_limits

    return metrics_config or None


def get_project_config(
    project: Project, project_keys: Iterable[ProjectKey] | None = None
) -> ProjectConfig:
    """Constructs the ProjectConfig information.
    :param project: The project to load configuration for. Ensure that
        organization is bound on this object; otherwise it will be loaded from
        the database.
    :param project_keys: Pre-fetched project keys for performance. However, if
        no project keys are provided it is assumed that the config does not
        need to contain auth information (this is the case when used in
        python's StoreView)
    :return: a ProjectConfig object for the given project
    """
    with sentry_sdk.isolation_scope() as scope:
        scope.set_tag("project", project.id)
        with (
            sentry_sdk.start_transaction(name="get_project_config"),
            metrics.timer("relay.config.get_project_config.duration"),
        ):
            return _get_project_config(project, project_keys=project_keys)


def get_dynamic_sampling_config(timeout: TimeChecker, project: Project) -> Mapping[str, Any] | None:
    if options.get("dynamic-sampling.config.killswitch"):
        # This killswitch will cause extra load, and should only be used for AM1->AM2 migration.
        return None

    if features.has("organizations:dynamic-sampling", project.organization):
        return {"version": 2, "rules": generate_rules(project)}

    return None


class TransactionNameRuleScope(TypedDict):
    source: Literal["url"]


class TransactionNameRuleRedaction(TypedDict):
    method: Literal["replace"]
    substitution: str


class TransactionNameRule(TypedDict):
    pattern: str
    expiry: str
    redaction: TransactionNameRuleRedaction


def get_transaction_names_config(
    timeout: TimeChecker, project: Project
) -> Sequence[TransactionNameRule] | None:
    if not features.has("organizations:transaction-name-normalize", project.organization):
        return None

    cluster_rules = get_sorted_rules(ClustererNamespace.TRANSACTIONS, project)
    timeout.check()
    if not cluster_rules:
        return None

    return [_get_tx_name_rule(p, s) for p, s in cluster_rules]


def _get_tx_name_rule(pattern: str, seen_last: int) -> TransactionNameRule:
    rule_ttl = seen_last + TRANSACTION_NAME_RULE_TTL_SECS
    expiry_at = datetime.fromtimestamp(rule_ttl, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    return TransactionNameRule(
        pattern=pattern,
        expiry=expiry_at,
        # Some more hardcoded fields for future compatibility. These are not
        # currently used.
        redaction={"method": "replace", "substitution": "*"},
    )


class SpanDescriptionScope(TypedDict):
    op: Literal["http"]
    """Top scope to match on. Subscopes match all top scopes; for example, the
    scope `http` matches `http.client` and `http.server` operations."""


class SpanDescriptionRuleRedaction(TypedDict):
    method: Literal["replace"]
    substitution: str


class SpanDescriptionRule(TypedDict):
    pattern: str
    expiry: str
    scope: SpanDescriptionScope
    redaction: SpanDescriptionRuleRedaction


def _should_extract_abnormal_mechanism(project: Project) -> bool:
    return sample_modulo(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
        project.organization_id,
    )


def _get_desktop_browser_performance_profiles(
    organization: Organization,
) -> list[dict[str, Any]]:
    return [
        {
            "name": "Chrome",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Chrome",
            },
        },
        {
            "name": "Firefox",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": True,  # Only available on Firefox 122 and beyond
                },
                {
                    "measurement": "cls",
                    "weight": 0.0,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": False,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Firefox",
            },
        },
        {
            "name": "Safari",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.0,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": False,
                },
                {
                    "measurement": "cls",
                    "weight": 0.0,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": False,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Safari",
            },
        },
        {
            "name": "Edge",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Edge",
            },
        },
        {
            "name": "Opera",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Opera",
            },
        },
        {
            "name": "Chrome INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "event.contexts.browser.name",
                        "value": "Chrome",
                    },
                    {
                        "op": "eq",
                        "name": "event.contexts.browser.name",
                        "value": "Google Chrome",
                    },
                ],
            },
        },
        {
            "name": "Edge INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Edge",
            },
        },
        {
            "name": "Opera INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Opera",
            },
        },
    ]


def _get_mobile_browser_performance_profiles(
    organization: Organization,
) -> list[dict[str, Any]]:
    return [
        {
            "name": "Chrome Mobile",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 800.0,
                    "p50": 1800.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Chrome Mobile",
            },
        },
        {
            "name": "Firefox Mobile",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": True,  # Only available on Firefox 122 and beyond
                },
                {
                    "measurement": "cls",
                    "weight": 0.0,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": False,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 800.0,
                    "p50": 1800.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Firefox Mobile",
            },
        },
        {
            "name": "Safari Mobile",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.0,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": False,
                },
                {
                    "measurement": "cls",
                    "weight": 0.0,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": False,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 800.0,
                    "p50": 1800.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Mobile Safari",
            },
        },
        {
            "name": "Edge Mobile",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 800.0,
                    "p50": 1800.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Edge Mobile",
            },
        },
        {
            "name": "Opera Mobile",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 800.0,
                    "p50": 1800.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Opera Mobile",
            },
        },
        {
            "name": "Chrome Mobile INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "event.contexts.browser.name",
                        "value": "Chrome Mobile",
                    },
                ],
            },
        },
        {
            "name": "Edge Mobile INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Edge Mobile",
            },
        },
        {
            "name": "Opera Mobile INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Opera Mobile",
            },
        },
    ]


def _get_default_browser_performance_profiles(
    organization: Organization,
) -> list[dict[str, Any]]:
    return [
        {
            "name": "Default",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": True,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.30,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": True,
                },
                {
                    "measurement": "cls",
                    "weight": 0.15,
                    "p10": 0.1,
                    "p50": 0.25,
                    "optional": True,
                },
                {
                    "measurement": "ttfb",
                    "weight": 0.10,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "and",
                "inner": [],
            },
        },
        {
            "name": "Default INP",
            "scoreComponents": [
                {
                    "measurement": "inp",
                    "weight": 1.0,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "and",
                "inner": [],
            },
        },
    ]


def _get_mobile_performance_profiles(
    organization: Organization,
) -> list[dict[str, Any]]:
    if not features.has(
        "organizations:performance-calculate-mobile-perf-score-relay", organization
    ):
        return []

    return [
        {
            "name": "Mobile",
            "version": "mobile.alpha",
            "scoreComponents": [
                {
                    "measurement": "time_to_initial_display",
                    "weight": 0.25,
                    "p10": 1800.0,
                    "p50": 3000.0,
                    "optional": True,
                },
                {
                    "measurement": "time_to_full_display",
                    "weight": 0.25,
                    "p10": 2500.0,
                    "p50": 4000.0,
                    "optional": True,
                },
                {
                    "measurement": "app_start_warm",
                    "weight": 0.25,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": True,
                },
                {
                    "measurement": "app_start_cold",
                    "weight": 0.25,
                    "p10": 200.0,
                    "p50": 500.0,
                    "optional": True,
                },
            ],
            "condition": {
                "op": "and",
                "inner": [
                    {
                        "op": "or",
                        "inner": [
                            {
                                "op": "eq",
                                "name": "event.sdk.name",
                                "value": "sentry.cocoa",
                            },
                            {
                                "op": "eq",
                                "name": "event.sdk.name",
                                "value": "sentry.java.android",
                            },
                        ],
                    },
                    {"op": "eq", "name": "event.contexts.trace.op", "value": "ui.load"},
                ],
            },
        }
    ]


def _get_project_config(
    project: Project, project_keys: Iterable[ProjectKey] | None = None
) -> ProjectConfig:
    if project.status != ObjectStatus.ACTIVE:
        return ProjectConfig(project, disabled=True)

    public_keys = get_public_key_configs(project_keys=project_keys)

    with sentry_sdk.start_span(op="get_public_config"):
        now = datetime.now(timezone.utc)
        cfg = {
            "disabled": False,
            "slug": project.slug,
            "lastFetch": now,
            "lastChange": now,
            "rev": uuid.uuid4().hex,
            "publicKeys": public_keys,
            "config": {
                "allowedDomains": list(get_origins(project)),
                "trustedRelays": [
                    r["public_key"]
                    for r in project.organization.get_option("sentry:trusted-relays", [])
                    if r
                ],
                "piiConfig": get_pii_config(project),
                "datascrubbingSettings": get_datascrubbing_settings(project),
            },
            "organizationId": project.organization_id,
            "projectId": project.id,  # XXX: Unused by Relay, required by Python store
        }

    config = cfg["config"]

    with sentry_sdk.start_span(op="get_exposed_features"):
        if exposed_features := get_exposed_features(project):
            config["features"] = exposed_features

    # NOTE: Omitting dynamicSampling because of a failure increases the number
    # of events forwarded by Relay, because dynamic sampling will stop filtering
    # anything.
    add_experimental_config(config, "sampling", get_dynamic_sampling_config, project)

    # Rules to replace high cardinality transaction names
    add_experimental_config(config, "txNameRules", get_transaction_names_config, project)

    # Mark the project as ready if it has seen >= 10 clusterer runs.
    # This prevents projects from prematurely marking all URL transactions as sanitized.
    if get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project)["runs"] >= MIN_CLUSTERER_RUNS:
        config["txNameReady"] = True

    config["breakdownsV2"] = project.get_option("sentry:breakdowns")

    add_experimental_config(config, "metrics", get_metrics_config, project)

    if _should_extract_transaction_metrics(project):
        add_experimental_config(
            config,
            "transactionMetrics",
            get_transaction_metrics_settings,
            project,
            config.get("breakdownsV2"),
        )

        # This config key is technically not specific to _transaction_ metrics,
        # is however currently both only applied to transaction metrics in
        # Relay, and only used to tag transaction metrics in Sentry.
        add_experimental_config(
            config,
            "metricConditionalTagging",
            get_metric_conditional_tagging_rules,
            project,
        )

        if metric_extraction := get_metric_extraction_config(project):
            config["metricExtraction"] = metric_extraction

    config["sessionMetrics"] = {
        "version": (
            EXTRACT_ABNORMAL_MECHANISM_VERSION
            if _should_extract_abnormal_mechanism(project)
            else EXTRACT_METRICS_VERSION
        ),
    }

    performance_score_profiles = [
        *_get_desktop_browser_performance_profiles(project.organization),
        *_get_mobile_browser_performance_profiles(project.organization),
        *_get_mobile_performance_profiles(project.organization),
        *_get_default_browser_performance_profiles(project.organization),
    ]
    if performance_score_profiles:
        config["performanceScore"] = {"profiles": performance_score_profiles}

    with sentry_sdk.start_span(op="get_filter_settings"):
        if filter_settings := get_filter_settings(project):
            config["filterSettings"] = filter_settings
    with sentry_sdk.start_span(op="get_grouping_config_dict_for_project"):
        grouping_config = get_grouping_config_dict_for_project(project)
        if grouping_config is not None:
            config["groupingConfig"] = grouping_config
    with sentry_sdk.start_span(op="get_event_retention"):
        event_retention = quotas.backend.get_event_retention(project.organization)
        if event_retention is not None:
            config["eventRetention"] = event_retention
    with sentry_sdk.start_span(op="get_all_quotas"):
        if quotas_config := get_quotas(project, keys=project_keys):
            config["quotas"] = quotas_config

    return ProjectConfig(project, **cfg)


class _ConfigBase:
    """
    Base class for configuration objects
    Offers a readonly configuration class that can be serialized to json and viewed as a simple dictionary
    >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
    >>> x.a
    1
    >>> x.b
    'The b'
    >>> x.something is None # accessing non-existing elements
    True
    >>> x.c.y.w
    [1, 2, 3]
    """

    def __init__(self, **kwargs: Any) -> None:
        data: MutableMapping[str, Any] = {}
        object.__setattr__(self, "data", data)
        for key, val in kwargs.items():
            if val is not None:
                data[key] = val

    def __setattr__(self, key: str, value: Any) -> None:
        raise Exception("Trying to change read only ProjectConfig object")

    def __getattr__(self, name: str) -> Any | Mapping[str, Any]:
        data = self.__get_data()
        return data.get(to_camel_case_name(name))

    def to_dict(self) -> MutableMapping[str, Any]:
        """
        Converts the config object into a dictionary
        :return: A dictionary containing the object properties, with config properties also converted in dictionaries
        >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
        >>> x.to_dict() == {'a': 1, 'c': {'y': {'m': 3.14159, 'w': [1, 2, 3], 'z':{'t': 1}}, 'x': 33}, 'b': 'The b'}
        True
        """
        data = self.__get_data()
        return {
            key: value.to_dict() if isinstance(value, _ConfigBase) else value
            for (key, value) in data.items()
        }

    def to_json_string(self) -> Any:
        """
        >>> x = _ConfigBase( a = _ConfigBase(b = _ConfigBase( w=[1,2,3])))
        >>> x.to_json_string()
        '{"a": {"b": {"w": [1, 2, 3]}}}'
        :return:
        """
        data = self.to_dict()
        return utils.json.dumps(data)

    def get_at_path(self, *args: str) -> Any:
        """
        Gets an element at the specified path returning None if the element or the path doesn't exists
        :param args: the path to follow ( a list of strings)
        :return: the element if present at specified path or None otherwise)
        >>> x = _ConfigBase( a= 1, b="The b", c= _ConfigBase(x=33, y = _ConfigBase(m=3.14159 , w=[1,2,3], z={'t':1})))
        >>> x.get_at_path('c','y','m')
        3.14159
        >>> x.get_at_path('bb') is None # property not set
        True
        >>> x.get_at_path('a', 'something') is None # trying to go past existing Config paths
        True
        >>> x.get_at_path('c','y','z')
        {'t': 1}
        >>> x.get_at_path('c','y','z','t') is None # only navigates in ConfigBase does not try to go into normal dicts.
        True
        """
        if len(args) == 0:
            return self

        data = self.__get_data()
        val = data.get(args[0])

        if len(args) == 1:
            return val

        if isinstance(val, _ConfigBase):
            return val.get_at_path(*args[1:])

        return None  # property not set or path goes beyond the Config defined valid path

    def __get_data(self) -> Mapping[str, Any]:
        return object.__getattribute__(self, "data")

    def __str__(self) -> str:
        try:
            return utils.json.dumps(self.to_dict(), sort_keys=True)  # type: ignore[arg-type]
        except Exception as e:
            return f"Content Error:{e}"

    def __repr__(self) -> str:
        return f"({self.__class__.__name__}){self}"


class ProjectConfig(_ConfigBase):
    """
    Represents the restricted configuration available to an untrusted
    """

    def __init__(self, project: Project, **kwargs: Any) -> None:
        object.__setattr__(self, "project", project)

        super().__init__(**kwargs)


def _load_filter_settings(flt: _FilterSpec, project: Project) -> Mapping[str, Any]:
    """
    Returns the filter settings for the specified project
    :param flt: the filter function
    :param project: the project for which we want to retrieve the options
    :return: a dictionary with the filter options.
        If the project does not explicitly specify the filter options then the
        default options for the filter will be returned
    """
    filter_id = flt.id
    filter_key = f"filters:{filter_id}"

    setting = project.get_option(filter_key)

    return _filter_option_to_config_setting(flt, setting)


def _filter_option_to_config_setting(flt: _FilterSpec, setting: str) -> Mapping[str, Any]:
    """
    Encapsulates the logic for associating a filter database option with the filter setting from project_config
    :param flt: the filter
    :param setting: the option deserialized from the database
    :return: the option as viewed from project_config
    """
    if setting is None:
        raise ValueError(
            "Could not find filter state for filter {}."
            " You need to register default filter state in projectoptions.defaults.".format(flt.id)
        )

    is_enabled = setting != "0"

    ret_val: dict[str, bool | Sequence[str]] = {"isEnabled": is_enabled}

    # special case for legacy browser.
    # If the number of special cases increases we'll have to factor this functionality somewhere
    if flt.id == FilterStatKeys.LEGACY_BROWSER:
        if is_enabled:
            if setting == "1":
                ret_val["options"] = ["default"]
            else:
                # new style filter, per legacy browser type handling
                # ret_val['options'] = setting.split(' ')
                ret_val["options"] = list(setting)
    elif flt.id == FilterStatKeys.HEALTH_CHECK:
        if is_enabled:
            ret_val = {"patterns": HEALTH_CHECK_GLOBS, "isEnabled": True}
        else:
            ret_val = {"patterns": [], "isEnabled": False}
    return ret_val


#: Version of the transaction metrics extraction.
#: When you increment this version, outdated Relays will stop extracting
#: transaction metrics.
#: See https://github.com/getsentry/relay/blob/6181c6e80b9485ed394c40bc860586ae934704e2/relay-dynamic-config/src/metrics.rs#L85
TRANSACTION_METRICS_EXTRACTION_VERSION = 6


class CustomMeasurementSettings(TypedDict):
    limit: int


TransactionNameStrategy = Literal["strict", "clientBased"]


class TransactionMetricsSettings(TypedDict):
    version: int
    extractCustomTags: list[str]
    customMeasurements: CustomMeasurementSettings
    acceptTransactionNames: TransactionNameStrategy


def _should_extract_transaction_metrics(project: Project) -> bool:
    return features.has(
        "organizations:transaction-metrics-extraction", project.organization
    ) and not killswitches.killswitch_matches_context(
        "relay.drop-transaction-metrics", {"project_id": project.id}
    )


def get_transaction_metrics_settings(
    timeout: TimeChecker, project: Project, breakdowns_config: Mapping[str, Any] | None
) -> TransactionMetricsSettings:
    """This function assumes that the corresponding feature flag has been checked.
    See _should_extract_transaction_metrics.
    """
    custom_tags: list[str] = []

    if breakdowns_config is not None:
        # we already have a breakdown configuration that tells relay which
        # breakdowns to compute for an event. metrics extraction should
        # probably be in sync with that, or at least not extract more metrics
        # than there are breakdowns configured.
        try:
            for _, breakdown_config in breakdowns_config.items():
                assert breakdown_config["type"] == "spanOperations"

        except Exception:
            capture_exception()

    # Tells relay which user-defined tags to add to each extracted
    # transaction metric.  This cannot include things such as `os.name`
    # which are computed on the server, they have to come from the SDK as
    # event tags.
    try:
        custom_tags.extend(project.get_option("sentry:transaction_metrics_custom_tags") or ())
    except Exception:
        capture_exception()

    return {
        "version": TRANSACTION_METRICS_EXTRACTION_VERSION,
        "extractCustomTags": custom_tags,
        "customMeasurements": {"limit": CUSTOM_MEASUREMENT_LIMIT},
        "acceptTransactionNames": "clientBased",
    }
