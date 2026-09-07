from dataclasses import dataclass
from enum import Enum

from django.db import models
from django.utils.translation import gettext_lazy as _


class DynamicSamplingMode(models.TextChoices):
    """Defines the scope where target sample rates are configured in an
    organization."""

    ORGANIZATION = "organization", _("Organization")
    PROJECT = "project", _("Project")


class SamplingMeasure(Enum):
    """The type of data being measured for dynamic sampling rebalancing.

    - SPANS: Span-based counting using SpanMRI WITHOUT is_segment filter.
             Used for AM3/project mode where we count all spans.
    - SEGMENTS: Span-based counting using SpanMRI WITH is_segment=true filter.
                Default measure, counting only root spans (segments).
    """

    SPANS = "spans"
    SEGMENTS = "segments"


@dataclass(frozen=True)
class OrganizationDataVolume:
    """
    The number of segments an organization received in a time window, and how many of them
    were stored. ``indexed`` is None when the source of the volume does not know it.
    """

    org_id: int
    total: int
    indexed: int | None

    def is_valid_for_recalibration(self) -> bool:
        return self.total > 0 and self.indexed is not None and self.indexed > 0

    @property
    def effective_sample_rate(self) -> float | None:
        if self.indexed is None or self.total <= 0:
            return None
        return self.indexed / self.total
