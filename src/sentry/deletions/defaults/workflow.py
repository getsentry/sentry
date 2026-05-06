from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.rule import Rule
from sentry.workflow_engine.models import Action, AlertRuleWorkflow, DataConditionGroup, Workflow


class WorkflowDeletionTask(ModelDeletionTask[Workflow]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: Workflow) -> list[BaseRelation]:
        model_relations: list[BaseRelation] = []

        # If this workflow was dual-written from an issue alert Rule, cascade
        # deletion to the Rule. AlertRuleWorkflow must be listed before Rule
        # so the link row is gone by the time RuleDeletionTask runs — otherwise
        # RuleDeletionTask would cascade back to Workflow and infinitely recurse.
        rule_ids = list(
            AlertRuleWorkflow.objects.filter(
                workflow_id=instance.id, rule_id__isnull=False
            ).values_list("rule_id", flat=True)
        )
        if rule_ids:
            model_relations.append(
                ModelRelation(
                    AlertRuleWorkflow, {"workflow_id": instance.id, "rule_id__isnull": False}
                )
            )
            model_relations.append(ModelRelation(Rule, {"id__in": rule_ids}))

        action_filter_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow_id=instance.id
        ).values_list("id", flat=True)

        if action_filter_ids:
            model_relations.append(
                ModelRelation(
                    Action, {"dataconditiongroupaction__condition_group_id__in": action_filter_ids}
                )
            )

            model_relations.append(ModelRelation(DataConditionGroup, {"id__in": action_filter_ids}))

        if instance.when_condition_group_id:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.when_condition_group_id})
            )

        return model_relations
