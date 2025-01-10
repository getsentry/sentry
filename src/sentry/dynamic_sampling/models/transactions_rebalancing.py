from dataclasses import dataclass

from sentry.dynamic_sampling.models.base import Model, ModelInput, ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, sum_classes_counts
from sentry.dynamic_sampling.models.full_rebalancing import FullRebalancingInput


@dataclass
class TransactionsRebalancingInput(ModelInput):
    classes: list[RebalancedItem]
    sample_rate: float
    total_num_classes: int | None
    total: float | None
    intensity: float

    def validate(self) -> bool:
        return (
            0.0 <= self.sample_rate <= 1.0
            and 0.0 <= self.intensity <= 1.0
            and len(self.classes) > 0
        )


class TransactionsRebalancingModel(
    Model[TransactionsRebalancingInput, tuple[list[RebalancedItem], float]]
):
    def _run(self, model_input: TransactionsRebalancingInput) -> tuple[list[RebalancedItem], float]:
        """
        Adjusts sampling rates to bring the number of samples kept in each class as close to
        the same value as possible while maintaining the overall sampling rate.

        The algorithm adjusts the explicitly given classes individually to bring them to
        the ideal sample rate and then adjusts the global sample rate for all the remaining classes.

        :param model_input.classes: a list of class id, num_samples in class
        :param model_input.sample_rate: global rate of sampling desired
        :param model_input.total_num_classes: total number of classes (including the explicitly specified in classes)
        :param model_input.intensity: the adjustment strength 0: no adjustment, 1: try to bring everything to mean
        :param model_input.total: total number of samples in all classes (including the explicitly specified classes)

        :return: a list of items with calculated sample_rates and a rate for all other (unspecified) classes.
        """
        classes = model_input.classes
        sample_rate = model_input.sample_rate
        total_num_classes = model_input.total_num_classes
        total = model_input.total
        intensity = model_input.intensity

        classes = sorted(classes, key=lambda x: (x.count, x.id), reverse=True)

        # total count for the explicitly specified classes
        total_explicit = sum_classes_counts(classes)

        if total is None:
            total = total_explicit

        # invariant violation: total number of classes should be at least the number of specified classes
        # sometimes (maybe due to running the queries at slightly different times), the totals number might be less.
        # in this case we should use the number of specified classes as the total number of classes
        if total_num_classes is None or total_num_classes < len(classes):
            total_num_classes = len(classes)

        # total count for the unspecified classes
        total_implicit = total - total_explicit
        # total number of specified classes
        num_explicit_classes = len(classes)
        # total number of unspecified classes
        num_implicit_classes = total_num_classes - num_explicit_classes

        total_budget = total * sample_rate
        budget_per_class = total_budget / total_num_classes

        implicit_budget = budget_per_class * num_implicit_classes
        explicit_budget = budget_per_class * num_explicit_classes

        from sentry.dynamic_sampling.models.factory import model_factory

        full_rebalancing = model_factory(ModelType.FULL_REBALANCING)

        if num_explicit_classes == total_num_classes:
            # we have specified all classes
            explicit_rates, _used = full_rebalancing.run(
                FullRebalancingInput(classes=classes, sample_rate=sample_rate, intensity=intensity)
            )
            implicit_rate = sample_rate  # doesn't really matter since everything is explicit
        elif total_implicit < implicit_budget:
            # we would not be able to spend all implicit budget we can only spend
            # a maximum of total_implicit, set the implicit rate to 1
            # and reevaluate the available budget for the explicit classes
            implicit_rate = 1
            # we spent all we could on the implicit classes see what budget we
            # have left
            explicit_budget = total_budget - total_implicit
            # calculate the new global rate for the explicit transactions that
            # would bring the overall rate to the desired rate
            explicit_rate = explicit_budget / total_explicit
            explicit_rates, _used = full_rebalancing.run(
                FullRebalancingInput(
                    classes=classes, sample_rate=explicit_rate, intensity=intensity
                )
            )
        elif total_explicit < explicit_budget:
            # we would not be able to spend all explicit budget we can only
            # send a maximum of total_explicit so set the explicit rate to 1 for
            # all explicit classes and reevaluate the available budget for the implicit classes
            explicit_rates = [
                RebalancedItem(id=element.id, count=element.count, new_sample_rate=1.0)
                for element in classes
            ]

            # calculate the new global rate for the implicit transactions
            implicit_budget = total_budget - total_explicit
            implicit_rate = implicit_budget / total_implicit
        else:
            # we can spend all the implicit budget on the implicit classes
            # and all the explicit budget on the explicit classes
            # see exactly how much we spend on the explicit classes
            # and leave the rest for the implicit classes

            # calculate what is the minimum amount we need to spend on the
            # explicit classes (so that we maintain the overall rate)
            # if it is <= 0 then we don't have a minimum
            minimum_explicit_budget = total_budget - total_implicit
            explicit_rate = explicit_budget / total_explicit

            explicit_rates, used = full_rebalancing.run(
                FullRebalancingInput(
                    classes=classes,
                    sample_rate=explicit_rate,
                    intensity=intensity,
                    min_budget=minimum_explicit_budget,
                )
            )
            # recalculate implicit_budget based on used
            implicit_budget = total_budget - used
            implicit_rate = implicit_budget / total_implicit

        return explicit_rates, implicit_rate
