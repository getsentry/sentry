from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models import Action, DataConditionGroup, Workflow


class WorkflowDeletionTask(ModelDeletionTask[Workflow]):
    def get_child_relations(self, instance: Workflow) -> list[BaseRelation]:
        model_relations: list[BaseRelation] = []

        action_filter_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow_id=instance.id
        ).values_list("id", flat=True)

        action_ids = Action.objects.filter(
            dataconditiongroupaction__condition_group_id__in=action_filter_ids
        ).values_list("id", flat=True)

        if action_ids:
            model_relations.append(ModelRelation(Action, {"id__in": action_ids}))

        if action_filter_ids:
            model_relations.append(ModelRelation(DataConditionGroup, {"id__in": action_filter_ids}))

        if instance.when_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.when_condition_group.id})
            )

        return model_relations
