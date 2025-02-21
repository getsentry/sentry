from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models import Action, DataConditionGroup, Workflow


class WorkflowDeletionTask(ModelDeletionTask[Workflow]):
    def get_child_relations(self, instance: Workflow) -> list[BaseRelation]:
        model_relations: list[BaseRelation] = []

        action_filter_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow_id=instance.id
        ).values_list("id", flat=True)

        if action_filter_ids:
            # Action Filters
            model_relations.append(ModelRelation(DataConditionGroup, {"id__in": action_filter_ids}))

            # Actions - This is required until the notification center maintains these actions
            model_relations.append(
                ModelRelation(
                    Action, {"dataconditiongroupaction__condition_group__in": action_filter_ids}
                )
            )

        if instance.when_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.when_condition_group.id})
            )

        return model_relations
