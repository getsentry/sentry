from django.db.models import Index

from sentry.backup.scopes import RelocationScope
from sentry.db.models import CharField, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@region_silo_model
class WorkflowFireHistory(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    workflow = FlexibleForeignKey("workflow_engine.Workflow", db_constraint=False)
    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    event_id = CharField("event_id", max_length=32, null=True)

    class Meta:
        db_table = "workflow_engine_workflowfirehistory"
        app_label = "workflow_engine"
        indexes = [Index(fields=["workflow", "date_added"])]

    __repr__ = sane_repr("workflow_id", "group_id", "event_id", "date_added")
