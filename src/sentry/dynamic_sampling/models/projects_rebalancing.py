from dataclasses import dataclass
from typing import List

from sentry.dynamic_sampling.models.base import Model, ModelInput, ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.full_rebalancing import FullRebalancingInput


@dataclass
class ProjectsRebalancingInput(ModelInput):
    classes: List[RebalancedItem]
    sample_rate: float

    def validate(self) -> bool:
        return 0.0 <= self.sample_rate <= 1.0


class ProjectsRebalancingModel(Model[ProjectsRebalancingInput, List[RebalancedItem]]):
    def _run(self, model_input: ProjectsRebalancingInput) -> List[RebalancedItem]:
        classes = model_input.classes
        sample_rate = model_input.sample_rate

        if len(classes) == 0:
            return classes

        if len(classes) == 1:
            classes[0].new_sample_rate = sample_rate

        sorted_classes = sorted(classes, key=lambda x: (x.count, x.id), reverse=True)

        from sentry.dynamic_sampling.models.factory import model_factory

        full_rebalancing = model_factory(ModelType.FULL_REBALANCING)
        result, _ = full_rebalancing.run(
            FullRebalancingInput(
                classes=sorted_classes,
                sample_rate=sample_rate,
                intensity=1,
            )
        )

        return result
