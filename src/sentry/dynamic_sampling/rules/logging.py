import logging
from typing import Dict, List, Union

import sentry_sdk

from sentry.dynamic_sampling.rules.utils import (
    DecayingFn,
    PolymorphicRule,
    RuleType,
    get_rule_hash,
    get_rule_type,
    get_sampling_value,
)

logger = logging.getLogger("sentry.dynamic_sampling")

# Maximum number of projects of which we track active releases. We need to bound this element in order to avoid out
# of memory errors. In case a single instance will receive a lot of requests from Relay, it will accumulate a lot of
# projects.
MAX_PROJECTS_IN_MEMORY = 1000

# Dictionary that contains a mapping between project_id -> active_rules where active_rules is rule_hash ->
# sample_rate. It is used to check whether the new set of rules has been actually changed, in order to log the
# change. This is a minor optimization to avoid flooding Google Cloud Logging with data.
#
# This data is stored in-memory for simplicity, however, it introduces a problem because Sentry is running in multiple
# instances without shared memory, therefore we might have different active rules on each instance. This will lead to
# some false positives, that is, rules are logged, but they are not changed. This can happen if a rule is marked as
# active by instance X, and then we receive it in instance Y that didn't see it before.
#
# If we find that this naive implementation generates too much data, we can always use a shared-memory architecture
# by using Redis for example.
active_rules: Dict[int, Dict[int, float]] = {}


def should_log_rules_change(project_id: int, rules: List[PolymorphicRule]) -> bool:
    active_rules_per_project = active_rules.get(project_id, None)
    new_rules_per_project = {}

    for rule in rules:
        if (sampling_value := get_sampling_value(rule)) is not None:
            # Here for simplicity we don't make a difference between sampling value type. In case we will end up in a
            # situation in which rules change their sampling value type and not value, we will need to address this
            # here.
            _, value = sampling_value
            new_rules_per_project[get_rule_hash(rule)] = value

    should_log = new_rules_per_project != active_rules_per_project
    if should_log:
        _delete_active_rule_if_limit(active_rules_per_project is None)
        active_rules[project_id] = new_rules_per_project

    return should_log


def _delete_active_rule_if_limit(is_new_project: bool) -> None:
    if is_new_project and len(active_rules) >= MAX_PROJECTS_IN_MEMORY:
        active_rules.popitem()


def log_rules(org_id: int, project_id: int, rules: List[PolymorphicRule]) -> None:
    try:
        if should_log_rules_change(project_id, rules):
            logger.info(
                "rules_generator.generate_rules",
                extra={
                    "org_id": org_id,
                    "project_id": project_id,
                    "rules": _format_rules(rules),
                },
            )
    except Exception as e:
        # If there is any problem while generating the log message, we just silently fail and notify the error to
        # Sentry.
        sentry_sdk.capture_exception(e)


def _format_rules(
    rules: List[PolymorphicRule],
) -> List[Dict[str, Union[List[str], str, float, None]]]:
    formatted_rules = []

    for rule in rules:
        rule_type = get_rule_type(rule)
        if (sampling_value := get_sampling_value(rule)) is not None:
            value_type, value = sampling_value
            formatted_rules.append(
                {
                    "id": rule["id"],
                    "type": rule_type.value if rule_type else "unknown_rule_type",
                    "samplingValue": {"type": value_type, "value": value},
                    **_extract_info_from_rule(rule_type, rule),  # type:ignore
                }
            )

    return formatted_rules  # type:ignore


def _extract_info_from_rule(
    rule_type: RuleType, rule: PolymorphicRule
) -> Dict[str, Union[DecayingFn, List[str], str, None]]:
    if rule_type == RuleType.BOOST_ENVIRONMENTS_RULE:
        return {"environments": rule["condition"]["inner"][0]["value"]}  # type:ignore
    elif rule_type == RuleType.BOOST_LATEST_RELEASES_RULE:
        return {
            "release": rule["condition"]["inner"][0]["value"],  # type:ignore
            "environment": rule["condition"]["inner"][1]["value"],  # type:ignore
            "decayingFn": rule["decayingFn"],  # type:ignore
        }
    elif rule_type == RuleType.IGNORE_HEALTH_CHECKS_RULE:
        return {"healthChecks": rule["condition"]["inner"][0]["value"]}  # type:ignore
    elif rule_type == RuleType.BOOST_KEY_TRANSACTIONS_RULE:
        return {"transactions": rule["condition"]["inner"][0]["value"]}  # type:ignore
    elif rule_type == RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE:
        inner_condition = rule["condition"]["inner"]  # type:ignore
        if isinstance(inner_condition, list) and len(inner_condition) > 0:
            return {"transaction": rule["condition"]["inner"][0]["value"]}  # type:ignore
        else:
            return {}
    else:
        return {}
