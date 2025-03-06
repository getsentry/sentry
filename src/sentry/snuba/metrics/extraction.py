from __future__ import annotations

import hashlib
import logging
import os
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal, NamedTuple, NotRequired, Optional, Self, TypedDict, TypeVar, cast

import sentry_sdk
from django.utils.functional import cached_property

from sentry import features
from sentry.api import event_search
from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    QueryOp,
    QueryToken,
    SearchFilter,
    SearchKey,
    SearchValue,
)
from sentry.constants import DataCategory
from sentry.discover.arithmetic import is_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.options.rollout import in_random_rollout
from sentry.relay.types import RuleCondition
from sentry.search.events import fields
from sentry.search.events.builder.discover import UnresolvedQuery
from sentry.search.events.constants import VITAL_THRESHOLDS
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, parse_mri
from sentry.snuba.metrics.utils import MetricOperationType
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.snuba import is_measurement, is_span_op_breakdown, resolve_column

logger = logging.getLogger(__name__)

SPEC_VERSION_TWO_FLAG = "organizations:on-demand-metrics-query-spec-version-two"
# Certain functions will only be supported with certain feature flags
OPS_REQUIRE_FEAT_FLAG = {
    "count_unique": SPEC_VERSION_TWO_FLAG,
    "user_misery": SPEC_VERSION_TWO_FLAG,
}

# Splits the bulk cache for on-demand resolution into N chunks
WIDGET_QUERY_CACHE_MAX_CHUNKS = 6


# This helps us control the different spec versions
# in order to migrate customers from invalid specs
class SpecVersion(NamedTuple):
    version: int
    flags: set[str] = set()


class OnDemandMetricSpecVersioning:
    """
    This class helps iterate over all spec versions we support with get_spec_versions.

    If spec_versions only has one item that means we only have one metric spec being collected.

    In order to add a new spec version update spec_versions with the flags which you will use
    within OnDemandMetricSpec. You also need to adjust get_query_spec_version to return the spec
    version you want for a specific feature flag.

    Once we're ready to abandon a version:
    - coalesce the spec_versions
    - clear the feature/flags mapping in get_query_spec_version
    - remove any associated customizations to OnDemandMetricSpec

    When there's a single version we should not have any flags and get_query_spec_version
    should return the default spec version.
    """

    spec_versions = [
        SpecVersion(1),
        SpecVersion(2, {"include_environment_tag"}),
    ]

    @classmethod
    def get_query_spec_version(cls: Any, organization_id: int) -> SpecVersion:
        """Return spec version based on feature flag enabled for an organization."""
        org = Organization.objects.get_from_cache(id=organization_id)
        if features.has(SPEC_VERSION_TWO_FLAG, org):
            return cls.spec_versions[1]
        return cls.spec_versions[0]

    @classmethod
    def get_spec_versions(cls: Any) -> Sequence[SpecVersion]:
        """Get all spec versions."""
        return cls.spec_versions

    @classmethod
    def get_default_spec_version(cls: Any) -> SpecVersion:
        return cls.spec_versions[0]


# Name component of MRIs used for custom alert metrics.
CUSTOM_ALERT_METRIC_NAME = "transactions/on_demand"
QUERY_HASH_KEY = "query_hash"

# Comparison operators used by Relay.
CompareOp = Literal["eq", "gt", "gte", "lt", "lte", "glob"]

# There are some search tokens that are exclusive to searching errors, thus, we need
# to treat the query as not on-demand.
ERROR_RELATED_TOKENS = ["level", "assignee", "issue", "culprit"]

# Maps from Discover's field names to event protocol paths. See Relay's
# ``Getter`` implementation for ``Event`` for supported fields. All fields need to be prefixed
# with "event.".
# List of UI supported search fields is defined in sentry/static/app/utils/fields/index.ts
_SEARCH_TO_PROTOCOL_FIELDS = {
    # Top-level fields
    "release": "release",
    "dist": "dist",
    "environment": "environment",
    "transaction": "transaction",
    "platform": "platform",
    "platform.name": "platform",
    "level": "level",
    "logger": "logger",
    # Top-level structures ("interfaces")
    # sentry_user is a special field added for on-demand metrics
    # https://github.com/getsentry/relay/pull/3122
    "user": "sentry_user",
    "user.email": "user.email",
    "user.id": "user.id",
    "user.ip": "user.ip_address",
    "user.username": "user.name",
    "user.segment": "user.segment",
    "geo.city": "user.geo.city",
    "geo.country_code": "user.geo.country_code",
    "geo.region": "user.geo.region",
    "geo.subdivision": "user.geo.subdivision",
    "http.method": "request.method",
    "http.url": "request.url",
    "http.referer": "request.headers.Referer",
    "transaction.source": "transaction.source",
    # url is a tag extracted by Sentry itself, on Relay it's received as `request.url`
    "url": "request.url",
    "sdk.name": "sdk.name",
    "sdk.version": "sdk.version",
    # Subset of context fields
    "app.in_foreground": "contexts.app.in_foreground",
    "app.device": "contexts.app.device_app_hash",
    "device": "contexts.device.model",
    "device.arch": "contexts.device.arch",
    "device.battery_level": "contexts.device.battery_level",
    "device.brand": "contexts.device.brand",
    "device.charging": "contexts.device.charging",
    "device.family": "contexts.device.family",
    "device.locale": "contexts.device.locale",
    "device.online": "contexts.device.online",
    "device.orientation": "contexts.device.orientation",
    "device.name": "contexts.device.name",
    "device.screen_density": "contexts.device.screen_density",
    "device.screen_dpi": "contexts.device.screen_dpi",
    "device.screen_width_pixels": "contexts.device.screen_width_pixels",
    "device.screen_height_pixels": "contexts.device.screen_height_pixels",
    "device.simulator": "contexts.device.simulator",
    "gpu.vendor": "contexts.gpu.vendor_name",
    "gpu.name": "contexts.gpu.name",
    "monitor.id": "contexts.monitor.id",
    "monitor.slug": "contexts.monitor.slug",
    "os.build": "contexts.os.build",
    "os.kernel_version": "contexts.os.kernel_version",
    "os.name": "contexts.os.name",
    "os.version": "contexts.os.version",
    "os.rooted": "contexts.os.rooted",
    "browser.name": "contexts.browser.name",
    "device.uuid": "contexts.device.uuid",
    "transaction.status": "contexts.trace.status",
    "transaction.op": "contexts.trace.op",
    "http.status_code": "contexts.response.status_code",
    "unreal.crash_type": "contexts.unreal.crash_type",
    "profile.id": "contexts.profile.profile_id",
    "runtime.name": "contexts.runtime.name",
    # Computed fields
    "transaction.duration": "duration",
    "release.build": "release.build",
    "release.package": "release.package",
    "release.version": "release.version.short",
    # These materialized fields match the mappings in sentry/interfaces/contexts.py, and they
    # are generated by Relay given the event payload.
    "runtime": "contexts.runtime",  # "{runtime.name} {runtime.version}"
    "browser": "contexts.browser",  # "{browser.name} {browser.version}"
    "os": "contexts.os",  # "{os.name} {os.version}"
    # Tags, measurements, and breakdowns are mapped by the converter
}

