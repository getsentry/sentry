from dataclasses import dataclass
from typing import List

from sentry.dynamic_sampling.models.utils import DSElement, adjust_sample_rates_full


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

        ret_val, _used_budget = adjust_sample_rates_full(
            self.projects, sample_rate, intensity=1, min_budget=None
        )
        return ret_val
