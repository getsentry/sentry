from typing import List, OrderedDict, Set

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.rules.biases.base import Bias, BiasParams
from sentry.dynamic_sampling.rules.combine import DEFAULT_COMBINATOR
from sentry.dynamic_sampling.rules.logging import log_rules
from sentry.dynamic_sampling.rules.utils import BaseRule, RuleType, get_enabled_user_biases
from sentry.models import Project

ALWAYS_ALLOWED_RULE_TYPES = {RuleType.UNIFORM_RULE}


def _get_guarded_blended_sample_rate(project: Project) -> float:
    sample_rate = quotas.get_blended_sample_rate(project)

    if sample_rate is None:
        raise Exception("The method get_blended_sample_rate() returned None")

    return float(sample_rate)


def _get_rules_of_enabled_biases(
    project: Project,
    base_sample_rate: float,
    enabled_biases: Set[str],
    combined_biases: OrderedDict[RuleType, Bias],
) -> List[BaseRule]:
    rules = []

    for (rule_type, bias) in combined_biases.items():
        if rule_type in ALWAYS_ALLOWED_RULE_TYPES or (
            rule_type.value in enabled_biases and base_sample_rate < 1.0
        ):
            rules += bias.get_rules(BiasParams(project, base_sample_rate))

    log_rules(project.organization.id, project.id, rules)

    return rules


def generate_rules(project: Project) -> List[BaseRule]:
    try:
        return _get_rules_of_enabled_biases(
            project,
            _get_guarded_blended_sample_rate(project),
            get_enabled_user_biases(project.get_option("sentry:dynamic_sampling_biases", None)),
            DEFAULT_COMBINATOR.get_combined_biases(),
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []
