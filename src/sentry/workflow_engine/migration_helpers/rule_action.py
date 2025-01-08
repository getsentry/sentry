import logging
from typing import Any

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    ACTION_TYPE_2_TARGET_TYPE_RULE_REGISTRY,
    EXCLUDED_ACTION_DATA_KEYS,
    RULE_REGISTRY_ID_2_INTEGRATION_PROVIDER,
    SlackDataBlob,
)

_logger = logging.getLogger(__name__)


def build_slack_data_blob(action: dict[str, Any]) -> SlackDataBlob:
    """
    Builds a SlackDataBlob from the action data.
    Only includes the keys that are not None.
    """
    return SlackDataBlob(
        tags=action.get("tags", ""),
        notes=action.get("notes", ""),
    )


def sanitize_to_action(action: dict[str, Any], action_type: Action.Type) -> dict[str, Any]:
    """
    Pops the keys we don't want to save inside the JSON field of the Action model.

    :param action: action data (Rule.data.actions)
    :param action_type: action type (Action.Type)
    :return: action data without the excluded keys
    """

    # # If we have a specific blob type, we need to sanitize the action data to the blob type
    if action_type == Action.Type.SLACK:
        return build_slack_data_blob(action).__dict__
    # # Otherwise, we can just return the action data as is, removing the keys we don't want to save
    else:
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


def build_notification_actions_from_rule_data_actions(
    actions: list[dict[str, Any]]
) -> list[Action]:
    """
    Builds notification actions from action field in Rule's data blob.

    :param actions: list of action data (Rule.data.actions)
    :return: list of notification actions (Action)
    """

    notification_actions: list[Action] = []

    for action in actions:
        # Use Rule.integration.provider to get the action type
        action_type = RULE_REGISTRY_ID_2_INTEGRATION_PROVIDER.get(action["id"])
        if action_type is None:
            _logger.warning(
                "Action type not found for action",
                extra={
                    "action_id": action["id"],
                    "action_uuid": action["uuid"],
                },
            )
            continue

        # For all integrations, the target type is specific
        # For email, the target type is user
        # For sentry app, the target type is sentry app
        # FWIW, we don't use target type for issue alerts
        target_type = ACTION_TYPE_2_TARGET_TYPE_RULE_REGISTRY.get(action_type)

        if target_type == ActionTarget.SPECIFIC:

            # Get the integration_id
            integration_id_key = ACTION_TYPE_2_INTEGRATION_ID_KEY.get(action_type)
            if integration_id_key is None:
                # we should always have an integration id key if target type is specific
                # TODO(iamrajjoshi): Should we fail loudly here?
                _logger.warning(
                    "Integration ID key not found for action type",
                    extra={
                        "action_type": action_type,
                        "action_id": action["id"],
                        "action_uuid": action["uuid"],
                    },
                )
                continue
            integration_id = action.get(integration_id_key)

            # Get the target_identifier if it exists
            target_identifier_key = ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action_type)
            if target_identifier_key is not None:
                target_identifier = action.get(target_identifier_key)

            # Get the target_display if it exists
            target_display_key = ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action_type)
            if target_display_key is not None:
                target_display = action.get(target_display_key)

        notification_action = Action(
            type=action_type,
            data=(
                # If the target type is specific, sanitize the action data
                # Otherwise, use the action data as is
                sanitize_to_action(action, action_type)
                if target_type == ActionTarget.SPECIFIC
                else action
            ),
            integration_id=integration_id,
            target_identifier=target_identifier,
            target_display=target_display,
            target_type=target_type,
        )

        notification_actions.append(notification_action)

    # Bulk create the actions, note: this won't call save(), not sure if we need to
    Action.objects.bulk_create(notification_actions)

    return notification_actions
