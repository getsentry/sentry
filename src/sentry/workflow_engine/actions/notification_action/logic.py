import uuid
from typing import Any

from sentry.constants import ObjectStatus
from sentry.models.group import GroupEvent
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.actions.base import instantiate_action
from sentry.types.rules import RuleFuture
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.actions.notification_action.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_RULE_REGISTRY_ID,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
)
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.detector import Detector


def build_rule_data_blob(action: Action) -> list[dict[str, Any]]:
    """
    Builds the Rule.data.actions json blob from the Action model.

    :param action: Action model instance
    :return: list of dicts with the rule data with length 1
    """

    # Copy the action data to the rule data
    rule_data = dict(action.data)

    # Add the rule registry id to the rule data
    rule_data["id"] = ACTION_TYPE_2_RULE_REGISTRY_ID[action.type]

    # Add the action uuid to the rule data
    rule_data["uuid"] = action.id

    # Add the integration id to the rule data
    integration_id_key = ACTION_TYPE_2_INTEGRATION_ID_KEY[action.type]
    rule_data[integration_id_key] = action.integration_id

    # Add the target identifier to the rule data if it exists
    target_identifier_key = ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type)
    if target_identifier_key:
        rule_data[target_identifier_key] = action.target_identifier

    # Add the target display to the rule data if it exists
    target_display_key = ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type)
    if target_display_key:
        rule_data[target_display_key] = action.target_display

    # Because the rule expects "actions" to be a list, we need to return a list with a single dict
    return [rule_data]


def form_issue_alert_models(
    action: Action, detector: Detector, group_event: GroupEvent
) -> tuple[Rule, RuleFireHistory, str]:
    """
    Builds the Rule and RuleFireHistory models from the Action model.
    These models are used to trigger an issue alert notification.

    :param action: Action model instance
    :param detector: Detector model instance
    :param group_event: GroupEvent model instance
    :return: tuple of Rule, RuleFireHistory, and notification_uuid
    """

    # Create a notification uuid
    notification_uuid = str(uuid.uuid4())

    assert detector.project == group_event.project
    # TODO(iamrajjoshi): Change the above assert to a check

    # Build the Rule.data.actions json blob
    rule_data_json_blob = build_rule_data_blob(action)

    rule = Rule(
        id=detector.id,
        project=detector.project,
        label=detector.name,
        data={
            "actions": rule_data_json_blob,
        },
        status=ObjectStatus.ACTIVE,
        source=RuleSource.ISSUE,
    )

    rule_fire_history = RuleFireHistory(
        project=detector.project,
        rule=rule,
        event_id=group_event.event_id,
        group_id=group_event.group_id,
        notification_uuid=notification_uuid,
    )

    rule.save()
    rule_fire_history.save()

    return rule, rule_fire_history, notification_uuid


def invoke_issue_alert_registry(action: Action, detector: Detector, group_event: GroupEvent):
    """
    Invokes the issue alert registry and sends a notification.

    :param action: Action model instance
    :param detector: Detector model instance
    :param group_event: GroupEvent model instance
    """

    rule, rule_fire_history, notification_uuid = form_issue_alert_models(
        action, detector, group_event
    )

    # TODO(iamrajjoshi): Add a check to see if the rule has only one action
    assert len(rule.data.get("actions", [])) == 1

    # This should only have one action
    for action_data in rule.data.get("actions", []):
        action_inst = instantiate_action(rule, action_data, rule_fire_history)
        if not action_inst:
            continue

        results = safe_execute(
            action_inst.after,
            event=group_event,
            notification_uuid=notification_uuid,
        )
        if results is None:
            # TODO(iamrajjoshi): Log an error
            continue

        for future in results:
            rule_future = RuleFuture(rule=rule, kwargs=future.kwargs)
            # Send the notification
            safe_execute(future.callback, group_event, [rule_future])
