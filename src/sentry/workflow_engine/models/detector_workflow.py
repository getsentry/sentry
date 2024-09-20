from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class DetectorWorkflow(DefaultFieldsModel):
    """
    A model to represent the relationship between a detector and a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization

    detector = FlexibleForeignKey("workflow_engine.Detector")
    workflow = FlexibleForeignKey("workflow_engine.Workflow")
