import dataclasses
import logging
from typing import Any

from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    EXCLUDED_ACTION_DATA_KEYS,
    issue_alert_action_translator_registry,
)

logger = logging.getLogger(__name__)


def build_notification_actions_from_rule_data_actions(
    actions: list[dict[str, Any]]
) -> list[Action]:
    """
    Builds notification actions from action field in Rule's data blob.

    :param actions: list of action data (Rule.data.actions)
    :return: list of notification actions (Action)

    :raises ValueError: if action is missing an id
    :raises KeyError: if there isn't a translator registered for the id
    """

    notification_actions: list[Action] = []

    for action in actions:
        registry_id = action.get("id")
        if not registry_id:
            logger.error(
                "No registry ID found for action",
                extra={"action_uuid": action.get("uuid")},
            )
            continue

        try:
            translator_class = issue_alert_action_translator_registry.get(registry_id)
            translator = translator_class()
        except KeyError:
            logger.exception(
                "Action translator not found for action",
                extra={
                    "registry_id": registry_id,
                    "action_uuid": action.get("uuid"),
                },
            )
            continue

        # Get integration ID if needed
        # This won't be set for all actions, (e.g. sentry app)
        integration_id = None
        if translator.integration_id_key:
            integration_id = action.get(translator.integration_id_key)

        # Get target identifier if needed
        # This won't be set for all actions, (e.g. sentry app)
        target_identifier = None
        if translator.target_identifier_key:
            target_identifier = action.get(translator.target_identifier_key)

        # Get target display if needed
        # This won't be set for all actions, some integrations also don't have a target display
        target_display = None
        if translator.target_display_key:
            target_display = action.get(translator.target_display_key)

        # Sanitize the action data
        data = translator.sanitize_action(action)
        if translator.blob_type:
            # Convert to dataclass if blob type is specified
            # k.name contains the field name inside the dataclass
            blob_instance = translator.blob_type(
                **{k.name: action.get(k.name, "") for k in dataclasses.fields(translator.blob_type)}
            )
            data = dataclasses.asdict(blob_instance)
        else:
            # Remove keys we don't want to save
            data = {
                k: v
                for k, v in action.items()
                if k
                not in [
                    translator.integration_id_key,
                    translator.target_identifier_key,
                    translator.target_display_key,
                    *EXCLUDED_ACTION_DATA_KEYS,
                ]
            }

        notification_action = Action(
            type=translator.action_type,
            data=data,
            integration_id=integration_id,
            target_identifier=target_identifier,
            target_display=target_display,
            target_type=translator.target_type,
        )

        notification_actions.append(notification_action)

    # Bulk create the actions
    Action.objects.bulk_create(notification_actions)

    return notification_actions
