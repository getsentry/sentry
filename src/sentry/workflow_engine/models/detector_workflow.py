from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


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
