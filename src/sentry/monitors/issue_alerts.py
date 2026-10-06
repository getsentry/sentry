from collections.abc import Sequence
from typing import Any

from django.db import router, transaction

from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType, RuleSource
from sentry.monitors.models import Monitor
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.typings.notification_action import ActionTarget, ActionTargetType

TARGET_TYPE_MAPPING = {
    ActionTargetType.MEMBER.value: ActionTarget.USER.value,
    ActionTargetType.TEAM.value: ActionTarget.TEAM.value,
}


def _create_email_actions(
    action_condition_group: DataConditionGroup,
    actions: Sequence[dict[str, Any]],
) -> None:
    for action_data in actions:
        action = Action.objects.create(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": str(action_data["targetIdentifier"]),
                "target_display": None,
                "target_type": TARGET_TYPE_MAPPING[action_data["targetType"]],
            },
        )
        DataConditionGroupAction.objects.create(
            condition_group=action_condition_group,
            action=action,
        )


def create_cron_monitor_issue_alert(
    *,
    project: Project,
    monitor: Monitor,
    actions: Sequence[dict[str, Any]],
    environment_id: int | None,
    user_id: int,
) -> Rule:
    rule_data = {
        "filter_match": "all",
        "action_match": "any",
        "actions": list(actions),
        "conditions": [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": monitor.slug,
            },
        ],
        "frequency": 5,
    }

    with transaction.atomic(router.db_for_write(Rule)):
        rule = Rule.objects.create(
            label=f"Monitor Alert: {monitor.name}"[:64],
            environment_id=environment_id,
            project=project,
            data=rule_data,
            source=RuleSource.CRON_MONITOR,
        )

        when_condition_group = DataConditionGroup.objects.create(
            organization_id=monitor.organization_id,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        DataCondition.objects.create(
            condition_group=when_condition_group,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        DataCondition.objects.create(
            condition_group=when_condition_group,
            type=Condition.REGRESSION_EVENT,
            comparison=True,
            condition_result=True,
        )

        workflow = Workflow.objects.create(
            organization_id=monitor.organization_id,
            name=rule.label,
            environment_id=environment_id,
            when_condition_group=when_condition_group,
            created_by_id=user_id,
            config={"frequency": 5},
        )
        workflow.update(date_added=rule.date_added)
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)

        try:
            detector = Detector.objects.get(
                datasource__type=DATA_SOURCE_CRON_MONITOR,
                datasource__source_id=str(monitor.id),
                datasource__organization_id=monitor.organization_id,
            )
        except Detector.DoesNotExist:
            pass
        else:
            DetectorWorkflow.objects.create(detector=detector, workflow=workflow)

        action_condition_group = DataConditionGroup.objects.create(
            organization_id=monitor.organization_id,
            logic_type=DataConditionGroup.Type.ALL,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=workflow,
            condition_group=action_condition_group,
        )
        DataCondition.objects.create(
            condition_group=action_condition_group,
            type=Condition.TAGGED_EVENT,
            comparison={"key": "monitor.slug", "match": "eq", "value": monitor.slug},
            condition_result=True,
        )

        _create_email_actions(action_condition_group, actions)

        RuleActivity.objects.create(
            rule=rule,
            user_id=user_id,
            type=RuleActivityType.CREATED.value,
        )

    return rule


def update_cron_monitor_issue_alert(
    *,
    rule: Rule,
    monitor: Monitor,
    actions: Sequence[dict[str, Any]],
    conditions: Sequence[dict[str, Any]],
    environment_id: int | None,
    user_id: int | None,
) -> Rule:
    with transaction.atomic(router.db_for_write(Rule)):
        rule.label = f"Monitor Alert: {monitor.name}"[:64]
        rule.environment_id = environment_id
        rule.owner = None
        rule.data["conditions"] = list(conditions)
        if actions:
            # Preserve the legacy behavior where an empty target list does not clear actions.
            rule.data["actions"] = list(actions)
        rule.save()

        try:
            workflow = (
                AlertRuleWorkflow.objects.select_related("workflow")
                .get(
                    rule_id=rule.id,
                    workflow__organization_id=monitor.organization_id,
                )
                .workflow
            )
        except AlertRuleWorkflow.DoesNotExist:
            RuleActivity.objects.create(
                rule=rule,
                user_id=user_id,
                type=RuleActivityType.UPDATED.value,
            )
            return rule

        if workflow.when_condition_group is None:
            raise ValueError("Cron Monitor workflow does not have a trigger condition group")
        workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT)

        try:
            action_condition_group = WorkflowDataConditionGroup.objects.get(
                workflow=workflow
            ).condition_group
        except WorkflowDataConditionGroup.DoesNotExist:
            action_condition_group = DataConditionGroup.objects.create(
                organization_id=monitor.organization_id,
                logic_type=DataConditionGroup.Type.ALL,
            )
            WorkflowDataConditionGroup.objects.create(
                workflow=workflow,
                condition_group=action_condition_group,
            )
        action_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        slug_conditions = []
        for condition in DataCondition.objects.filter(
            condition_group=action_condition_group,
            type=Condition.TAGGED_EVENT,
        ):
            if condition.comparison.get("key") == "monitor.slug":
                slug_conditions.append(condition)

        slug_comparison = {"key": "monitor.slug", "match": "eq", "value": monitor.slug}
        if not slug_conditions:
            DataCondition.objects.create(
                condition_group=action_condition_group,
                type=Condition.TAGGED_EVENT,
                comparison=slug_comparison,
                condition_result=True,
            )
        else:
            for slug_condition in slug_conditions:
                slug_condition.update(comparison=slug_comparison)

        condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group=action_condition_group
        )
        Action.objects.filter(
            id__in=condition_group_actions.values_list("action_id", flat=True)
        ).delete()
        condition_group_actions.delete()
        _create_email_actions(action_condition_group, rule.data["actions"])

        workflow.name = rule.label
        workflow.environment_id = environment_id
        workflow.owner_user_id = rule.owner_user_id
        workflow.owner_team_id = rule.owner_team_id
        workflow.save()

        RuleActivity.objects.create(
            rule=rule,
            user_id=user_id,
            type=RuleActivityType.UPDATED.value,
        )

    return rule