# Maps from Discover's syntax to Relay rule condition operators.
_SEARCH_TO_RELAY_OPERATORS: dict[str, CompareOp] = {
    "=": "eq",
    "!=": "eq",  # combined with external negation
    "<": "lt",
    "<=": "lte",
    ">": "gt",
    ">=": "gte",
    "IN": "eq",
    "NOT IN": "eq",  # combined with external negation
}

# Maps from parsed count_if condition args to Relay rule condition operators.
_COUNTIF_TO_RELAY_OPERATORS: dict[str, CompareOp] = {
    "equals": "eq",
    "notEquals": "eq",
    "less": "lt",
    "greater": "gt",
    "lessOrEquals": "lte",
    "greaterOrEquals": "gte",
}

# Maps plain Discover functions to metric aggregation functions.
_SEARCH_TO_METRIC_AGGREGATES: dict[str, MetricOperationType] = {
    "count": "sum",
    "count_if": "sum",
    "avg": "avg",
    "min": "min",
    "max": "max",
    "p50": "p50",
    "p75": "p75",
    "p90": "p90",
    "p95": "p95",
    "p99": "p99",
    # p100 is not supported in the metrics layer, so we convert to max which is equivalent.
    "p100": "max",
    # generic percentile is not supported by metrics layer.
}

# Maps plain Discover functions to derived metric functions which are understood by the metrics layer.
# XXX: We need to support count_miserable
_SEARCH_TO_DERIVED_METRIC_AGGREGATES: dict[str, MetricOperationType] = {
    "failure_count": "on_demand_failure_count",
    "failure_rate": "on_demand_failure_rate",
    "apdex": "on_demand_apdex",
    "count_web_vitals": "on_demand_count_web_vitals",
    "count_unique": "on_demand_count_unique",
    "epm": "on_demand_epm",
    "eps": "on_demand_eps",
    "user_misery": "on_demand_user_misery",
}

# Mapping to infer metric type from Discover function.
_AGGREGATE_TO_METRIC_TYPE = {
    "count": "c",
    "count_if": "c",
    "avg": "d",
    "max": "d",
    "p50": "d",
    "p75": "d",
    "p90": "d",
    "p95": "d",
    "p99": "d",
    "p100": "d",
    "percentile": "d",
    # With on demand metrics, evaluated metrics are actually stored, thus we have to choose a concrete metric type.
    "failure_count": "c",
    "failure_rate": "c",
    "count_unique": "s",
    "count_web_vitals": "c",
    "apdex": "c",
    "epm": "c",
    "eps": "c",
    "user_misery": "s",
}

_NO_ARG_METRICS = [
    "on_demand_epm",
    "on_demand_eps",
    "on_demand_failure_count",
    "on_demand_failure_rate",
]
_MULTIPLE_ARGS_METRICS = [
    "on_demand_apdex",
    "on_demand_count_unique",
    "on_demand_count_web_vitals",
    "on_demand_user_misery",
]

# Query fields that on their own do not require on-demand metric extraction but if present in an on-demand query
# will be converted to metric extraction conditions.
_STANDARD_METRIC_FIELDS = [
    "release",
    "dist",
    "environment",
    "transaction",
    "platform",
    "transaction.status",
    "transaction.op",
    "http.method",
    "http.status_code",
    "browser.name",
    "os.name",
    "geo.country_code",
]

# Query fields that are not considered
_IGNORED_METRIC_FIELDS = [
    "project",  # on-demand extraction specs are emitted per project
    "timestamp.to_day",  # relative time windows are not supported
    "timestamp.to_hour",  # relative time windows are not supported
]
_IGNORED_METRIC_CONDITION = [
    "event.type=transaction",
]

query_builder = UnresolvedQuery(
    dataset=Dataset.Transactions, params={}
)  # Workaround to get all updated discover functions instead of using the deprecated events fields.


class TagSpec(TypedDict):
    """
    Configuration for a tag to add to a metric.

    Tags values can be static if defined through `value` or dynamically queried
    from the payload if defined through `field`. These two options are mutually
    exclusive, behavior is undefined if both are specified.
    """

    key: str
    field: NotRequired[str]
    value: NotRequired[str]
    condition: NotRequired[RuleCondition]


class MetricSpec(TypedDict):
    """
    Specification for a metric to extract from some data.

    The metric type is given as part of the MRI (metric reference identifier)
    which must follow the form: `<type>:<namespace>/<name>@<unit>`.

    How the metric's value is obtained depends on the metric type:
     - Counter metrics are a special case, since the default product counters do
       not count any specific field but rather the occurrence of the event. As
       such, there is no value expression, and the field is set to `None`.
       Semantics of specifying remain undefined at this point.
     - Distribution metrics require a numeric value.
     - Set metrics require a string value, which is then emitted into the set as
       unique value. Insertion of numbers and other types is undefined.
    """

    category: Literal["transaction"]
    mri: str
    field: NotRequired[str | None]
    condition: NotRequired[RuleCondition]
    tags: NotRequired[Sequence[TagSpec]]


class TagMapping(TypedDict):
    #: A list of Metric Resource Identifiers (MRI) to apply tags to.
    #:
    #: Entries in this list can contain wildcards to match metrics with dynamic MRIs.
    metrics: list[str]

    #: A list of tags to add to the metric.
    #:
    #: Tags can be conditional, see `TagSpec` for configuration options. For this reason, it is
    #: possible to list tag keys multiple times, each with different conditions. The first matching
    #: condition will be applied.
    tags: list[TagSpec]


def _check_event_type_transaction(
    query: Sequence[QueryToken], is_top_level_call: bool = True
) -> bool:
    transaction_filter = False

    for token in query:
        if isinstance(token, SearchFilter):
            if token.key.name == "event.type" and token.value.value == "transaction":
                transaction_filter = True
                break
        elif isinstance(token, ParenExpression):
            contains_transaction = _check_event_type_transaction(
                token.children, is_top_level_call=False
            )
            if contains_transaction:
                transaction_filter = True
                break

    # Only if we are top level call, and we didn't find any transaction filter, we throw an exception, otherwise it
    # means we are in a nested expression and not finding a transaction doesn't mean we never found it.
    if is_top_level_call and not transaction_filter:
        raise ValueError("event.type:transaction not found in the query")

    return transaction_filter


def _transform_search_filter(search_filter: SearchFilter) -> SearchFilter:
    # If we have `message:something` we convert it to `message:*something*` since we want to perform `contains` matching
    # exactly how discover does it.
    if search_filter.key.name == "message":
        return SearchFilter(
            key=SearchKey(name=search_filter.key.name),
            operator=search_filter.operator,
            value=SearchValue(raw_value=f"*{search_filter.value.raw_value}*"),
        )

    # If we have `transaction.status:unknown_error` we convert it to `transaction.status:unknown` since we need to be
    # backward compatible.
    if (
        search_filter.key.name == "transaction.status"
        and search_filter.value.raw_value == "unknown_error"
    ):
        return SearchFilter(
            key=SearchKey(name=search_filter.key.name),
            operator=search_filter.operator,
            value=SearchValue(raw_value="unknown"),
        )

    return search_filter


