from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr

from .detector import Detector
from .workflow_action import WorkflowAction


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

    detector = models.ForeignKey(Detector, on_delete=models.CASCADE, blank=True, null=True)
    workflow_action = models.ForeignKey(
        WorkflowAction, on_delete=models.CASCADE, blank=True, null=True
    )
