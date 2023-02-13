import statistics
from dataclasses import dataclass
from operator import attrgetter
from typing import List


@dataclass
class Project:
    id: int
    count_per_root: float
    blended_sample_rate: float
    new_count_per_root: float = 0.0
    new_sample_rate: float = 0.0


@dataclass
class AdjustedModel:
    """
    Model which can adjust sample rate per project inside ORG based on this new counter metric from Relay.
    """

    projects: List[Project]
    fidelity_rate: float

    @property
    def adjust_sample_rates(self):
        if len(self.projects) < 2:
            return self.projects

        # Step 1: sort projects by count per root project
        sorted_projects = list(sorted(self.projects, key=attrgetter("count_per_root")))

        # Step 2: find average project
        average = statistics.mean([p.count_per_root for p in sorted_projects])

        # Step 3:
        if len(sorted_projects) % 2 == 0:
            left_split = sorted_projects[: len(sorted_projects) // 2]
            right_split = reversed(
                sorted_projects[len(sorted_projects) // 2 : len(sorted_projects)]
            )
        else:
            left_split = sorted_projects[: len(sorted_projects) // 2]
            # ignore middle element, since we don't have capacity to balance it
            right_split = reversed(
                sorted_projects[(len(sorted_projects) // 2) + 1 : len(sorted_projects)]
            )

        new_left = []
        new_right = []
        coefficient = 1
        for left, right in zip(left_split, right_split):
            # We can't increase sample rate more than 1.0, so we calculate upper bound count
            # based on project fidelity_rate
            # Find an absolute difference
            diff = coefficient * min(
                (average - left.count_per_root),
                ((left.count_per_root / self.fidelity_rate) - left.count_per_root),
            )
            left.new_count_per_root = left.count_per_root + diff
            right.new_count_per_root = right.count_per_root - diff
            new_left.append(left)
            new_right.append(right)
            # This opinionated `coefficient` reduces adjustment on every step
            coefficient = diff / left.new_count_per_root

        if len(sorted_projects) % 2 == 0:
            return [*new_right, *reversed(new_left)]
        else:
            mid_element = sorted_projects[len(sorted_projects) // 2]
            mid_element.new_count_per_root = mid_element.count_per_root
            return [*new_right, mid_element, *reversed(new_left)]
