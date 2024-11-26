import uuid
from typing import Any

from sentry.constants import ObjectStatus
from sentry.models.group import GroupEvent
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.actions.base import instantiate_action
from sentry.types.rules import RuleFuture
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.nowa.mappings import (
    ACTION_TYPE_2_INTEGRATION_ID_KEY,
    ACTION_TYPE_2_RULE_REGISTRY_ID,
    ACTION_TYPE_2_TARGET_DISPLAY_KEY,
    ACTION_TYPE_2_TARGET_IDENTIFIER_KEY,
    RULE_REGISTRY_ID_2_ACTION_TYPE,
)

EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


def pop_action_data(action: dict[str, Any], action_type: Action.Type) -> dict[str, Any]:
    # pop the keys we don't want to save in the nowa instance
    # this is to ensure we don't save any extra data that we don't want to
    # ex: integration_id, target_identifier, target_display
    return {
        k: v
        for k, v in action.items()
        if k
        not in [
            ACTION_TYPE_2_INTEGRATION_ID_KEY[action_type],
            ACTION_TYPE_2_TARGET_IDENTIFIER_KEY[action_type],
            ACTION_TYPE_2_TARGET_DISPLAY_KEY[action_type],
            *EXCLUDED_ACTION_DATA_KEYS,
        ]
    }


def build_nowa_instances_from_actions(actions: list[dict[str, Any]]) -> list[Action]:

    nowa_instances: list[Action] = []

    for action in actions:
        # get action type
        action_type = RULE_REGISTRY_ID_2_ACTION_TYPE[action["id"]]

        # what key should the integration id be?
        integration_id = action.get(ACTION_TYPE_2_INTEGRATION_ID_KEY[action_type])

        # what key should the target identifier be if it exists?
        target_identifier = action.get(ACTION_TYPE_2_TARGET_IDENTIFIER_KEY[action_type])

        # what key should the target display be if it exists?
        target_display = action.get(ACTION_TYPE_2_TARGET_DISPLAY_KEY[action_type])

        nowa_instance = Action.objects.create(
            type=action_type,
            data=pop_action_data(action, action_type),
            integration_id=integration_id,
            target_identifier=target_identifier,
            target_display=target_display,
        )
        nowa_instances.append(nowa_instance)

    return nowa_instances


def build_rule_data(action: Action) -> list[dict[str, Any]]:
    rule_data = dict(action.data)

    rule_data["id"] = ACTION_TYPE_2_RULE_REGISTRY_ID[action.type]

    rule_data["uuid"] = action.id

    # what key should the integration id be?
    integration_id_key = ACTION_TYPE_2_INTEGRATION_ID_KEY[action.type]
    rule_data[integration_id_key] = action.integration_id

    # what key should the target identifier be if it exists?
    target_identifier_key = ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.get(action.type)
    if target_identifier_key:
        rule_data[target_identifier_key] = action.target_identifier

    # what key should the target display be if it exists?
    target_display_key = ACTION_TYPE_2_TARGET_DISPLAY_KEY.get(action.type)
    if target_display_key:
        rule_data[target_display_key] = action.target_display

    return [rule_data]


def translate_action_for_issue_alert(
    action: Action, detector: Detector, group_event: GroupEvent
) -> tuple[Rule, RuleFireHistory, str]:

    # build a notification uuid
    notification_uuid = str(uuid.uuid4())

    assert detector.project == group_event.project

    # build json blob for rule
    rule_data = build_rule_data(action)

    rule = Rule(
        id=detector.id,
        project=detector.project,
        label=detector.name,
        data={
            "actions": rule_data,
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

    return rule, rule_fire_history, notification_uuid


def invoke_nowa(rule: Rule, group_event: GroupEvent) -> None:
    """
    replaces more or less the following:

    notification_uuid = str(uuid.uuid4())
    rule_fire_history = history.record(rule, self.group, self.event.event_id, notification_uuid)
    grouped_futures = activate_downstream_actions(
        rule, self.event, notification_uuid, rule_fire_history
    )
    """
    # build Action (NOWA) instances
    # TODO: this is a temporary solution to build the NOWA instances from the rule data
    # TODO: this should be removed once we have a more permanent solution for building the NOWA instances

    nowa_instances = build_nowa_instances_from_actions(rule.data.get("actions", ()))
    detector = Detector.objects.create(
        project=group_event.project,
        name=rule.label,
    )
    for nowa_instance in nowa_instances:
        # regenerate the legacy models
        rule_new, rule_fire_history, notification_uuid = translate_action_for_issue_alert(
            nowa_instance, detector, group_event
        )

        rule_new.save()
        rule_fire_history.save()

        # activate downstream actions
        for action in rule_new.data.get("actions", ()):
            action_inst = instantiate_action(rule_new, action, rule_fire_history)
            if not action_inst:
                continue

            results = safe_execute(
                action_inst.after,
                event=group_event,
                notification_uuid=notification_uuid,
            )
            if results is None:
                continue

            # This part is different from the legacy implementation
            # here, instead of grouping the futures by event_id, we just have a single future
            # so we just execute the future here
            for future in results:
                rule_future = RuleFuture(rule=rule, kwargs=future.kwargs)
                # execute the future
                # Notification sent
                safe_execute(future.callback, group_event, [rule_future])
