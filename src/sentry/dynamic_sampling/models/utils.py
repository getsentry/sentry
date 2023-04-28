from copy import copy
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
) -> Tuple[List[DSElement], float]:
    """
    Adjusts sampling rates to bring the number of samples kept in each class as close to
    the same value as possible while maintaining the overall sampling rate.

    The algorithm adjusts the explicitly given classes individually to bring them to
    the ideal sample rate and then adjusts the global sample rate for all the remaining classes.

    :param classes: a list of class id, num_samples in class
    :param rate: global rate of sampling desired
    :param total_num_classes: total number of classes (including the explicitly specified in classes)
    :param total: total number of samples in all classes (including the explicitly specified classes)

    :return: a dictionary with explicit rates for individual classes class_name->rate and
    a rate for all other (unspecified) classes.
    """

    classes = list(sorted(classes, key=lambda x: (x.count, x.id)))

    if total_num_classes is None or total is None:
        # we don't have totals information, the best we can do is do a full_adjustment on
        # the explicit classes and keep the original rate for the rest
        return adjust_sample_rates_full(classes, rate), rate

    # total count for the explicitly specified classes
    total_explicit = get_total(classes)
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
        explicit_rates = adjust_sample_rates_full(classes, rate)
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
        explicit_rates = adjust_sample_rates_full(classes, explicit_rate)
    elif total_explicit < explicit_budget:
        # we would not be able to spend all explicit budget we can only
        # send a maximum of total_explicit so set the explicit rate to 1 for
        # all explicit classes and reevaluate the available budget for the implicit classes
        explicit_rates = [
            DSElement(id=elm.id, count=elm.count, new_sample_rate=1.0) for elm in classes
        ]

        # calculate the new global rate for the implicit transactions
        implicit_budget = total_budget - total_explicit
        implicit_rate = implicit_budget / total_implicit
    else:
        # we can spend all the implicit budget on the implicit classes
        # and all the explicit budget on the explicit classes
        # the calculation of rates can be done independently for explicit and
        # implicit classes
        implicit_rate = implicit_budget / total_implicit
        explicit_rate = explicit_budget / total_explicit
        explicit_rates = adjust_sample_rates_full(classes, explicit_rate)
    return explicit_rates, implicit_rate


def adjust_sample_rates_full(classes: Sequence[DSElement], rate: float) -> List[DSElement]:
    """
    Resample all classes to their ideal size.

    Ideal size is defined as the minimum of:
    - num_samples_in_class ( i.e. no sampling, rate 1.0)
    - total_num_samples * rate / num_classes

    """
    sorted_elements = list(sorted(classes, key=lambda x: (x.count, x.id)))
    return _adjust_sample_rates_full(sorted_elements, rate)


def _adjust_sample_rates_full(classes: List[DSElement], rate: float) -> List[DSElement]:
    classes = copy(classes)
    ret_val = []
    num_transactions = get_total(classes)
    # calculate how many transactions we are allowed to keep overall
    # this will allow us to pass transactions between different transaction types
    total_budget = num_transactions * rate
    while classes:
        num_types = len(classes)
        # We recalculate the budget per type every iteration to
        # account for the cases where, in the previous step we couldn't
        # spend all the allocated budget for that type.
        budget_per_transaction_type = total_budget / num_types
        element = classes.pop(0)
        if element.count < budget_per_transaction_type:
            # we have fewer transactions in this type than the
            # budget, all we can do is to keep everything
            new_sample_rate = 1.0  # not enough samples, use all
            total_budget -= element.count
        else:
            # we have enough transactions in current the class
            # we want to only keep budget_per_transactions
            transaction_rate = budget_per_transaction_type / element.count
            new_sample_rate = transaction_rate
            total_budget -= budget_per_transaction_type
        ret_val.append(
            DSElement(
                id=element.id,
                new_sample_rate=new_sample_rate,
                count=element.count,
            )
        )
    return ret_val


def get_total(transactions: List[DSElement]) -> float:
    ret_val = 0.0
    for elm in transactions:
        ret_val += elm.count
    return ret_val