def _transform_search_query(query: Sequence[QueryToken]) -> Sequence[QueryToken]:
    transformed_query: list[QueryToken] = []

    for token in query:
        if isinstance(token, SearchFilter):
            transformed_query.append(_transform_search_filter(token))
        elif isinstance(token, ParenExpression):
            transformed_query.append(ParenExpression(_transform_search_query(token.children)))
        else:
            transformed_query.append(token)

    return transformed_query


@metrics.wraps("metrics.extraction.parse_search_query")
def parse_search_query(
    query: str | None,
    removed_blacklisted: bool = False,
    force_transaction_event_type: bool = False,
) -> Sequence[QueryToken]:
    """
    Parses a search query with the discover grammar and performs some transformations on the AST in order to account for
    edge cases.
    """
    tokens = cast(Sequence[QueryToken], event_search.parse_search_query(query))

    # We might want to force the `event.type:transaction` to be in the query, as a validation step.
    if force_transaction_event_type:
        _check_event_type_transaction(tokens)

    # As first step, we transform the search query by applying basic transformations.
    tokens = _transform_search_query(tokens)

    # As second step, if enabled, we remove elements from the query which are blacklisted.
    if removed_blacklisted:
        tokens = cleanup_search_query(_remove_blacklisted_search_filters(tokens))

    return tokens


