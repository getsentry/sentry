import logging
from typing import Any

from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.typings.notification_action import (
    issue_alert_action_translator_registry,
)

logger = logging.getLogger(__name__)


def translate_rule_data_actions_to_notification_actions(
    actions: list[dict[str, Any]]
) -> list[Action]:
    """
    Builds notification actions from action field in Rule's data blob.
    Will only create actions that are valid, and log any errors before skipping the action.

    :param actions: list of action data (Rule.data.actions)
    :return: list of notification actions (Action)
    """

    notification_actions: list[Action] = []

    for action in actions:
        # Fetch the registry ID
        registry_id = action.get("id")
        if not registry_id:
            logger.error(
                "No registry ID found for action",
                extra={"action_uuid": action.get("uuid")},
            )
            raise ValueError(f"No registry ID found for action: {action}")

        # Fetch the translator class
        try:
            translator_class = issue_alert_action_translator_registry.get(registry_id)
            translator = translator_class(action)
        except NoRegistrationExistsError as e:
            logger.exception(
                "Action translator not found for action",
                extra={
                    "registry_id": registry_id,
                    "action_uuid": action.get("uuid"),
                },
            )
            raise ValueError(
                f"Action translator not found for action with registry ID: {registry_id}, uuid: {action.get('uuid')}"
            ) from e

        # Check if the action is well-formed
        if not translator.is_valid():
            logger.error(
                "Action blob is malformed: missing required fields",
                extra={
                    "registry_id": registry_id,
                    "action_uuid": action.get("uuid"),
                    "missing_fields": translator.missing_fields,
                },
            )
            raise ValueError(
                f"Action blob is malformed: missing required fields with registry ID: {registry_id}, uuid: {action.get('uuid')}"
            )

        notification_action = Action(
            type=translator.action_type,
            data=translator.get_sanitized_data(),
            integration_id=translator.integration_id,
            target_identifier=translator.target_identifier,
            target_display=translator.target_display,
            target_type=translator.target_type,
        )

        notification_actions.append(notification_action)

    return notification_actions


def build_notification_actions_from_rule_data_actions(
    actions: list[dict[str, Any]], is_dry_run: bool = False
) -> list[Action]:
    """
    Builds notification actions from action field in Rule's data blob.
    Will only create actions that are valid, and log any errors before skipping the action.

    :param actions: list of action data (Rule.data.actions)
    :return: list of notification actions (Action)
    """

    notification_actions = translate_rule_data_actions_to_notification_actions(actions)

    # Bulk create the actions if not a dry run
    if not is_dry_run:
        Action.objects.bulk_create(notification_actions)

    return notification_actions
