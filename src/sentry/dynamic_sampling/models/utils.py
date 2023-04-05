from copy import copy
from dataclasses import dataclass
from typing import List, Union

from sentry.dynamic_sampling.rules.utils import ProjectId, TransactionName


@dataclass
class DSElement:
    id: Union[ProjectId, TransactionName]
    count: float
    new_sample_rate: float = 0.0


def total_elements(ds_elements: List[DSElement]) -> float:
    ret_val = 0.0
    for element in ds_elements:
        ret_val += element.count
    return ret_val


def adjust_sample_rates(elements: List[DSElement], rate: float) -> List[DSElement]:

    elements = copy(elements)
    ret_val: List[DSElement] = []
    total = total_elements(elements)

    # calculate how many elements we are allowed to keep overall
    # this will allow us to pass elements between different element types
    total_budget = total * rate

    while elements:
        num_types = len(elements)
        # We recalculate the budget per type every iteration to
        # account for the cases where, in the previous step we couldn't
        # spend all the allocated budget for that type.
        budget_per_element_type = total_budget / num_types
        element = elements.pop(0)
        count, name = element.count, element.id
        if count < budget_per_element_type:
            # we have fewer elements in this type than the
            # budget, all we can do is to keep everything
            # not enough samples, use all
            new_sample_rate = 1.0
            total_budget -= count
        else:
            # we have enough elements in the current class
            # we want to only keep budget_per_elements
            new_sample_rate = budget_per_element_type / count
            total_budget -= budget_per_element_type
        ret_val.append(
            DSElement(
                id=name,
                new_sample_rate=new_sample_rate,
                count=count,
            )
        )
    return ret_val
