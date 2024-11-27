from typing import Any

from sentry.workflow_engine.actions.notification_action.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    RULE_REGISTRY_ID_2_ACTION_TYPE,
)
from sentry.workflow_engine.models.action import Action

EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


def pop_action_json_blob_data(action: dict[str, Any], action_type: Action.Type) -> dict[str, Any]:
    """
    Pops the keys we don't want to save inside the JSON field of the Action model.

    :param action: action data (Rule.data.actions)
    :param action_type: action type (Action.Type)
    :return: action data without the excluded keys
    """
    return {
        k: v
        for k, v in action.items()
        if k
        not in [
            ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action_type),
            ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action_type),
            ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action_type),
            *EXCLUDED_ACTION_DATA_KEYS,
        ]
    }


def build_notification_actions_from_rule_data(actions: list[dict[str, Any]]) -> list[Action]:
    """
    Builds notification actions from action field in Rule's data blob.

    :param actions: list of action data (Rule.data.actions)
    :return: list of notification actions (Action)
    """

    notification_actions: list[Action] = []

    for action in actions:
        # Use Rule -> Action.Type mapping to get the action type
        action_type = RULE_REGISTRY_ID_2_ACTION_TYPE[action["id"]]

        integration_id = action.get(ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action_type))

        # Get the target_identifier if it exists
        if action_type in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY:
            target_identifier = action.get(ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action_type))

        # Get the target_display if it exists
        if action_type in ACTION_TYPE_2_TARGET_DISPLAY_KEY:
            target_display = action.get(ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action_type))

        notification_action = Action(
            type=action_type,
            data=pop_action_json_blob_data(action, action_type),
            integration_id=integration_id,
            target_identifier=target_identifier,
            target_display=target_display,
        )

        notification_action.save()

        notification_actions.append(notification_action)

    return notification_actions
