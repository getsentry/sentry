from typing import List, cast

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import Condition, PolymorphicRule
from sentry.models.dynamicsampling import CUSTOM_RULE_DATE_FORMAT, CustomDynamicSamplingRule
from sentry.models.project import Project
from sentry.utils import json


class CustomRuleBias(Bias):
    """
    Boosts at 100% sample rate all the traces that have a replay_id.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        rules = CustomDynamicSamplingRule.get_project_rules(project)

        ret_val: List[PolymorphicRule] = []

        for rule in rules:
            condition = json.loads(rule.condition)
            ret_val.append(
                {
                    "samplingValue": {"type": "reservoir", "limit": rule.num_samples},
                    "type": "transaction",
                    "id": rule.external_rule_id,
                    "condition": cast(Condition, condition),
                    "timeRange": {
                        "start": rule.start_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                        "end": rule.end_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                    },
                }
            )
        return ret_val
