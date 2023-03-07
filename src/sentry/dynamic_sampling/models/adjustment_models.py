from dataclasses import dataclass
from typing import List

from sentry.dynamic_sampling.models.utils import DSElement, adjust_sample_rates


@dataclass
class AdjustedModel:
    """
    Model which can adjust sample rate per project inside ORG based on this new counter metric from Relay.
    """

    projects: List[DSElement]

    def adjust_sample_rates(self) -> List[DSElement]:
        if len(self.projects) < 2:
            # When we have one project we just remind sample rates
            if len(self.projects) == 1:
                self.projects[0].new_sample_rate = self.projects[0].sample_rate
                self.projects[0].new_count = self.projects[0].count
            return self.projects

        # Step 1: sort projects by count per root project
        sorted_projects = list(sorted(self.projects, key=lambda x: (x.count, -x.id)))

        # For now, we have only blended sample rate per org, but we fetch per project
        blended_sample_rate = sorted_projects[0].sample_rate

        # Step 2:
        return adjust_sample_rates(sorted_projects, blended_sample_rate)
