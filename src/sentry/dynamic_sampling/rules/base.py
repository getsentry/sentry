import logging
from typing import List, OrderedDict, Set

import sentry_sdk

from sentry import features, quotas
from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.combine import get_relay_biases_combinator
from sentry.dynamic_sampling.rules.helpers.prioritise_project import (
    get_prioritise_by_project_sample_rate,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import get_sliding_window_sample_rate
from sentry.dynamic_sampling.rules.logging import log_rules
from sentry.dynamic_sampling.rules.utils import PolymorphicRule, RuleType, get_enabled_user_biases
from sentry.models import Organization, Project

ALWAYS_ALLOWED_RULE_TYPES = {RuleType.RECALIBRATION_RULE, RuleType.UNIFORM_RULE}


logger = logging.getLogger("sentry.dynamic_sampling")


def get_guarded_blended_sample_rate(organization: Organization, project: Project) -> float:
    sample_rate = quotas.get_blended_sample_rate(organization_id=organization.id)

    if sample_rate is None:
        raise Exception("get_blended_sample_rate returns none")

    # We want to use the normal sliding window only if the sliding window at the org level is disabled.
    if not features.has(
        "organizations:ds-sliding-window-org", organization, actor=None
    ) and features.has("organizations:ds-sliding-window", organization, actor=None):
        # In case we didn't find the sliding window sample rate, we assume the project is new, and we give it a 100%
        # sample rate. Note that technically if there is no value in cache an error might have happened, but we are
        # tracking those errors, thus if they happen lots of time we are going to implement a proper fallback
        # mechanism.
        sample_rate = get_sliding_window_sample_rate(project, default_sample_rate=1.0)
    else:
        sample_rate = get_prioritise_by_project_sample_rate(
            project, default_sample_rate=float(sample_rate)
        )

    return float(sample_rate)


def _get_rules_of_enabled_biases(
    project: Project,
    base_sample_rate: float,
    enabled_biases: Set[str],
    combined_biases: OrderedDict[RuleType, Bias],
) -> List[PolymorphicRule]:
    rules = []

    for (rule_type, bias) in combined_biases.items():
        # All biases besides ALWAYS_ALLOWED_RULE_TYPES won't be enabled in case we have 100% base sample rate. This
        # has been done because if we don't have a sample rate < 100%, it doesn't make sense to enable dynamic
        # sampling in the first place. Technically dynamic sampling it is still enabled but for our customers this
        # detail is not important.
        if rule_type in ALWAYS_ALLOWED_RULE_TYPES or (
            rule_type.value in enabled_biases and 0.0 < base_sample_rate < 1.0
        ):
            try:
                rules += bias.generate_rules(project, base_sample_rate)
            except Exception:
                logger.exception(f"Rule generator {rule_type} failed.")

    log_rules(project.organization.id, project.id, rules)

    return rules


def generate_rules(project: Project) -> List[PolymorphicRule]:
    organization = project.organization

    try:
        rules = _get_rules_of_enabled_biases(
            project,
            get_guarded_blended_sample_rate(organization, project),
            get_enabled_user_biases(project.get_option("sentry:dynamic_sampling_biases", None)),
            get_relay_biases_combinator(organization).get_combined_biases(),
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []
    else:
        return rules
