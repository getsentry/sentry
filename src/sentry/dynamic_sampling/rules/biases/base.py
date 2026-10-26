from abc import ABC, abstractmethod

from sentry.dynamic_sampling.rules.utils import PolymorphicRule
from sentry.models.project import Project


class Bias(ABC):
    """
    Base class representing the generator of rules connected to a bias.
    """

    @abstractmethod
    def generate_rules(self, project: Project, base_sample_rate: float) -> list[PolymorphicRule]:
        raise NotImplementedError
