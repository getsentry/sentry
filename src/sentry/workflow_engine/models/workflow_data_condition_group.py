from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class WorkflowDataConditionGroup(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    workflow = FlexibleForeignKey("workflow_engine.Workflow")
    condition_group = FlexibleForeignKey("workflow_engine.WorkflowDataCondition", unique=True)
