from typing import Any, List, TypedDict

import sentry_sdk

from sentry import features, quotas
from sentry.models import Project

UNIFORM_RULE_RESERVED_ID = 0

# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling experience.
# These can be overridden by the project details endpoint
DEFAULT_BIASES = [
    {"id": "boostEnvironments", "active": True},
    {
        "id": "boostLatestRelease",
        "active": True,
    },
    {"id": "ignoreHealthChecks", "active": True},
]


class NoneSampleRateException(Exception):
    ...


class Condition(TypedDict):
    op: str
    inner: List[Any]


class UniformRule(TypedDict):
    sampleRate: float
    type: str
    active: bool
    condition: Condition
    id: int


def generate_uniform_rule(project: Project) -> UniformRule:
    sample_rate = quotas.get_blended_sample_rate(project)
    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
        raise NoneSampleRateException
    return {
        "sampleRate": sample_rate,
        "type": "trace",
        "active": True,
        "condition": {
            "op": "and",
            "inner": [],
        },
        "id": UNIFORM_RULE_RESERVED_ID,
    }


class DynamicSamplingFeatureMultiplexer:
    """
    This class is used to route DS behaviour according to the feature flags listed here
    Essentially the logic is as follows:
    - The `organizations:server-side-sampling` feature flag is the main flag enabled for dynamic sampling both in
    sentry and in relay
    - The  `organizations:server-side-sampling-ui` feature flag is the flag that enables the old dynamic sampling
    behaviour which needs to be supported for backwards compatibility but is deprecated
    - The `organizations:dynamic-sampling-basic` feature flag is the flag that enables the new adaptive sampling
    """

    def __init__(self, project, request):
        # Feature flag that informs us that relay is handling DS rules
        self.allow_dynamic_sampling = features.has(
            "organizations:server-side-sampling", project.organization, actor=request.user
        )
        # Feature flag that informs us that the org is on the new AM2 plan and thereby have adaptive sampling enabled
        # ToDo(ahmed): This needs to be renamed to `organizations:dynamic-sampling`
        self.current_dynamic_sampling = features.has(
            "organizations:dynamic-sampling-basic", project.organization, actor=request.user
        )
        # Flag responsible to inform us if the org was in the original LA/EA Dynamic Sampling
        # ToDo(ahmed): This needs to be renamed to `organizations:dynamic-sampling-deprecated`
        self.deprecated_dynamic_sampling = features.has(
            "organizations:server-side-sampling-ui", project.organization, actor=request.user
        )

    def is_on_dynamic_sampling_deprecated(self):
        return (
            self.allow_dynamic_sampling
            and self.deprecated_dynamic_sampling
            and not self.current_dynamic_sampling
        )

    def is_on_dynamic_sampling(self):
        return self.allow_dynamic_sampling and self.current_dynamic_sampling

    def get_user_biases(self, user_set_biases):
        if user_set_biases is None:
            return DEFAULT_BIASES

        id_to_user_bias = {bias["id"]: bias for bias in user_set_biases}
        returned_biases = []
        for bias in DEFAULT_BIASES:
            if bias["id"] in id_to_user_bias:
                returned_biases.append(id_to_user_bias[bias["id"]])
            else:
                returned_biases.append(bias)
        return returned_biases