def cleanup_search_query(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Recreates a valid query from an original query that has had on demand search filters removed.

    When removing filters from a query it is possible to create invalid queries.
    For example removing the on demand filters from "transaction.duration:>=1s OR browser.version:1 AND environment:dev"
    would result in "OR AND environment:dev" which is not a valid query this should be cleaned to "environment:dev.

    "release:internal and browser.version:1 or os.name:android" => "release:internal or and os.name:android" which
    would be cleaned to "release:internal or os.name:android"
    """
    tokens = list(tokens)

    # remove empty parens
    removed_empty_parens: list[QueryToken] = []
    for token in tokens:
        if not isinstance(token, ParenExpression):
            removed_empty_parens.append(token)
        else:
            children = cleanup_search_query(token.children)
            if len(children) > 0:
                removed_empty_parens.append(ParenExpression(children))

    # remove AND and OR operators at the start of the query
    while len(removed_empty_parens) > 0 and isinstance(removed_empty_parens[0], str):
        removed_empty_parens.pop(0)

    # remove AND and OR operators at the end of the query
    while len(removed_empty_parens) > 0 and isinstance(removed_empty_parens[-1], str):
        removed_empty_parens.pop()

    # remove AND and OR operators that are next to each other
    ret_val = []
    previous_token: QueryToken | None = None

    for token in removed_empty_parens:
        # this loop takes care of removing consecutive AND/OR operators (keeping only one of them)
        if isinstance(token, str) and isinstance(previous_token, str):
            token = cast(QueryOp, token.upper())
            # this handles two AND/OR operators next to each other, we must drop one of them
            # if we have an AND do nothing (AND will be merged in the previous token see comment below)
            # if we have an OR the resulting operator will be an OR
            # AND OR => OR
            # OR OR => OR
            # OR AND => OR
            # AND AND => AND
            if token == "OR":
                previous_token = "OR"
            continue
        elif previous_token is not None:
            ret_val.append(previous_token)
        previous_token = token

    # take care of the last token (if any)
    if previous_token is not None:
        ret_val.append(previous_token)

    return ret_val


def _parse_function(aggregate: str) -> tuple[str, list[str], str]:
    """
    Parses an aggregate and returns its components.

    This function is a slightly modified version of the `parse_function` method of the query builders.
    """
    match = fields.is_function(aggregate)
    if not match:
        raise InvalidSearchQuery(f"Invalid characters in field {aggregate}")

    function = match.group("function")
    arguments = fields.parse_arguments(function, match.group("columns"))
    alias = match.group("alias")

    if alias is None:
        alias = fields.get_function_alias_with_columns(function, arguments)

    return function, arguments, alias


@dataclass(frozen=True)
class SupportedBy:
    """Result of a check for standard and on-demand metric support."""

    standard_metrics: bool
    on_demand_metrics: bool

    @classmethod
    def neither(cls) -> Self:
        return cls(standard_metrics=False, on_demand_metrics=False)

    @classmethod
    def both(cls) -> Self:
        return cls(standard_metrics=True, on_demand_metrics=True)

    @classmethod
    def combine(cls, *supported_by: Self) -> Self:
        return cls(
            standard_metrics=all(s.standard_metrics for s in supported_by),
            on_demand_metrics=all(s.on_demand_metrics for s in supported_by),
        )


def should_use_on_demand_metrics_for_querying(organization: Organization, **kwargs: Any) -> bool:
    """Helper function to check if an organization can query an specific on-demand function"""
    components = _extract_aggregate_components(kwargs["aggregate"])
    if components is None:
        return False
    function, _ = components

    # This helps us control which functions are allowed to use the new spec version.
    if function in OPS_REQUIRE_FEAT_FLAG:
        if not organization:
            # We need to let devs writting tests that if they intend to use a function that requires a feature flag
            # that the organization needs to be included in the test.
            if os.environ.get("PYTEST_CURRENT_TEST"):
                logger.error("Pass the organization to create the spec for this function.")
            sentry_sdk.capture_message(
                f"Organization is required for {function} on-demand metrics."
            )
            return False
        feat_flag = OPS_REQUIRE_FEAT_FLAG[function]
        if not features.has(feat_flag, organization):
            if os.environ.get("PYTEST_CURRENT_TEST"):
                # This will show up in the logs and help the developer understand why the test is failing
                logger.error("Add the feature flag to create the spec for this function.")
            return False

    return should_use_on_demand_metrics(**kwargs)


def _should_use_on_demand_metrics(
    dataset: str | Dataset | None,
    aggregate: str,
    query: str | None,
    groupbys: Sequence[str] | None = None,
    prefilling: bool = False,
) -> bool:
    """On-demand metrics are used if the aggregate and query are supported by on-demand metrics but not standard"""
    groupbys = groupbys or []
    supported_datasets = [Dataset.PerformanceMetrics]
    # In case we are running a prefill, we want to support also transactions, since our goal is to start extracting
    # metrics that will be needed after a query is converted from using transactions to metrics.
    if prefilling:
        supported_datasets.append(Dataset.Transactions)

    if not dataset or Dataset(dataset) not in supported_datasets:
        return False

    components = _extract_aggregate_components(aggregate)
    if components is None:
        return False

    function, args = components

    mri_aggregate = _extract_mri(args)
    if mri_aggregate is not None:
        # For now, we do not support MRIs in on demand metrics.
        return False

    aggregate_supported_by = _get_aggregate_supported_by(function, args)
    query_supported_by = _get_query_supported_by(query)
    groupbys_supported_by = _get_groupbys_support(groupbys)

    supported_by = SupportedBy.combine(
        aggregate_supported_by, query_supported_by, groupbys_supported_by
    )

    return not supported_by.standard_metrics and supported_by.on_demand_metrics


@metrics.wraps("on_demand_metrics.should_use_on_demand_metrics")
def should_use_on_demand_metrics(
    dataset: str | Dataset | None,
    aggregate: str,
    query: str | None,
    groupbys: Sequence[str] | None = None,
    prefilling: bool = False,
    organization_bulk_query_cache: dict[int, dict[str, bool]] | None = None,
) -> bool:
    if in_random_rollout("on_demand_metrics.cache_should_use_on_demand"):
        if organization_bulk_query_cache is None:
            organization_bulk_query_cache = defaultdict(dict)

        dataset_str = dataset.value if isinstance(dataset, Enum) else str(dataset or "")
        groupbys_str = ",".join(sorted(groupbys)) if groupbys else ""
        local_cache_md5 = md5_text(
            f"{dataset_str}-{aggregate}-{query or ''}-{groupbys_str}-prefilling={prefilling}"
        )
        local_cache_digest_chunk = local_cache_md5.digest()[0] % WIDGET_QUERY_CACHE_MAX_CHUNKS
        local_cache_key = local_cache_md5.hexdigest()
        cached_result = organization_bulk_query_cache.get(local_cache_digest_chunk, {}).get(
            local_cache_key, None
        )
        if cached_result:
            metrics.incr("on_demand_metrics.should_use_on_demand_metrics.cache_hit")
            return cached_result
        else:
            result = _should_use_on_demand_metrics(
                dataset=dataset,
                aggregate=aggregate,
                query=query,
                groupbys=groupbys,
                prefilling=prefilling,
            )
            metrics.incr("on_demand_metrics.should_use_on_demand_metrics.cache_miss")
            organization_bulk_query_cache[local_cache_digest_chunk][local_cache_key] = result
            return result

    return _should_use_on_demand_metrics(
        dataset=dataset, aggregate=aggregate, query=query, groupbys=groupbys, prefilling=prefilling
    )


def _extract_aggregate_components(aggregate: str) -> tuple[str, list[str]] | None:
    try:
        if is_equation(aggregate):
            return None

        function, args, _ = _parse_function(aggregate)
        return function, args
    except InvalidSearchQuery:
        logger.exception("Failed to parse aggregate: %s", aggregate)

    return None


def _extract_mri(args: list[str]) -> ParsedMRI | None:
    if len(args) == 0:
        return None

    return parse_mri(args[0])


def _get_aggregate_supported_by(function: str, args: list[str]) -> SupportedBy:
    function_support = _get_function_support(function, args)
    args_support = _get_args_support(args, function)

    return SupportedBy.combine(function_support, args_support)


def _get_function_support(function: str, args: Sequence[str]) -> SupportedBy:
    if function == "percentile":
        return _get_percentile_support(args)

    return SupportedBy(
        standard_metrics=True,
        on_demand_metrics=(
            function in _SEARCH_TO_METRIC_AGGREGATES
            or function in _SEARCH_TO_DERIVED_METRIC_AGGREGATES
        )
        and function in _AGGREGATE_TO_METRIC_TYPE,
    )


def _get_percentile_support(args: Sequence[str]) -> SupportedBy:
    if len(args) != 2:
        return SupportedBy.neither()

    if not _get_percentile_op(args):
        return SupportedBy.neither()

    return SupportedBy.both()


def _get_percentile_op(args: Sequence[str]) -> MetricOperationType | None:
    if len(args) != 2:
        raise ValueError("Percentile function should have 2 arguments")

    percentile = args[1]

    if percentile in ["0.5", "0.50"]:
        return "p50"
    if percentile == "0.75":
        return "p75"
    if percentile in ["0.9", "0.90"]:
        return "p90"
    if percentile == "0.95":
        return "p95"
    if percentile == "0.99":
        return "p99"
    if percentile in ["1", "1.0"]:
        return "p100"

    return None


def _get_field_support(field: str) -> SupportedBy:
    standard_metrics = _is_standard_metrics_field(field)
    on_demand_metrics = _is_on_demand_supported_field(field)
    return SupportedBy(standard_metrics=standard_metrics, on_demand_metrics=on_demand_metrics)


def _get_args_support(fields: Sequence[str], used_in_function: str | None = None) -> SupportedBy:
    if len(fields) == 0:
        return SupportedBy.both()

    if used_in_function == "apdex":
        # apdex can have two variations, either apdex() or apdex(value).
        return SupportedBy(on_demand_metrics=True, standard_metrics=False)

    if used_in_function in ["epm", "eps"]:
        return SupportedBy.both()

    arg = fields[0]
    return _get_field_support(arg)


def _get_groupbys_support(groupbys: Sequence[str]) -> SupportedBy:
    if len(groupbys) == 0:
        return SupportedBy.both()

    return SupportedBy.combine(*[_get_field_support(groupby) for groupby in groupbys])


def _get_query_supported_by(query: str | None) -> SupportedBy:
    try:
        parsed_query = parse_search_query(query=query, removed_blacklisted=False)

        standard_metrics = _is_standard_metrics_query(parsed_query)
        on_demand_metrics = _is_on_demand_supported_query(parsed_query)

        return SupportedBy(standard_metrics=standard_metrics, on_demand_metrics=on_demand_metrics)
    except InvalidSearchQuery:
        logger.exception("Failed to parse search query: %s", query)
        return SupportedBy.neither()


def _is_standard_metrics_query(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """
    for token in tokens:
        if not _is_standard_metrics_search_filter(token):
            return False

    return True


def _is_standard_metrics_search_filter(token: QueryToken) -> bool:
    if isinstance(token, SearchFilter):
        return _is_standard_metrics_search_term(token.key.name)

    if isinstance(token, ParenExpression):
        return _is_standard_metrics_query(token.children)

    return True


def _is_on_demand_supported_query(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """
    for token in tokens:
        if not _is_on_demand_supported_search_filter(token):
            return False

    return True


def _is_on_demand_supported_search_filter(token: QueryToken | AggregateFilter) -> bool:
    if isinstance(token, AggregateFilter):
        return False

    if isinstance(token, SearchFilter):
        if not _SEARCH_TO_RELAY_OPERATORS.get(token.operator):
            return False

        return (
            not _is_excluding_transactions(token)
            and not _is_error_field(token.key.name)
            and _is_on_demand_supported_field(token.key.name)
        )

    if isinstance(token, ParenExpression):
        return _is_on_demand_supported_query(token.children)

    return True


def _is_excluding_transactions(token: SearchFilter) -> bool:
    if token.key.name != "event.type":
        return False

    is_not_transaction = token.operator == "!=" and token.value.raw_value == "transaction"
    is_error_or_default = token.operator == "=" and token.value.raw_value in ["error", "default"]

    return is_not_transaction or is_error_or_default


def _is_standard_metrics_field(field: str) -> bool:
    return (
        _is_standard_metrics_search_term(field)
        or is_measurement(field)
        or is_span_op_breakdown(field)
        or field == "transaction.duration"
    )


def _is_error_field(token: str) -> bool:
    return token.startswith("error.") or token in ERROR_RELATED_TOKENS


def _is_standard_metrics_search_term(field: str) -> bool:
    return field in _STANDARD_METRIC_FIELDS or field in _IGNORED_METRIC_FIELDS


def _is_on_demand_supported_field(field: str) -> bool:
    if field in _IGNORED_METRIC_FIELDS:
        return True

    try:
        _map_field_name(field)
        return True
    except ValueError:
        return False


def to_standard_metrics_query(query: str) -> str:
    """
    Converts a query containing on demand search fields to a query that can be
    run using only standard metrics.

    This is done by removing conditions requiring on-demand metrics.

    NOTE: This does **NOT** create an equivalent query. It only creates the best
    approximation available using only standard metrics. It is used for approximating
    the volume of an on-demand metrics query using a combination of indexed and metrics data.

    Examples:
        "environment:dev AND transaction.duration:>=1s" -> "environment:dev"
        "environment:dev OR transaction.duration:>=1s" -> "environment:dev"
        "transaction.duration:>=1s OR browser.version:1" -> ""
        "transaction.duration:>=1s AND browser.version:1" -> ""
    """
    try:
        tokens = parse_search_query(query=query, removed_blacklisted=False)
    except InvalidSearchQuery:
        logger.exception("Failed to parse search query: %s", query)
        raise

    cleaned_query = to_standard_metrics_tokens(tokens)
    return query_tokens_to_string(cleaned_query)


def to_standard_metrics_tokens(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Converts a query in token form containing on-demand search fields to a query
    that has all on-demand filters removed and can be run using only standard metrics.
    """
    remaining_tokens = _remove_on_demand_search_filters(tokens)
    cleaned_query = cleanup_search_query(remaining_tokens)
    return cleaned_query


def query_tokens_to_string(tokens: Sequence[QueryToken]) -> str:
    """
    Converts a list of tokens into a query string.
    """
    ret_val = ""
    for token in tokens:
        if isinstance(token, str):
            ret_val += f" {token}"
        else:
            ret_val += f" {token.to_query_string()}"
    return ret_val.strip()


def _remove_on_demand_search_filters(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Removes tokens that contain filters that can only be handled by on demand metrics.
    """
    ret_val: list[QueryToken] = []
    for token in tokens:
        if isinstance(token, SearchFilter):
            if _is_standard_metrics_search_filter(token):
                ret_val.append(token)
        elif isinstance(token, ParenExpression):
            ret_val.append(ParenExpression(_remove_on_demand_search_filters(token.children)))
        else:
            ret_val.append(token)

    return ret_val


def _remove_blacklisted_search_filters(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Removes tokens that contain filters that are blacklisted.
    """
    ret_val: list[QueryToken] = []
    for token in tokens:
        if isinstance(token, SearchFilter):
            if (
                token.key.name not in _IGNORED_METRIC_FIELDS
                and str(token) not in _IGNORED_METRIC_CONDITION
            ):
                ret_val.append(token)
        elif isinstance(token, ParenExpression):
            ret_val.append(ParenExpression(_remove_blacklisted_search_filters(token.children)))
        else:
            ret_val.append(token)

    return ret_val


def _remove_redundant_parentheses(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Removes redundant parentheses in the form (((expr))) since they are not needed and might lead to parsing issues
    down the line.
    """
    if len(tokens) == 1 and isinstance(tokens[0], ParenExpression):
        return _remove_redundant_parentheses(tokens[0].children)

    return tokens


def _deep_sorted(value: Any | dict[Any, Any]) -> Any | dict[Any, Any]:
    if isinstance(value, dict):
        return {key: _deep_sorted(value) for key, value in sorted(value.items())}
    else:
        return value


def are_specs_equal(spec_1: MetricSpec, spec_2: MetricSpec) -> bool:
    equal = True
    if spec_1.keys() != spec_2.keys():
        equal = False

    if equal:
        for key, value in spec_1.items():
            if key == "tags":
                return _compare_lists(spec_1["tags"], spec_2["tags"])

            elif spec_2.get(key) != value:
                equal = False

    return equal


def _compare_lists(list_1: Sequence[Any], list_2: Sequence[Any]) -> bool:
    if len(list_1) != len(list_2):
        return False

    for _, value in enumerate(list_1):
        if value not in list_2:
            return False

    return True


TagsSpecsGenerator = Callable[[Project, Optional[Sequence[str]]], list[TagSpec]]


def _get_threshold(arguments: Sequence[str] | None) -> float:
    if not arguments:
        raise Exception("Threshold parameter required.")

    return float(arguments[0])


def failure_tag_spec(_1: Project, _2: Sequence[str] | None) -> list[TagSpec]:
    """This specification tags transactions with a boolean saying if it failed."""
    return [
        {
            "key": "failure",
            "value": "true",
            "condition": {
                "inner": {
                    "name": "event.contexts.trace.status",
                    "op": "eq",
                    "value": ["ok", "cancelled", "unknown"],
                },
                "op": "not",
            },
        }
    ]


def apdex_tag_spec(project: Project, arguments: Sequence[str] | None) -> list[TagSpec]:
    apdex_threshold = _get_threshold(arguments)
    field = _map_field_name(_get_satisfactory_metric(project))

    return [
        {
            "key": "satisfaction",
            "value": "satisfactory",
            "condition": {"name": field, "op": "lte", "value": apdex_threshold},
        },
        {
            "key": "satisfaction",
            "value": "tolerable",
            "condition": {
                "inner": [
                    {"name": field, "op": "gt", "value": apdex_threshold},
                    {"name": field, "op": "lte", "value": apdex_threshold * 4},
                ],
                "op": "and",
            },
        },
        {
            "key": "satisfaction",
            "value": "frustrated",
            "condition": {"name": field, "op": "gt", "value": apdex_threshold * 4},
        },
    ]


def count_web_vitals_spec(project: Project, arguments: Sequence[str] | None) -> list[TagSpec]:
    if not arguments:
        raise Exception("count_web_vitals requires arguments")

    if len(arguments) != 2:
        raise Exception("count web vitals requires a vital name and vital rating")

    measurement, measurement_rating = arguments

    field = _map_field_name(measurement)
    _, vital = measurement.split(".")

    thresholds = VITAL_THRESHOLDS[vital]

    if measurement_rating == "good":
        return [
            {
                "key": "measurement_rating",
                "value": "matches_hash",
                "condition": {"name": field, "op": "lt", "value": thresholds["meh"]},
            }
        ]
    elif measurement_rating == "meh":
        return [
            {
                "key": "measurement_rating",
                "value": "matches_hash",
                "condition": {
                    "inner": [
                        {"name": field, "op": "gte", "value": thresholds["meh"]},
                        {"name": field, "op": "lt", "value": thresholds["poor"]},
                    ],
                    "op": "and",
                },
            }
        ]
    elif measurement_rating == "poor":
        return [
            {
                "key": "measurement_rating",
                "value": "matches_hash",
                "condition": {"name": field, "op": "gte", "value": thresholds["poor"]},
            }
        ]
    return [
        # 'any' measurement_rating
        {
            "key": "measurement_rating",
            "value": "matches_hash",
            "condition": {"name": field, "op": "gte", "value": 0},
        }
    ]


def user_misery_tag_spec(project: Project, arguments: Sequence[str] | None) -> list[TagSpec]:
    """A metric that counts the number of unique users who were frustrated; "frustration" is
    measured as a response time four times the satisfactory response time threshold (in milliseconds).
    It highlights transactions that have the highest impact on users."""
    threshold = _get_threshold(arguments)
    field = _map_field_name(_get_satisfactory_metric(project))

    return [
        {
            "key": "satisfaction",
            "value": "frustrated",
            "condition": {"name": field, "op": "gt", "value": threshold * 4},
        }
    ]


# This is used to map custom on-demand operations that requires special tags to a function which generates specs for those tags.
_ONDEMAND_OP_TO_SPEC_GENERATOR: dict[MetricOperationType, TagsSpecsGenerator] = {
    "on_demand_failure_count": failure_tag_spec,
    "on_demand_failure_rate": failure_tag_spec,
    "on_demand_count_web_vitals": count_web_vitals_spec,
}
# Same as `_ONDEMAND_OP_TO_SPEC_GENERATOR` except these ops may have project specific specs.
# We use this to opt out of some kinds of organization level cacheing.
_ONDEMAND_OP_TO_PROJECT_SPEC_GENERATOR: dict[MetricOperationType, TagsSpecsGenerator] = {
    "on_demand_apdex": apdex_tag_spec,
    "on_demand_user_misery": user_misery_tag_spec,
}


@dataclass(frozen=True)
class FieldParsingResult:
    function: str
    arguments: Sequence[str]
    alias: str


@dataclass(frozen=True)
class QueryParsingResult:
    conditions: Sequence[QueryToken]

    def is_empty(self) -> bool:
        return len(self.conditions) == 0


class MetricSpecType(Enum):
    # Encodes environment into the query hash, does not support group-by environment
    SIMPLE_QUERY = "simple_query"
    # Omits environment from the query hash, supports group-by on environment for dynamic switching between envs.
    DYNAMIC_QUERY = "dynamic_query"


@dataclass
class OnDemandMetricSpec:
    """
    Contains the information required to query or extract an on-demand metric.
    """

    # Base fields from outside.
    field: str
    query: str
    groupbys: Sequence[str]
    spec_type: MetricSpecType
    spec_version: SpecVersion

    # Public fields.
    op: MetricOperationType

    # Private fields.
    _metric_type: str
    _arguments: Sequence[str]

    def __init__(
        self,
        field: str,
        query: str,
        environment: str | None = None,
        groupbys: Sequence[str] | None = None,
        spec_type: MetricSpecType = MetricSpecType.SIMPLE_QUERY,
        spec_version: SpecVersion | None = None,
    ):
        self.field = field
        self.query = query
        self.spec_type = spec_type
        self.spec_version = (
            spec_version
            if spec_version
            else OnDemandMetricSpecVersioning.get_default_spec_version()
        )

        # Removes field if passed in selected_columns
        self.groupbys = [groupby for groupby in groupbys or () if groupby != field]
        # Include environment in groupbys which will cause it to included it in the query hash
        if (
            self.spec_type == MetricSpecType.DYNAMIC_QUERY
            and "environment" not in self.groupbys
            and self.spec_version.flags == {"include_environment_tag"}
        ):
            self.groupbys.append("environment")
        # For now, we just support the environment as extra, but in the future we might need more complex ways to
        # combine extra values that are outside the query string.
        self.environment = environment
        self._arguments = []
        self._eager_process()

    def _eager_process(self) -> None:
        op, metric_type, arguments = self._process_field()

        self.op = op
        self._metric_type = metric_type
        self._arguments = arguments or []

    @property
    def field_to_extract(self) -> str | None:
        if self.op in ("on_demand_apdex", "on_demand_count_web_vitals"):
            return None

        if self.op in ("on_demand_user_misery"):
            return _map_field_name("user")

        if not self._arguments:
            return None

        return self._arguments[0]

    @property
    def metric_type(self) -> str:
        """Returns c, d or s representing if it's a counter, distribution or set."""
        return self._metric_type

    @cached_property
    def mri(self) -> str:
        """The unique identifier of the on-demand metric."""
        return f"{self._metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none"

    @cached_property
    def _query_str_for_hash(self) -> str:
        """Returns a hash of the query and field to be used as a unique identifier for the on-demand metric."""
        str_to_hash = f"{self._field_for_hash()};{self._query_for_hash()}"
        if self.groupbys:
            # For compatibility with existing deployed metrics, leave existing hash untouched unless conditions are now
            # included in the spec.
            return f"{str_to_hash};{self._groupbys_for_hash()}"
        return str_to_hash

    @cached_property
    def query_hash(self) -> str:
        str_to_hash = self._query_str_for_hash
        hash = hashlib.shake_128(str_to_hash.encode()).hexdigest(4)
        return hash

    def _field_for_hash(self) -> str | None:
        # Since derived metrics are a special case, we want to make sure that the hashing is different from the other
        # metrics.
        #
        # More specifically the hashing implementation will depend on the derived metric type:
        # - failure count & rate -> hash the op
        # - apdex -> hash the op + value
        #
        # The rationale for different hashing is complex to explain but the main idea is that if we hash the argument
        # and the conditions, we might have a case in which `count()` with condition `f` has the same hash as `apdex()`
        # with condition `f` and this will create a problem, since we might already have data for the `count()` and when
        # `apdex()` is created in the UI, we will use that metric but that metric didn't extract in the past the tags
        # that are used for apdex calculation, effectively causing problems with the data.
        if self.op in _NO_ARG_METRICS:
            return self.op
        elif self.op in _MULTIPLE_ARGS_METRICS:
            ret_val = f"{self.op}"
            for arg in self._arguments:
                ret_val += f":{arg}"
            return ret_val

        if not self._arguments:
            return None

        return self._arguments[0]

    def _query_for_hash(self) -> str:
        # In order to reduce the amount of metric being extracted, we perform a sort of the conditions tree. This
        # heuristic allows us to perform some de-duplication to minimize the number of metrics extracted for
        # semantically identical queries.
        #
        # In case we have `None` condition, we will use `None` string for hashing, so it's a sentinel value.
        return str(_deep_sorted(self.condition))

    def _groupbys_for_hash(self) -> str:
        # A sorted list of group-bys for the hash, since groupbys will be unique per on_demand metric.
        return str(sorted(self.groupbys))

    @cached_property
    def condition(self) -> RuleCondition | None:
        """Returns a parent condition containing a list of other conditions which determine whether of not the metric
        is extracted."""
        return self._process_query()

    def tags_conditions(self, project: Project) -> list[TagSpec]:
        """Returns a list of tag conditions that will specify how tags are injected into metrics by Relay, and a bool if those specs may be project specific."""
        tags_specs_generator = _ONDEMAND_OP_TO_SPEC_GENERATOR.get(self.op)
        tags_specs_generator_for_project = _ONDEMAND_OP_TO_PROJECT_SPEC_GENERATOR.get(self.op)

        if tags_specs_generator_for_project is not None:
            tags_specs_generator = tags_specs_generator_for_project

        if tags_specs_generator is None:
            return []

        return tags_specs_generator(project, self._arguments)

    def _tag_for_field(self, groupby: str) -> TagSpec:
        """Returns a TagSpec for a field, eg. a groupby"""
        field = _map_field_name(groupby)

        return {
            "key": groupby,
            "field": field,
        }

    def tags_groupbys(self, groupbys: Sequence[str]) -> list[TagSpec]:
        """Returns a list of tag specs generate for added groupbys, as they need to be stored separately for queries to work."""
        return [self._tag_for_field(groupby) for groupby in groupbys]

    def to_metric_spec(self, project: Project) -> MetricSpec:
        """Converts the OndemandMetricSpec into a MetricSpec that Relay can understand."""
        # Tag conditions are always computed based on the project.
        extended_tags_conditions = self.tags_conditions(project).copy()
        extended_tags_conditions.append({"key": QUERY_HASH_KEY, "value": self.query_hash})

        tag_from_groupbys = self.tags_groupbys(self.groupbys)
        extended_tags_conditions.extend(tag_from_groupbys)

        # Once we switch to the next spec we can remove this block
        # since the environment will be added to the groupbys, thus, being included in the query hash
        if (
            self.spec_type == MetricSpecType.DYNAMIC_QUERY
            and self.spec_version.flags == set()
            and self._tag_for_field("environment") not in extended_tags_conditions
        ):
            extended_tags_conditions.append(self._tag_for_field("environment"))

        metric_spec: MetricSpec = {
            "category": DataCategory.TRANSACTION.api_name(),
            "mri": self.mri,
            "field": self.field_to_extract,
            "tags": extended_tags_conditions,
        }

        condition = self.condition
        if condition is not None:
            metric_spec["condition"] = condition

        return metric_spec

    def _process_field(self) -> tuple[MetricOperationType, str, Sequence[str] | None]:
        parsed_field = self._parse_field(self.field)
        op = self._get_op(parsed_field.function, parsed_field.arguments)
        metric_type = self._get_metric_type(parsed_field.function)

        return op, metric_type, self._parse_arguments(op, metric_type, parsed_field)

    def _process_query(self) -> RuleCondition | None:
        # First step is to parse the query string into our internal AST format.
        parsed_query = self._parse_query(self.query)
        # We extend the parsed query with other conditions that we want to inject externally from the query. If it is
        # a simple query, we encode the environment in the query hash, instead of emitting it as a tag of the metric.
        if self.spec_type == MetricSpecType.SIMPLE_QUERY:
            parsed_query = self._extend_parsed_query(parsed_query)

        # Second step is to extract the conditions that might be present in the aggregate function (e.g. count_if).
        parsed_field = self._parse_field(self.field)
        aggregate_conditions = self._aggregate_conditions(parsed_field)

        # In case we have an empty query, but we have some conditions from the aggregate, we can just return them.
        if parsed_query.is_empty() and aggregate_conditions:
            return aggregate_conditions

        try:
            # Third step is to generate the actual Relay rule that contains all rules nested. We assume that the query
            # being passed here, can be satisfied ONLY by on demand metrics.
            rule_condition = SearchQueryConverter(parsed_query.conditions).convert()
        except Exception:
            if not parsed_query.is_empty():
                logger.exception("Error while converting search query '%s'", self.query)

            return None

        # If we don't have to merge the aggregate, we can just return the parsed rules.
        if not aggregate_conditions:
            return rule_condition

        # In case we have a top level rule which is not an "and" we have to wrap it.
        if rule_condition["op"] != "and":
            return {"op": "and", "inner": [rule_condition, aggregate_conditions]}

        # In the other case, we can just flatten the conditions.
        rule_condition["inner"].append(aggregate_conditions)
        return rule_condition

    def _extend_parsed_query(self, parsed_query_result: QueryParsingResult) -> QueryParsingResult:
        conditions = cast(list[QueryToken], parsed_query_result.conditions)

        new_conditions: list[QueryToken] = []
        if self.environment is not None:
            new_conditions.append(
                SearchFilter(
                    key=SearchKey(name="environment"),
                    operator="=",
                    value=SearchValue(raw_value=self.environment),
                )
            )

        extended_conditions = conditions
        if new_conditions:
            conditions = [ParenExpression(children=conditions)] if conditions else []
            # This transformation is equivalent to (new_conditions) AND (conditions).
            extended_conditions = [ParenExpression(children=new_conditions)] + conditions

        return QueryParsingResult(conditions=extended_conditions)

    @staticmethod
    def _aggregate_conditions(parsed_field: FieldParsingResult) -> RuleCondition | None:
        # We have to handle the special case for the "count_if" function, however it may be better to build some
        # better abstracted code to handle third-party rule conditions injection.
        if parsed_field.function == "count_if":
            key, op, value = parsed_field.arguments
            return _convert_countif_filter(key, op, value)

        return None

    @staticmethod
    def _parse_arguments(
        op: MetricOperationType, metric_type: str, parsed_field: FieldParsingResult
    ) -> Sequence[str] | None:
        requires_arguments = metric_type in ["s", "d"] or op in _MULTIPLE_ARGS_METRICS
        if not requires_arguments:
            return None

        if len(parsed_field.arguments) == 0:
            raise Exception(f"The operation {op} supports one or more parameters")

        arguments = parsed_field.arguments
        return [_map_field_name(arguments[0])] if op not in _MULTIPLE_ARGS_METRICS else arguments

    @staticmethod
    def _get_op(function: str, args: Sequence[str]) -> MetricOperationType:
        if function == "percentile":
            percentile_op = _get_percentile_op(args)
            if percentile_op is not None:
                function = cast(str, percentile_op)

        op = _SEARCH_TO_METRIC_AGGREGATES.get(function) or _SEARCH_TO_DERIVED_METRIC_AGGREGATES.get(
            function
        )
        if op is not None:
            return op

        raise Exception(f"Unsupported aggregate function {function}")

    @staticmethod
    def _get_metric_type(function: str) -> str:
        metric_type = _AGGREGATE_TO_METRIC_TYPE.get(function)
        if metric_type is not None:
            return metric_type

        raise Exception(f"Unsupported aggregate function {function}")

    @staticmethod
    def _parse_field(value: str) -> FieldParsingResult:
        try:
            function, arguments, alias = _parse_function(value)
            if function:
                return FieldParsingResult(function=function, arguments=arguments, alias=alias)

            # TODO: why is this here?
            column = query_builder.resolve_column(value)
            return column
        except InvalidSearchQuery as e:
            raise Exception(f"Unable to parse the field '{value}' in on demand spec: {e}")

    @staticmethod
    def _parse_query(value: str) -> QueryParsingResult:
        """Parse query string into our internal AST format."""
        try:
            conditions = parse_search_query(query=value, removed_blacklisted=True)

            # In order to avoid having issues with the parsing logic, we want to remove any unnecessary parentheses
            # that are not needed, since if we had the parentheses this might lead to a different conditions tree, which
            # in our case doesn't happen since SearchQueryConverter optimizes that case, but it can easily slip in other
            # edge cases.
            conditions = _remove_redundant_parentheses(conditions)

            return QueryParsingResult(conditions=conditions)
        except InvalidSearchQuery as e:
            raise Exception(f"Invalid search query '{value}' in on demand spec: {e}")


def fetch_on_demand_metric_spec(
    org_id: int,
    field: str,
    query: str,
    environment: str | None = None,
    groupbys: Sequence[str] | None = None,
    spec_type: MetricSpecType = MetricSpecType.SIMPLE_QUERY,
) -> OnDemandMetricSpec:
    """Function to query the right spec based on the feature flags for an organization."""
    # The spec version defines what OnDemandMetricSpec version is created
    spec_version = OnDemandMetricSpecVersioning.get_query_spec_version(org_id)
    return OnDemandMetricSpec(
        field=field,
        query=query,
        environment=environment,
        groupbys=groupbys,
        spec_type=spec_type,
        spec_version=spec_version,
    )


def _convert_countif_filter(key: str, op: str, value: str) -> RuleCondition:
    """Maps ``count_if`` arguments to a ``RuleCondition``."""
    assert op in _COUNTIF_TO_RELAY_OPERATORS, f"Unsupported `count_if` operator {op}"

    condition = cast(
        RuleCondition,
        {
            "op": _COUNTIF_TO_RELAY_OPERATORS[op],
            "name": _map_field_name(key),
            "value": fields.normalize_count_if_value({"column": key, "value": value}),
        },
    )

    if op == "notEquals":
        condition = {"op": "not", "inner": condition}

    return condition


def _map_field_name(search_key: str) -> str:
    """
    Maps the name of a field in a search query to the event protocol path.

    Raises an exception if the field is not supported.
    """
    # Map known fields using a static mapping.
    if field := _SEARCH_TO_PROTOCOL_FIELDS.get(search_key):
        return f"event.{field}"

    # Measurements support generic access.
    if search_key.startswith("measurements."):
        return f"event.{search_key}.value"

    # Run a schema-aware check for tags. Always use the resolver output,
    # since it accounts for passing `tags[foo]` as key.
    resolved = (resolve_column(Dataset.Transactions))(search_key)
    if resolved == "transaction_name":
        transaction_field = _SEARCH_TO_PROTOCOL_FIELDS.get("transaction")
        return f"event.{transaction_field}"

    if resolved.startswith("tags["):
        stripped_search_key = resolved[5:-1]
        # In case a field is identified as a tag but the stripped search key is matching
        # an existing field, we want to use that instead.
        # For example 'tags[os]' or 'os' are resolved both to 'tags[os]' by `resolve_column`. To
        # generalizing the handling, we define the mapping only for 'os' and strip it accordingly.
        if field := _SEARCH_TO_PROTOCOL_FIELDS.get(stripped_search_key):
            return f"event.{field}"

        return f"event.tags.{stripped_search_key}"

    raise ValueError(f"Unsupported query field {search_key}")


def _get_satisfactory_metric(project: Project) -> str:
    """It returns the statisfactory response time threshold for the project and
    the associated metric ("transaction.duration" or "measurements.lcp")."""

    result = ProjectTransactionThreshold.filter(
        organization_id=project.organization.id,
        project_ids=[project.id],
        order_by=[],
        value_list=["metric"],
    )

    if len(result) == 0:
        metric = TransactionMetric.DURATION.value
    else:
        metric = result[0][0]

    if metric == TransactionMetric.DURATION.value:
        metric_field = "transaction.duration"
    elif metric == TransactionMetric.LCP.value:
        # We assume it's lcp since the enumerator contains only two possibilities.
        metric_field = "measurements.lcp"
    else:
        raise Exception("Invalid metric for project transaction threshold")

    return metric_field


def _escape_wildcard(value: str) -> str:
    """
    Escapes all characters in the wildcard which are considered as meta characters in the glob
    implementation in Relay, which can be found at: https://docs.rs/globset/latest/globset/#syntax.

    The goal of this function is to only preserve the `*` character as it is the only character that Sentry's
    product offers to users to perform wildcard matching.
    """
    i, n = 0, len(value)
    escaped = ""

    while i < n:
        c = value[i]
        i = i + 1

        if c in "[]{}?":
            escaped += rf"\{c}"
        else:
            escaped += c

    return escaped


T = TypeVar("T")


class SearchQueryConverter:
    """
    A converter from search query token stream to rule conditions.

    Pass a token stream obtained from `parse_search_query` to the constructor.
    The converter can be used exactly once.
    """

    def __init__(
        self, tokens: Sequence[QueryToken], field_mapper: Callable[[str], str] = _map_field_name
    ):
        self._tokens = tokens
        self._position = 0
        # The field mapper is used to map the field names in the search query to the event protocol path.
        self._field_mapper = field_mapper

    def convert(self) -> RuleCondition:
        """
        Converts the token stream into a rule condition.

        This function can raise an exception if the token stream is structurally
        invalid or contains fields that are not supported by the rule engine.
        """
        condition = self._expr()

        if self._position < len(self._tokens):
            raise ValueError("Unexpected trailing tokens")

        return condition

    def _peek(self) -> QueryToken | None:
        """Returns the next token without consuming it."""

        if self._position < len(self._tokens):
            return self._tokens[self._position]
        else:
            return None

    def _consume(self, pattern: str | type[T]) -> T | None:
        """
        Consumes the next token if it matches the given pattern.

        The pattern can be:
         - a literal string, in which case the token must be equal to the string
         - a type, in which case the token must be an instance of the type

        Returns the token if it matches, or ``None`` otherwise.
        """
        token = self._peek()

        if isinstance(pattern, str) and token != pattern:
            return None
        elif isinstance(pattern, type) and not isinstance(token, pattern):
            return None

        self._position += 1
        return cast(T, token)

    def _expr(self) -> RuleCondition:
        terms = [self._term()]

        while self._consume("OR") is not None:
            terms.append(self._term())

        if len(terms) == 1:
            return terms[0]
        else:
            return {"op": "or", "inner": terms}

    def _term(self) -> RuleCondition:
        factors = [self._factor()]

        while self._peek() not in ("OR", None):
            self._consume("AND")  # AND is optional and implicit, ignore if present.
            factors.append(self._factor())

        if len(factors) == 1:
            return factors[0]
        else:
            return {"op": "and", "inner": factors}

    def _factor(self) -> RuleCondition:
        if filt := self._consume(SearchFilter):
            return self._filter(filt)
        elif paren := self._consume(ParenExpression):
            return SearchQueryConverter(paren.children, self._field_mapper).convert()
        elif token := self._peek():
            raise ValueError(f"Unexpected token {token}")
        else:
            raise ValueError("Unexpected end of query")

    def _filter(self, token: SearchFilter) -> RuleCondition:
        operator = _SEARCH_TO_RELAY_OPERATORS.get(token.operator)
        if not operator:
            raise ValueError(f"Unsupported operator {token.operator}")

        # We propagate the filter in order to give as output a better error message with more context.
        key: str = token.key.name
        value: Any = token.value.raw_value
        if operator == "eq" and token.value.is_wildcard():
            condition: RuleCondition = {
                "op": "glob",
                "name": self._field_mapper(key),
                "value": [_escape_wildcard(value)],
            }
        else:
            # Special case for the `has` and `!has` operators which are parsed as follows:
            # - `has:x` -> `x != ""`
            # - `!has:x` -> `x = ""`
            # They both need to be translated to `x not eq null` and `x eq null`.
            if token.operator in ("!=", "=") and value == "":
                value = None

            if isinstance(value, str):
                value = event_search.translate_escape_sequences(value)

            condition = cast(
                RuleCondition,
                {
                    "op": operator,
                    "name": self._field_mapper(key),
                    "value": value,
                },
            )

        # In case we have negation operators, we have to wrap them in the `not` condition.
        if token.operator in ("!=", "NOT IN"):
            condition = {"op": "not", "inner": condition}

        return condition
