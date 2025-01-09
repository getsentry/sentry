from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRule


class AlertRuleDeletionTask(ModelDeletionTask[AlertRule]):
    # The default manager for alert rules excludes snapshots
    # which we want to include when deleting an organization.
    manager_name = "objects_with_snapshots"

    def get_child_relations(self, instance: AlertRule) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRuleTrigger
        from sentry.incidents.models.incident import Incident

        model_list = (AlertRuleTrigger, Incident)
        return [ModelRelation(m, {"alert_rule_id": instance.id}) for m in model_list]
