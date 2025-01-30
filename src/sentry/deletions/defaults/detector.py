from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRule
from sentry.workflow_engine.models import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: AlertRule) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataSourceDetector

        return [ModelRelation(DataSourceDetector, {"detector_id": instance.id})]
