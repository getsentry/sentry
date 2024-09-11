from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a condition that must be met for a workflow to execute.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("name", "organization_id")

    # TODO - map this to snuba Condition
    condition = models.CharField(max_length=200)

    # This should only store primitives; it may be boolean, string, number, etc.
    condition_result = models.JSONField()

    threshold = models.FloatField()
    type = models.CharField(max_length=200)
