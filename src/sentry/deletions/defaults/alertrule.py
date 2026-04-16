from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRule
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector


class AlertRuleDetectorDeletionTask(ModelDeletionTask[AlertRuleDetector]):
    manager_name = "objects_for_deletion"


class AlertRuleDeletionTask(ModelDeletionTask[AlertRule]):
    # The default manager for alert rules excludes snapshots
    # which we want to include when deleting an organization.
    manager_name = "objects_with_snapshots"

    def get_child_relations(self, instance: AlertRule) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRuleTrigger
        from sentry.incidents.models.incident import Incident
        from sentry.workflow_engine.models import AlertRuleWorkflow

        return [
            ModelRelation(AlertRuleTrigger, {"alert_rule_id": instance.id}),
            ModelRelation(Incident, {"alert_rule_id": instance.id}),
            ModelRelation(
                AlertRuleDetector,
                {"alert_rule_id": instance.id},
                task=AlertRuleDetectorDeletionTask,
            ),
            ModelRelation(AlertRuleWorkflow, {"alert_rule_id": instance.id}),
        ]
