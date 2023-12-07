import logging
from datetime import datetime, timedelta, timezone
from typing import List, OrderedDict, Set

import sentry_sdk

from sentry import features, quotas
from sentry.db.models import Model
from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.combine import get_relay_biases_combinator
from sentry.dynamic_sampling.rules.logging import log_rules
from sentry.dynamic_sampling.rules.utils import PolymorphicRule, RuleType, get_enabled_user_biases
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import get_sliding_window_sample_rate
from sentry.models.organization import Organization
from sentry.models.project import Project

# These rules types will always be added to the generated rules, irrespectively of the base sample rate.
ALWAYS_ALLOWED_RULE_TYPES = {RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE, RuleType.CUSTOM_RULE}
# This threshold should be in sync with the execution time of the cron job responsible for running the sliding window.
NEW_MODEL_THRESHOLD_IN_MINUTES = 10


logger = logging.getLogger("sentry.dynamic_sampling")


def is_recently_added(model: Model) -> bool:
    """
    Checks whether a specific model has been recently added, with the goal of using this information
    to infer whether we should boost a specific project.

    The boosting has been implemented because we want to guarantee that the user will have a good onboarding
    experience. In theory with the sliding window mechanism we will automatically give 100% also to new projects, but
    it can also happen that there are problems with cron jobs and in that case, if we don't have a specific condition
    like this one, the boosting will not happen.
    """
    if hasattr(model, "date_added"):
        ten_minutes_ago = datetime.now(tz=timezone.utc) - timedelta(
            minutes=NEW_MODEL_THRESHOLD_IN_MINUTES
        )
        return bool(model.date_added >= ten_minutes_ago)

    return False


def is_sliding_window_enabled(organization: Organization) -> bool:
    return not features.has(
        "organizations:ds-sliding-window-org", organization, actor=None
    ) and features.has("organizations:ds-sliding-window", organization, actor=None)


def is_sliding_window_org_enabled(organization: Organization) -> bool:
    return features.has(
        "organizations:ds-sliding-window-org", organization, actor=None
    ) and not features.has("organizations:ds-sliding-window", organization, actor=None)


def get_guarded_blended_sample_rate(organization: Organization, project: Project) -> float:
    sample_rate = quotas.get_blended_sample_rate(organization_id=organization.id)  # type:ignore

    # If the sample rate is None, it means that dynamic sampling rules shouldn't be generated.
    if sample_rate is None:
        raise Exception("get_blended_sample_rate returns none")

    # If the sample rate is 100%, we don't want to use any special dynamic sample rate, we will just sample at 100%.
    if sample_rate == 1.0:
        return float(sample_rate)

    # For now, we will keep this new boost for orgs with the sliding window enabled.
    #
    # In case the organization or the project have been recently added, we want to boost to 100% in order to give users
    # a better experience. Once this condition will become False, the dynamic sampling systems will kick in.
    if is_recently_added(model=project) or is_recently_added(model=organization):
        return 1.0

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
        sample_rate = get_boost_low_volume_projects_sample_rate(
            org_id=organization.id, project_id=project.id, error_sample_rate_fallback=sample_rate
        )

    return float(sample_rate)


def _get_rules_of_enabled_biases(
    project: Project,
    base_sample_rate: float,
    enabled_biases: Set[str],
    combined_biases: OrderedDict[RuleType, Bias],
) -> List[PolymorphicRule]:
    rules = []

    for rule_type, bias in combined_biases.items():
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
                logger.exception("Rule generator %s failed.", rule_type)

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
