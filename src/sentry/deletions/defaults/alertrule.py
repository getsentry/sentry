from ..base import ModelDeletionTask, ModelRelation


class AlertRuleDeletionTask(ModelDeletionTask):
    # The default manager for alert rules excludes snapshots
    # which we want to include when deleting an organization.
    manager_name = "objects_with_snapshots"

    def get_child_relations(self, instance):
        from sentry.incidents.models.alert_rule import AlertRuleTrigger

        return [
            ModelRelation(AlertRuleTrigger, {"alert_rule_id": instance.id}),
        ]
