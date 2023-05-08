from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple, Union

from sentry.dynamic_sampling.rules.utils import ProjectId, TransactionName


@dataclass
class DSElement:
    id: Union[ProjectId, TransactionName]
    count: float
    new_sample_rate: float = 0.0


def adjust_sample_rates(
    classes: List[DSElement],
    rate: float,
    total_num_classes: Optional[int],
    total: Optional[float],
    intensity: float,
) -> Tuple[List[DSElement], float]:
    """
    Adjusts sampling rates to bring the number of samples kept in each class as close to
    the same value as possible while maintaining the overall sampling rate.

    The algorithm adjusts the explicitly given classes individually to bring them to
    the ideal sample rate and then adjusts the global sample rate for all the remaining classes.

    :param classes: a list of class id, num_samples in class
    :param rate: global rate of sampling desired
    :param total_num_classes: total number of classes (including the explicitly specified in classes)
    :param intensity: the adjustment strength 0: no adjustment, 1: try to bring everything to mean
    :param total: total number of samples in all classes (including the explicitly specified classes)

    :return: a list of DSElement with calculated sample_rates and  a rate for all other (unspecified) classes.
    """

    classes = sorted(classes, key=lambda x: (x.count, x.id), reverse=True)

    # total count for the explicitly specified classes
    total_explicit = sum_counts(classes)

    if total is None:
        total = total_explicit

    if total_num_classes is None:
        total_num_classes = len(classes)

    # total count for the unspecified classes
    total_implicit = total - total_explicit
    # total number of specified classes
    num_explicit_classes = len(classes)
    # total number of unspecified classes
    num_implicit_classes = total_num_classes - num_explicit_classes

    total_budget = total * rate
    budget_per_class = total_budget / total_num_classes

    implicit_budget = budget_per_class * num_implicit_classes
    explicit_budget = budget_per_class * num_explicit_classes

    if num_explicit_classes == total_num_classes:
        # we have specified all classes
        explicit_rates, _used = _adjust_sample_rates_full(
            classes, rate=rate, intensity=intensity, min_budget=None
        )
        implicit_rate = rate  # doesn't really matter since everything is explicit
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
        explicit_rates, _used = _adjust_sample_rates_full(
            classes, explicit_rate, intensity=intensity, min_budget=None
        )
    elif total_explicit < explicit_budget:
        # we would not be able to spend all explicit budget we can only
        # send a maximum of total_explicit so set the explicit rate to 1 for
        # all explicit classes and reevaluate the available budget for the implicit classes
        explicit_rates = [
            DSElement(id=element.id, count=element.count, new_sample_rate=1.0)
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

        explicit_rates, used = _adjust_sample_rates_full(
            classes=classes,
            rate=explicit_rate,
            intensity=intensity,
            min_budget=minimum_explicit_budget,
        )
        # recalculate implicit_budget based on used
        implicit_budget = total_budget - used
        implicit_rate = implicit_budget / total_implicit
    return explicit_rates, implicit_rate


def adjust_sample_rates_full(
    classes: Sequence[DSElement], rate: float, intensity: float, min_budget: Optional[float] = None
) -> Tuple[List[DSElement], float]:
    sorted_elements = sorted(classes, key=lambda x: (x.count, x.id), reverse=True)
    return _adjust_sample_rates_full(sorted_elements, rate, intensity, min_budget)


def _adjust_sample_rates_full(
    classes: List[DSElement], rate: float, intensity: float, min_budget: Optional[float] = None
) -> Tuple[List[DSElement], float]:
    """
    Tries to calculate rates that brings all counts close to the ideal count

    The intensity controls how close, 0 intensity leaves the items unchanged, 1 brings the items to the
    ideal count ( or rate=1.0 if ideal count is too high).

    :param items: The items to be balanced
    :param rate: The overall rate necessary
    :param intensity: How close to the ideal should we go from our current position (0=do not change, 1 go to ideal)
    :param min_budget: Ensure that we use at least min_budget (in order to keep the overall rate)

    :return: A mapping with the frequency for all items + the amount of items used ( it should allways be at least
    minimum_consumption if passed)
    """

    total = sum_counts(classes)
    num_classes = len(classes)

    if min_budget is None:
        # use exactly what we need (default handling when we resize everything)
        min_budget = total * rate

    assert total >= min_budget
    ideal = total * rate / num_classes

    used_budget: float = 0.0

    ret_val = []
    while classes:
        element = classes.pop()
        count = element.count
        if ideal * num_classes < min_budget:
            # if we keep to our ideal we will not be able to use the minimum budget (readjust our target)
            ideal = min_budget / num_classes
        # see what's the difference from our ideal
        sampled = count * rate
        delta = ideal - sampled
        correction = delta * intensity
        desired_count = sampled + correction

        if desired_count > count:
            # we need more than we have, the best we can do is give all, i.e. rate = 1.0
            new_sample_rate = 1.0
            used = count
        else:
            # we can spend what we want
            new_sample_rate = desired_count / count
            used = desired_count
        ret_val.append(DSElement(id=element.id, count=count, new_sample_rate=new_sample_rate))
        min_budget -= used
        used_budget += used
        num_classes -= 1

    return ret_val, used_budget


def sum_counts(transactions: List[DSElement]) -> float:
    ret_val = 0.0
    for elm in transactions:
        ret_val += elm.count
    return ret_val
