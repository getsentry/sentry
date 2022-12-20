import statistics
from dataclasses import dataclass, field
from operator import itemgetter
from typing import List


@dataclass
class Project:
    id: int
    total: int
    # sample_rate: float


@dataclass
class AdjustedModel:
    projects: List[Project]
    fidelity_rate: float

    def adjust_sample_rates(self):
        # Step 1: sort
        sorted_ = sorted(self.projects, reverse=True, key=itemgetter("total"))

        # Step 2: find avg
        avg = statistics.mean(sorted_)

        # Step 3:
        # Find upper bound

        # One maximum adjustment 1 up to 4
        min_element = sorted_[0]

        max_ = min_element / self.fidelity_rate
        adjustments_ceiling_p4 = min((avg - min_element), min_element / self.fidelity_rate)

        d2 = adjustments_ceiling_p4 - sorted_[1]
        total_adjusment = d2
        d1 = abs(avg - sorted_[1])
        d11 = d1 / d1 * total_adjusment

        return [d11, d2]
