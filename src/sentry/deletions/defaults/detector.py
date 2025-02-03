from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.snuba.models import QuerySubscription, SnubaQuery
        from sentry.workflow_engine.models import DataConditionGroup, DataSource

        # XXX: this assumes a data source is connected to a single detector. it's not possible in the UI
        # to do anything else today, but if this changes we'll need to add custom conditional deletion logic

        model_relations: list[BaseRelation] = [ModelRelation(DataSource, {"detector": instance.id})]

        if instance.workflow_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id})
            )

        data_source = DataSource.objects.filter(detector=instance.id).first()

        if data_source:
            model_relations.append(ModelRelation(QuerySubscription, {"id": data_source.query_id}))
            subscription = QuerySubscription.objects.filter(id=data_source.query_id).first()

            if subscription:
                model_relations.append(
                    ModelRelation(SnubaQuery, {"id": subscription.snuba_query.id})
                )

        return model_relations
