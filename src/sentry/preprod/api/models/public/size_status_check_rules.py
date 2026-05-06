from __future__ import annotations

from typing import Literal, TypedDict, cast, get_args

from sentry.api.event_search import (
    WILDCARD_CHARS,
    SearchFilter,
    SearchValue,
    parse_search_query,
    translate_escape_sequences,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.preprod.vcs.status_checks.size.rules import (
    PREPROD_ARTIFACT_SEARCH_CONFIG,
    STATUS_CHECK_FILTER_OPERATOR_NEGATIONS,
    get_status_check_rules,
    get_status_checks_enabled,
)
from sentry.preprod.vcs.status_checks.size.types import RuleArtifactType, StatusCheckRule

SizeStatusCheckRuleMetric = Literal["install_size", "download_size"]
SizeStatusCheckRuleMeasurement = Literal["absolute", "absolute_diff", "relative_diff"]
SizeStatusCheckRuleArtifactType = Literal[
    "main_artifact",
    "watch_artifact",
    "android_dynamic_feature_artifact",
    "app_clip_artifact",
    "all_artifacts",
]
SizeStatusCheckRuleFilterKey = Literal[
    "app_id",
    "build_configuration_name",
    "git_head_ref",
    "platform_name",
]
SizeStatusCheckRuleFilterOperator = Literal[
    "contains",
    "endsWith",
    "equals",
    "in",
    "matches",
    "notContains",
    "notEndsWith",
    "notEquals",
    "notIn",
    "notMatches",
    "notStartsWith",
    "startsWith",
]


class SizeStatusCheckRuleFilterConditionResponseDict(TypedDict):
    operator: SizeStatusCheckRuleFilterOperator
    values: list[str]


class SizeStatusCheckRuleFilterResponseDict(TypedDict):
    key: SizeStatusCheckRuleFilterKey
    conditions: list[SizeStatusCheckRuleFilterConditionResponseDict]


class SizeStatusCheckRuleResponseDict(TypedDict):
    id: str
    metric: SizeStatusCheckRuleMetric
    measurement: SizeStatusCheckRuleMeasurement
    value: str
    filterQuery: str
    filters: list[SizeStatusCheckRuleFilterResponseDict] | None
    artifactType: SizeStatusCheckRuleArtifactType


class ProjectSizeStatusCheckRulesResponseDict(TypedDict):
    enabled: bool
    rules: list[SizeStatusCheckRuleResponseDict]


def _format_rule_value(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value)


def _is_public_status_check_rule(rule: StatusCheckRule) -> bool:
    return rule.metric in get_args(SizeStatusCheckRuleMetric) and rule.measurement in get_args(
        SizeStatusCheckRuleMeasurement
    )


def _negate_operator(
    operator: SizeStatusCheckRuleFilterOperator,
) -> SizeStatusCheckRuleFilterOperator:
    return cast(
        SizeStatusCheckRuleFilterOperator,
        STATUS_CHECK_FILTER_OPERATOR_NEGATIONS.get(operator, operator),
    )


def _format_filter_value(raw_value: object) -> str:
    return translate_escape_sequences(str(raw_value))


def _wildcard_positions(value: str) -> list[int]:
    return [match.end() - 1 for match in WILDCARD_CHARS.finditer(value)]


def _operator_and_values(
    search_value: SearchValue, is_negation: bool
) -> tuple[SizeStatusCheckRuleFilterOperator, list[str]]:
    if not search_value.is_wildcard():
        operator: SizeStatusCheckRuleFilterOperator = "equals"
        values = [_format_filter_value(search_value.raw_value)]
    else:
        value = str(search_value.raw_value)
        wildcard_positions = _wildcard_positions(value)
        if wildcard_positions == [0, len(value) - 1] and len(value) > 2:
            operator = "contains"
            values = [_format_filter_value(value[1:-1])]
        elif wildcard_positions == [0] and len(value) > 1:
            operator = "endsWith"
            values = [_format_filter_value(value[1:])]
        elif wildcard_positions == [len(value) - 1] and len(value) > 1:
            operator = "startsWith"
            values = [_format_filter_value(value[:-1])]
        else:
            operator = "matches"
            values = [value]

    if is_negation:
        operator = _negate_operator(operator)

    return operator, values


def _raw_filter_values(search_filter: SearchFilter) -> list[object]:
    if isinstance(search_filter.value.raw_value, (list, tuple)):
        return list(search_filter.value.raw_value)
    return [search_filter.value.raw_value]


def _condition_from_search_filter(
    search_filter: SearchFilter,
) -> SizeStatusCheckRuleFilterConditionResponseDict:
    if search_filter.is_in_filter:
        if search_filter.value.is_wildcard():
            operator: SizeStatusCheckRuleFilterOperator = "matches"
            if search_filter.is_negation:
                operator = _negate_operator(operator)
            return {
                "operator": operator,
                "values": [str(raw_value) for raw_value in _raw_filter_values(search_filter)],
            }

        operator = "notIn" if search_filter.is_negation else "in"
        values = [
            _format_filter_value(raw_value) for raw_value in _raw_filter_values(search_filter)
        ]
        return {"operator": operator, "values": values}

    operator, values = _operator_and_values(search_filter.value, search_filter.is_negation)
    return {"operator": operator, "values": values}


def create_filters(filter_query: str) -> list[SizeStatusCheckRuleFilterResponseDict] | None:
    if not filter_query or not filter_query.strip():
        return []

    try:
        search_filters = [
            search_filter
            for search_filter in parse_search_query(
                filter_query, config=PREPROD_ARTIFACT_SEARCH_CONFIG
            )
            if isinstance(search_filter, SearchFilter)
        ]
    except InvalidSearchQuery:
        return None

    filters: dict[str, SizeStatusCheckRuleFilterResponseDict] = {}
    for search_filter in search_filters:
        filter_key = search_filter.key.name
        group_key = f"{filter_key}:{'negated' if search_filter.is_negation else 'normal'}"
        if group_key not in filters:
            filters[group_key] = {
                "key": cast(SizeStatusCheckRuleFilterKey, filter_key),
                "conditions": [],
            }

        filters[group_key]["conditions"].append(_condition_from_search_filter(search_filter))

    return list(filters.values())


def create_status_check_rule_dict(rule: StatusCheckRule) -> SizeStatusCheckRuleResponseDict:
    artifact_type = rule.artifact_type or RuleArtifactType.MAIN_ARTIFACT
    return {
        "id": rule.id,
        "metric": cast(SizeStatusCheckRuleMetric, rule.metric),
        "measurement": cast(SizeStatusCheckRuleMeasurement, rule.measurement),
        "value": _format_rule_value(rule.value),
        "filterQuery": rule.filter_query,
        "filters": create_filters(rule.filter_query),
        "artifactType": artifact_type.value,
    }


def create_project_status_check_rules_response(
    project: Project,
) -> ProjectSizeStatusCheckRulesResponseDict:
    return {
        "enabled": get_status_checks_enabled(project),
        "rules": [
            create_status_check_rule_dict(rule)
            for rule in get_status_check_rules(project)
            if _is_public_status_check_rule(rule)
        ],
    }
