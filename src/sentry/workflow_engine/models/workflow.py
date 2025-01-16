from typing import Any

from django.conf import settings
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.owner_base import OwnerModel
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import WorkflowJob

from .json_config import JSONConfigBase


@region_silo_model
class Workflow(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    """
    A workflow is a way to execute actions in a specified order.
    Workflows are initiated after detectors have been processed, driven by changes to their state.
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey("sentry.Organization")

    # If the workflow is not enabled, it will not be evaluated / invoke actions. This is how we "snooze" a workflow
    enabled = models.BooleanField(db_default=True)

    # Required as the 'when' condition for the workflow, this evalutes states emitted from the detectors
    when_condition_group = FlexibleForeignKey("workflow_engine.DataConditionGroup", null=True)

    environment = FlexibleForeignKey("sentry.Environment", null=True)

    created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    DEFAULT_FREQUENCY = 30

    @property
    def config_schema(self) -> dict[str, Any]:
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Workflow Schema",
            "type": "object",
            "properties": {
                "frequency": {
                    "description": "How often the workflow should fire for a Group (minutes)",
                    "type": "integer",
                    "minimum": 0,
                },
            },
            "additionalProperties": False,
        }

    __repr__ = sane_repr("name", "organization_id")

    class Meta:
        app_label = "workflow_engine"
        db_table = "workflow_engine_workflow"

        constraints = [
            models.UniqueConstraint(
                fields=["name", "organization"], name="unique_workflow_name_per_org"
            )
        ]

    def evaluate_trigger_conditions(self, job: WorkflowJob) -> bool:
        """
        Evaluate the conditions for the workflow trigger and return if the evaluation was successful.
        If there aren't any workflow trigger conditions, the workflow is considered triggered.
        """
        if self.when_condition_group is None:
            return True

        job["workflow"] = self
        evaluation, _ = evaluate_condition_group(self.when_condition_group, job)
        return evaluation


@receiver(pre_save, sender=Workflow)
def enforce_config_schema(sender, instance: Workflow, **kwargs):
    instance.validate_config(instance.config_schema)
