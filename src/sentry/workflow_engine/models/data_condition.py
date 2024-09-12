from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a condition that must be met for a workflow to execute.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "condition")

    condition = models.CharField(max_length=200)
    threshold = models.FloatField()
    condition_result = models.JSONField()
    type = models.CharField(max_length=200)
