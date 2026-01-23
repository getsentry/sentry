from typing import Any

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Workflow


@region_silo_model
class DetectorWorkflow(DefaultFieldsModel):
    """
    A model to represent the relationship between a detector and a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization

    detector = FlexibleForeignKey("workflow_engine.Detector", on_delete=models.CASCADE)
    workflow = FlexibleForeignKey("workflow_engine.Workflow", on_delete=models.CASCADE)

    class Meta:
        unique_together = (("detector", "workflow"),)

    def get_audit_log_data(self) -> dict[str, Any]:
        return {"detector_name": self.detector.name, "workflow_name": self.workflow.name}


@receiver(post_save, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache(sender, instance: DetectorWorkflow) -> None:
    workflow = Workflow.objects.get(id=instance.workflow_id)
    invalidate_processing_workflows(instance.detector_id, workflow.environment_id)
