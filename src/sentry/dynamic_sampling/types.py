from enum import Enum

from django.db import models
from django.utils.translation import gettext_lazy as _


class DynamicSamplingMode(models.TextChoices):
    """Defines the scope where target sample rates are configured in an
    organization."""

    ORGANIZATION = "organization", _("Organization")
    PROJECT = "project", _("Project")


class SamplingMeasure(Enum):
    """The type of data being measured for dynamic sampling rebalancing."""

    SPANS = "spans"
    TRANSACTIONS = "transactions"
