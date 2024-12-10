import logging
from typing import cast

import orjson
from sentry_relay.processing import validate_rule_condition

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import PolymorphicRule
from sentry.models.dynamicsampling import CUSTOM_RULE_DATE_FORMAT, CustomDynamicSamplingRule
from sentry.models.project import Project
from sentry.relay.types import RuleCondition

logger = logging.getLogger(__name__)


class CustomRuleBias(Bias):
    """
    Boosts to 100% sample rate all the traces matching an active custom rule.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> list[PolymorphicRule]:
        rules = CustomDynamicSamplingRule.get_project_rules(project)

        ret_val: list[PolymorphicRule] = []

        for rule in rules:
            try:
                validate_rule_condition(rule.condition)
            except ValueError:
                logger.exception(
                    "Custom rule with invalid condition found",
                    extra={"rule_id": rule.rule_id, "condition": rule.condition},
                )
                continue

            try:
                condition = cast(RuleCondition, orjson.loads(rule.condition))
                ret_val.append(
                    {
                        "samplingValue": {"type": "reservoir", "limit": rule.num_samples},
                        "type": "transaction",
                        "id": rule.external_rule_id,
                        "condition": condition,
                        "timeRange": {
                            "start": rule.start_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                            "end": rule.end_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                        },
                    }
                )
            except orjson.JSONDecodeError:
                logger.exception(
                    "Custom rule with invalid json found",
                    extra={"rule_id": rule.rule_id, "condition": rule.condition},
                )
                continue

        return ret_val
