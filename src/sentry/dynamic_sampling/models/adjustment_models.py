import statistics
from dataclasses import dataclass
from operator import attrgetter
from typing import List


@dataclass
class Project:
    id: int
    count_per_root: int
    blended_sample_rate: float
    new_count_per_root: int = 0
    new_sample_rate: float = 0.0


@dataclass
class AdjustedModel:
    projects: List[Project]
    fidelity_rate: float

    @property
    def adjust_sample_rates(self):
        if len(self.projects) < 2:
            return self.projects

        # Step 1: sort projects by count per root project
        sorted_projects = list(sorted(self.projects, key=attrgetter("count_per_root")))

        # Step 2: find avg
        average = statistics.mean([p.count_per_root for p in sorted_projects])

        # Step 3:
        # IF len % 2 == 0
        left_split = sorted_projects[: len(sorted_projects) // 2]
        right_split = reversed(sorted_projects[len(sorted_projects) // 2 :])

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

        return [new_left, new_right]
