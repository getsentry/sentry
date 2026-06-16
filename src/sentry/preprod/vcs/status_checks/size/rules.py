from __future__ import annotations

import logging
from typing import Any, Literal

from sentry.api.event_search import SearchConfig
from sentry.models.project import Project
from sentry.preprod.vcs.status_checks.size.types import RuleArtifactType, StatusCheckRule
from sentry.utils import json

logger = logging.getLogger(__name__)

ENABLED_OPTION_KEY = "sentry:preprod_size_status_checks_enabled"
RULES_OPTION_KEY = "sentry:preprod_size_status_checks_rules"

VALID_STATUS_CHECK_METRICS = frozenset({"install_size", "download_size"})
VALID_STATUS_CHECK_MEASUREMENTS = frozenset({"absolute", "absolute_diff", "relative_diff"})
VALID_STATUS_CHECK_FILTER_KEYS = frozenset(
    {"app_id", "build_configuration_name", "git_head_ref", "platform_name"}
)
STATUS_CHECK_FILTER_OPERATOR_NEGATIONS = {
    "contains": "notContains",
    "endsWith": "notEndsWith",
    "equals": "notEquals",
    "in": "notIn",
    "matches": "notMatches",
    "startsWith": "notStartsWith",
}
VALID_STATUS_CHECK_FILTER_OPERATORS = frozenset(
    {
        *STATUS_CHECK_FILTER_OPERATOR_NEGATIONS.keys(),
        *STATUS_CHECK_FILTER_OPERATOR_NEGATIONS.values(),
    }
)

PREPROD_ARTIFACT_SEARCH_CONFIG = SearchConfig.create_from(
    SearchConfig[Literal[True]](),
    text_operator_keys=VALID_STATUS_CHECK_FILTER_KEYS,
    key_mappings={
        "platform_name": ["platform_name"],
        "git_head_ref": ["git_head_ref"],
        "app_id": ["app_id"],
        "build_configuration_name": ["build_configuration_name"],
    },
    allowed_keys=VALID_STATUS_CHECK_FILTER_KEYS,
)


def get_status_checks_enabled(project: Project) -> bool:
    return bool(project.get_option(ENABLED_OPTION_KEY, default=True))


def get_status_check_rules(project: Project) -> list[StatusCheckRule]:
    """
    Fetch and parse status check rules from project options.

    Returns an empty list if feature is disabled or no rules configured.
    """

    raw = project.get_option(RULES_OPTION_KEY, default=None)
    if not raw:
        return []

    try:
        # Handle bytes from project options (json.loads requires str, not bytes)
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        rules_data = json.loads(raw) if isinstance(raw, str) else raw

        if not isinstance(rules_data, list):
            logger.warning(
                "preprod.status_checks.rules.invalid_format",
                extra={"project_id": project.id, "rules_type": type(rules_data).__name__},
            )
            return []

        rules: list[StatusCheckRule] = []
        for rule_dict in rules_data:
            rule = _parse_rule(rule_dict, project_id=project.id)
            if rule is not None:
                rules.append(rule)
        return rules
    except (json.JSONDecodeError, TypeError, ValueError, AttributeError) as e:
        logger.warning(
            "preprod.status_checks.rules.parse_error",
            extra={"project_id": project.id, "error": str(e)},
        )
        return []


def _parse_rule(rule_dict: Any, *, project_id: int) -> StatusCheckRule | None:
    rule_id = rule_dict.get("id")
    metric = rule_dict.get("metric")
    measurement = rule_dict.get("measurement")
    value = rule_dict.get("value")

    if (
        not isinstance(rule_id, str)
        or not isinstance(metric, str)
        or not isinstance(measurement, str)
        or not isinstance(value, (int, float))
    ):
        logger.warning(
            "preprod.status_checks.rules.invalid_rule",
            extra={"project_id": project_id, "rule_id": rule_id},
        )
        return None

    filter_query_raw = rule_dict.get("filterQuery", "")
    filter_query = str(filter_query_raw) if filter_query_raw is not None else ""
    artifact_type = (
        RuleArtifactType.from_raw(rule_dict.get("artifactType")) or RuleArtifactType.MAIN_ARTIFACT
    )

    return StatusCheckRule(
        id=rule_id,
        metric=metric,
        measurement=measurement,
        value=float(value),
        filter_query=str(filter_query),
        artifact_type=artifact_type,
    )
