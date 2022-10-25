from typing import List

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.utils import BaseRule, generate_environment_rule, generate_uniform_rule
from sentry.models import Project


def generate_rules(project: Project) -> List[BaseRule]:
    """
    This function handles generate rules logic or fallback empty list of rules
    """
    rules = []

    sample_rate = quotas.get_blended_sample_rate(project)

    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
    else:
        boost_environments = DynamicSamplingFeatureMultiplexer.get_user_bias_by_id(
            "boostEnvironments", project.get_option("sentry:dynamic_sampling_biases", None)
        )
        if boost_environments["active"] and sample_rate < 1.0:
            rules.append(generate_environment_rule())
        rules.append(generate_uniform_rule(sample_rate))

    return rules
