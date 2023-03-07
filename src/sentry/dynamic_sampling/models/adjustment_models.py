from dataclasses import dataclass
from typing import List

from sentry.dynamic_sampling.models.utils import DSElement, adjust_sample_rates


@dataclass
class AdjustedModel:
    """
    Model which can adjust sample rate per project inside ORG based on this new counter metric from Relay.
    """

    projects: List[DSElement]

    def adjust_sample_rates(self, sample_rate: float) -> List[DSElement]:
        if len(self.projects) < 2:
            # When we have one project we just remind sample rates
            if len(self.projects) == 1:
                self.projects[0].new_sample_rate = sample_rate
            return self.projects

        # Step 1: sort projects by count per root project
        sorted_projects = list(sorted(self.projects, key=lambda x: (x.count, x.id)))

        # Step 2:
        return adjust_sample_rates(sorted_projects, sample_rate)
