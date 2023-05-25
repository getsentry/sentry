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


def is_sliding_window_enabled(organization: Organization) -> bool:
    return not features.has(
        "organizations:ds-sliding-window-org", organization, actor=None
    ) and features.has("organizations:ds-sliding-window", organization, actor=None)


def get_guarded_blended_sample_rate(organization: Organization, project: Project) -> float:
    sample_rate = quotas.get_blended_sample_rate(organization_id=organization.id)

    # If the sample rate is None, it means that dynamic sampling rules shouldn't be generated.
    if sample_rate is None:
        raise Exception("get_blended_sample_rate returns none")

    # If the sample rate is 100%, we don't want to use any special dynamic sample rate, we will just sample at 100%.
    if sample_rate == 1.0:
        return float(sample_rate)

    # We want to use the normal sliding window only if the sliding window at the org level is disabled.
    if is_sliding_window_enabled(organization):
        # In case we use sliding window, we want to fall back to the original sample rate in case there was an error,
        # whereas if we don't find a value in cache, we just sample at 100% under the assumption that the project
        # has just been created.
        sample_rate = get_sliding_window_sample_rate(
            org_id=organization.id, project_id=project.id, error_sample_rate_fallback=sample_rate
        )
    else:
        # In case we use the prioritise by project, we want to fall back to the original sample rate in case there are
        # any issues.
        sample_rate = get_prioritise_by_project_sample_rate(
            project=project, default_sample_rate=sample_rate
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
