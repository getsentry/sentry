import uuid
from typing import Any, Literal

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationProviderSlug
from sentry.integrations.models import Integration
from sentry.models.group import GroupEvent
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.rules.actions.base import instantiate_action
from sentry.types.rules import RuleFuture
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.typings.notification_action import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    INTEGRATION_PROVIDER_2_RULE_REGISTRY_ID,
)


def build_rule_data_blob(
    action: Action, provider: IntegrationProviderSlug | Literal["email", "sentry_app"]
) -> list[dict[str, Any]]:
    """
    Builds the Rule.data.actions json blob from the Action model.

    :param action: Action model instance
    :return: list of dicts with the rule data with length 1
    """

    # Copy the action data to the rule data
    rule_data = dict(action.data)

    # Add the rule registry id to the rule data
    rule_data["id"] = INTEGRATION_PROVIDER_2_RULE_REGISTRY_ID[provider]

    # Add the action uuid to the rule data
    rule_data["uuid"] = action.id

    # If the target type is specific, add the integration id, target identifier, and target display to the rule data
    if action.target_type == ActionTarget.SPECIFIC:

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


def create_rule_from_action(
    action: Action,
    detector: Detector,
    provider: IntegrationProviderSlug | Literal["email", "sentry_app"],
) -> Rule:
    """
    Creates a Rule model from the Action model.

    :param action: Action model instance
    :param detector: Detector model instance
    :return: Rule model instance
    """
    # TODO(iamrajjoshi): need to lookup the Rule so we don't add too many rules

    rule = Rule(
        id=detector.id,
        project=detector.project,
        label=detector.name,
        data={"actions": build_rule_data_blob(action, provider)},
        status=ObjectStatus.ACTIVE,
        source=RuleSource.ISSUE,
    )

    rule.save()

    return rule


def deduce_provider_from_action(
    action: Action,
) -> IntegrationProviderSlug | Literal["email", "sentry_app"]:
    """
    Deduces the provider from the action.

    :param action: Action model instance
    :return: str
    """

    # If there is a integration_id, use the integration_id_key to get the integration provider slug
    if action.integration_id:
        integration = Integration.objects.get(id=action.integration_id)

        # TODO(iamrajjoshi): Check if the integration exists
        assert integration

        # TODO(iamrajjoshi): Check if the integration provider is valid
        return IntegrationProviderSlug(integration.provider)

    # If there is no integration_id, use the action.target_type to get the integration provider slug
    if action.target_type == ActionTarget.USER:
        return "email"
    elif action.target_type == ActionTarget.SENTRY_APP:
        return "sentry_app"

    # TODO(iamrajjoshi): Take care of failure cases
    raise NotImplementedError(f"Unsupported target type: {action.target_type}")


def create_rule_fire_history_from_action(
    action: Action, detector: Detector, group_event: GroupEvent, rule: Rule, notification_uuid: str
) -> RuleFireHistory:
    """
    Creates a RuleFireHistory model from the Action model.

    :param action: Action model instance
    :param detector: Detector model instance
    :param group_event: GroupEvent model instance
    :param rule: Rule model instance
    :param notification_uuid: str
    :return: RuleFireHistory model instanceq
    """

    rule_fire_history = RuleFireHistory(
        project=detector.project,
        rule=rule,
        event_id=group_event.event_id,
        group_id=group_event.group_id,
        notification_uuid=notification_uuid,
    )

    rule_fire_history.save()

    return rule_fire_history


def send_notification_using_rule_registry(
    action: Action, detector: Detector, group_event: GroupEvent
):
    """
    Invokes the issue alert registry (rule registry) and sends a notification.

    :param action: Action model instance
    :param detector: Detector model instance
    :param group_event: GroupEvent model instance
    """

    # TODO: Use integration id to figure out which integration to send the noticication to
    # TODO: Types for each integration
    # TODO:

    with sentry_sdk.start_span(
        op="sentry.workflow_engine.actions.notification_action.create_legacy_rule_registry_models"
    ):
        # Create a notification uuid
        notification_uuid = str(uuid.uuid4())

        # TODO(iamrajjoshi): Change to a check
        assert detector.project == group_event.project

        provider = deduce_provider_from_action(action)

        # Create a rule
        rule = create_rule_from_action(action, detector, provider)

        # Create a rule fire history
        rule_fire_history = create_rule_fire_history_from_action(
            action, detector, group_event, rule, notification_uuid
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
