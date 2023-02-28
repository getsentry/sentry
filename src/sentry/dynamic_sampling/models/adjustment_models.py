import statistics
from dataclasses import dataclass
from typing import List


@dataclass
class DSProject:
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

    projects: List[DSProject]
    # Right now we are not using this constant
    fidelity_rate: float = 0.4  # TODO: discuss this constant

    def adjust_sample_rates(self) -> List[DSProject]:
        if len(self.projects) < 2:
            # When we have one project we just remind sample rates
            if len(self.projects) == 1:
                self.projects[0].new_sample_rate = self.projects[0].blended_sample_rate
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

            # Max possible counter if sample rate would be 1.0
            max_possible_count = left.count_per_root / left.blended_sample_rate
            diff = coefficient * min(
                (average - left.count_per_root),
                (max_possible_count - left.count_per_root),
            )
            left.new_count_per_root = left.count_per_root + diff
            left.new_sample_rate = left.blended_sample_rate * (
                left.new_count_per_root / left.count_per_root
            )
            right.new_count_per_root = right.count_per_root - diff
            right.new_sample_rate = right.blended_sample_rate * (
                right.new_count_per_root / right.count_per_root
            )
            new_left.append(left)
            new_right.append(right)
            # This opinionated `coefficient` reduces adjustment on every step
            coefficient = diff / left.new_count_per_root

        if len(sorted_projects) % 2 == 0:
            return [*new_right, *reversed(new_left)]
        else:
            if odd_one:
                mid_elements = [sorted_projects[half]]
                mid_elements[0].new_count_per_root = mid_elements[0].count_per_root
            else:
                mid_elements = []
            return [*new_right, *mid_elements, *reversed(new_left)]
