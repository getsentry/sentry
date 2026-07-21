from dataclasses import dataclass

from sentry.dynamic_sampling.models.base import Model, ModelInput
from sentry.dynamic_sampling.models.common import RebalancedItem, sum_classes_counts


@dataclass
class FullRebalancingInput(ModelInput):
    classes: list[RebalancedItem]
    sample_rate: float
    intensity: float
    min_budget: float | None = None
    min_sample_rate: float = 0.0

    def validate(self) -> bool:
        return (
            0.0 <= self.sample_rate <= 1.0
            and 0.0 <= self.intensity <= 1.0
            and 0.0 <= self.min_sample_rate <= 1.0
            and len(self.classes) > 0
        )


class FullRebalancingModel(Model[FullRebalancingInput, tuple[list[RebalancedItem], float]]):
    def _run(self, model_input: FullRebalancingInput) -> tuple[list[RebalancedItem], float]:
        """
        Tries to calculate rates that brings all counts close to the ideal count.

        The intensity controls how close, 0 intensity leaves the items unchanged, 1 brings the items to the
        ideal count ( or rate=1.0 if ideal count is too high).

        :param model_input.classes: The items to be balanced :param model_input.sample_rate: The overall rate
        necessary :param model_input.intensity: How close to the ideal should we go from our current position (0=do
        not change, 1 go to ideal) :param model_input.min_budget: Ensure that we use at least min_budget (in order to
        keep the overall rate)
        :param model_input.min_sample_rate: Absolute floor applied to every class's resulting rate. Bounds the
        extrapolation factor (1 / rate) so high-volume classes can't be pushed to a near-zero rate when many classes
        compete for the budget. The caller is responsible for keeping this at or below the overall sample rate.

        :return: A mapping with the frequency for all items + the amount of items used (it should allways be at least
        minimum_consumption if passed).
        """
        classes = model_input.classes
        sample_rate = model_input.sample_rate
        intensity = model_input.intensity
        min_budget = model_input.min_budget
        min_sample_rate = model_input.min_sample_rate

        total = sum_classes_counts(classes)
        num_classes = len(classes)

        if min_budget is None:
            # use exactly what we need (default handling when we resize everything)
            min_budget = total * sample_rate

        assert total >= min_budget
        ideal = total * sample_rate / num_classes

        used_budget: float = 0.0

        ret_val = []
        while classes:
            element = classes.pop()
            count = element.count
            if ideal * num_classes < min_budget:
                # if we keep to our ideal we will not be able to use the minimum budget (readjust our target)
                ideal = min_budget / num_classes
            # see what's the difference from our ideal
            sampled = count * sample_rate
            delta = ideal - sampled
            correction = delta * intensity
            desired_count = sampled + correction

            # floor the rate so the extrapolation factor stays bounded; reclaiming the extra
            # budget is left to the caller (it lowers the implicit/tail rate accordingly)
            desired_count = max(desired_count, count * min_sample_rate)

            if desired_count > count:
                # we need more than we have, the best we can do is give all, i.e. rate = 1.0
                new_sample_rate = 1.0
                used = count
            else:
                # we can spend what we want
                new_sample_rate = desired_count / count
                used = desired_count

            ret_val.append(
                RebalancedItem(id=element.id, count=count, new_sample_rate=new_sample_rate)
            )
            min_budget -= used
            used_budget += used
            num_classes -= 1

        return ret_val, used_budget
