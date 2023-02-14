import statistics
from dataclasses import dataclass
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
    fidelity_rate: float = 0.4  # TODO: discuss this constant

    def adjust_sample_rates(self) -> List[Project]:
        if len(self.projects) < 2:
            return self.projects

        # Step 1: sort projects by count per root project
        sorted_projects = list(sorted(self.projects, key=lambda x: (x.count_per_root, -x.id)))

        # Step 2: find average project
        average = statistics.mean([p.count_per_root for p in sorted_projects])

        # Step 3:
        num_projects = len(sorted_projects)
        half = num_projects // 2
        odd_one = num_projects % 2
        left_split = sorted_projects[:half]
        # ignore middle element, since we don't have capacity to balance it
        right_split = reversed(sorted_projects[half + odd_one : num_projects])

        new_left = []
        new_right = []
        coefficient = 1.0
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
            mid_element = sorted_projects[half] if odd_one else []
            mid_element.new_count_per_root = mid_element.count_per_root
            return [*new_right, mid_element, *reversed(new_left)]
