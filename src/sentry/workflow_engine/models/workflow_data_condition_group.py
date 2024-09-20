from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class WorkflowDataConditionGroup(DefaultFieldsModel):
    """
    A lookup table for the conditions associated with a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization

    condition_group = FlexibleForeignKey("workflow_engine.DataConditionGroup", unique=True)
    workflow = FlexibleForeignKey("workflow_engine.Workflow")
