from sentry.deletions.base import BaseRelation, ModelDeletionTask
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    # # The default manager for alert rules excludes snapshots
    # # which we want to include when deleting an organization.
    # manager_name = "objects_with_snapshots"

    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        # from sentry.workflow_engine.models.detector import Detector

        # print("hello")

        return []

        # model_list = (AlertRuleTrigger, Incident)
        # return [ModelRelation(m, {"alert_rule_id": instance.id}) for m in model_list]
