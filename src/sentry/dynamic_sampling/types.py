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

    - TRANSACTIONS: Legacy transaction-based counting using TransactionMRI.
    - SPANS: Span-based counting using SpanMRI WITHOUT is_segment filter.
             Used for AM3/project mode where we count all spans.
    - SEGMENTS: Span-based counting using SpanMRI WITH is_segment=true filter.
                Used as a replacement for TRANSACTIONS, counting only root spans.
    """

    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SEGMENTS = "segments"
