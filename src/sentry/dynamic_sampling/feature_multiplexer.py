from typing import TYPE_CHECKING, Callable, List, Optional, Set

from sentry import features, options
from sentry.dynamic_sampling.utils import DEFAULT_BIASES, Bias

if TYPE_CHECKING:
    from sentry.models import Project


class DynamicSamplingBiasesContext:
    def __init__(self, get_user_set_biases: Callable[[], Optional[List[Bias]]] = lambda: None):
        self.get_user_set_biases = get_user_set_biases

    def get_user_biases(self) -> List[Bias]:
        return self._merge_default_and_user_set(self.get_user_set_biases())

    def get_enabled_user_biases(self) -> Set[str]:
        return {bias["id"] for bias in self.get_user_biases() if bias["active"]}

    @staticmethod
    def _merge_default_and_user_set(user_set_biases: Optional[List[Bias]]) -> List[Bias]:
        if user_set_biases is None:
            return DEFAULT_BIASES

        id_to_user_bias = {bias["id"]: bias for bias in user_set_biases}
        merged_biases = []
        for bias in DEFAULT_BIASES:
            if bias["id"] in id_to_user_bias:
                merged_biases.append(id_to_user_bias[bias["id"]])
            else:
                merged_biases.append(bias)

        return merged_biases

    @staticmethod
    def get_supported_biases_ids() -> Set[str]:
        return {bias["id"] for bias in DEFAULT_BIASES}


class DynamicSamplingFeatureMultiplexer:
    def __init__(self, project: "Project"):
        self.project = project

    @property
    def is_on_dynamic_sampling(self) -> bool:
        # Feature flag that informs us that the org is on the new AM2 plan and thereby have adaptive
        # sampling enabled.
        return features.has(
            "organizations:dynamic-sampling", self.project.organization
        ) and options.get("dynamic-sampling:enabled-biases")

    @staticmethod
    def build_dynamic_sampling_biases_context(
        block: Callable[[], Optional[List[Bias]]] = lambda: None
    ) -> DynamicSamplingBiasesContext:
        return DynamicSamplingBiasesContext(block)
