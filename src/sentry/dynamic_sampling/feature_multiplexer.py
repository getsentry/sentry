from typing import TYPE_CHECKING, List, Optional, Set

from sentry import features, options
from sentry.dynamic_sampling.utils import DEFAULT_BIASES, Bias

if TYPE_CHECKING:
    from sentry.models import Project


class DynamicSamplingFeatureMultiplexer:
    def __init__(self, project: "Project"):
        # Feature flag that informs us that the org is on the new AM2 plan and thereby have adaptive
        # sampling enabled
        self.dynamic_sampling = features.has("organizations:dynamic-sampling", project.organization)

    @property
    def is_on_dynamic_sampling(self) -> bool:
        return self.dynamic_sampling and options.get("dynamic-sampling:enabled-biases")

    @staticmethod
    def get_user_biases(user_set_biases: Optional[List[Bias]]) -> List[Bias]:
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

    @classmethod
    def get_enabled_user_biases(cls, user_set_biases: Optional[List[Bias]]) -> Set[str]:
        users_biases = cls.get_user_biases(user_set_biases)
        return {bias["id"] for bias in users_biases if bias["active"]}

    @staticmethod
    def get_supported_biases_ids() -> Set[str]:
        return {bias["id"] for bias in DEFAULT_BIASES}
