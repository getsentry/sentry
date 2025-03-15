from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.workflow_engine_alert_rule_trigger import (
    WorkflowEngineAlertRuleTriggerSerializer,
)
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class WorkflowEngineAlertRuleSerializer(Serializer):
    """
    A temporary serializer to be used by the old alert rule endpoints to return data read from the new ACI models
    """

    def __init__(self, expand: list[str] | None = None, prepare_component_fields: bool = False):
        self.expand = expand or []
        self.prepare_component_fields = prepare_component_fields

    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[str, Any]:

        alert_rules = {item.id: item for item in item_list}
        organization_ids = list({alert_rule.organization_id for alert_rule in alert_rules.values()})
        prefetch_related_objects(item_list, "snuba_query__environment")

        result: defaultdict[AlertRule, dict[str, Any]] = defaultdict(
            dict
        )  # TODO change the typing here, won't be AlertRule
        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext] = {}

        alert_rule_detectors = AlertRuleDetector.objects.select_related(
            "detector__workflow_condition_group"
        ).filter(alert_rule__in=[item_list])
        detectors = [alert_rule_detector.detector for alert_rule_detector in alert_rule_detectors]
        detector_data_condition_groups = [
            detector.workflow_condition_group for detector in detectors
        ]

        threshold_types = [
            (
                Condition.GREATER
                if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
                else Condition.LESS
            )
            for alert_rule in alert_rules.values()
        ]
        # don't have access to the triggers unless I look them up .. is that ok? we want to be reading from the new tables
        # but maybe it's alright as long as we don't delete the old tables before deprecating the endpoints that use this :think:

        # condition_result = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
        detector_triggers = DataCondition.objects.filter(
            # comparison=alert_rule_trigger.alert_threshold,
            # condition_result=condition_result,
            type__in=[threshold_types],
            condition_group__in=[detector_data_condition_groups],
        )
        data_condition_groups = DataConditionGroup.objects.filter(
            organization_id__in=organization_ids
        )
        alert_rule_workflows = AlertRuleWorkflow.objects.select_related("workflow").filter(
            alert_rule_in=[alert_rule for alert_rule in alert_rules]
        )
        workflow_data_condition_groups = WorkflowDataConditionGroup.objects.filter(
            condition_group__in=[data_condition_groups],
            workflow__in=[
                alert_rule_workflow.workflow for alert_rule_workflow in alert_rule_workflows
            ],
        )
        action_filters = DataCondition.objects.filter(
            # comparison=PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH),
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group__in=[data_condition_groups],
        )
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id__in=[dcg.id for dcg in data_condition_groups],
        )
        actions = Action.objects.filter(
            id__in=[dcga.action_id for dcga in data_condition_group_actions]
        )
        data_conditions = list(detector_triggers)
        data_conditions.append(action_filters)
        serialized_triggers = serialize(
            data_conditions, WorkflowEngineAlertRuleTriggerSerializer(), **kwargs
        )

        if self.prepare_component_fields:
            sentry_app_ids = [
                action.data.get("sentry_app_id")
                for action in actions
                if action.data.get("sentry_app_id")
            ]
            install_contexts = app_service.get_component_contexts(
                filter={"app_ids": sentry_app_ids, "organization_id": organization_ids[0]},
                component_type="alert-rule-action",
            )
            sentry_app_installations_by_sentry_app_id = {
                str(context.installation.sentry_app.id): context
                for context in install_contexts
                if context.installation.sentry_app
            }

        # TODO create a workflow engine alert rule trigger serializer to be used here
        # errors = []
        # alert_rule = alert_rules[trigger.alert_rule_id]
        # alert_rule_triggers = result[alert_rule].setdefault("triggers", [])
        # serialized_actions = defaultdict(dict)
        # for action in actions:
        #     # Prepare AlertRuleTriggerActions that are SentryApp components
        #     install_context = None
        #     sentry_app_id = str(action.data.get("sentryAppId"))
        #     if sentry_app_id:
        #         install_context = sentry_app_installations_by_sentry_app_id.get(sentry_app_id)
        #     if install_context:
        #         rpc_install = install_context.installation
        #         rpc_component = install_context.component
        #         rpc_app = rpc_install.sentry_app
        #         assert rpc_app

        #         serialized_actions[action]["sentryAppInstallationUuid"] = rpc_install.uuid

        #         component = prepare_ui_component(
        #             rpc_install,
        #             rpc_component,
        #             None,
        #             action.get("settings"),
        #         )
        #         if component is None:
        #             errors.append({"detail": f"Could not fetch details from {rpc_app.name}"})
        #             serialized_actions[action]["disabled"] = True
        #             continue

        #         serialized_actions[action]["formFields"] = component.app_schema.get("settings", {})
        # TODO add the actions (within triggers I think?)
        # TODO figure out where to add errors
        # if errors:
        # 	result[alert_rule]["errors"] = errors

        # add projects
        for item in item_list:
            alert_rule_detectors = alert_rule_detectors.filter(alert_rule_id=item.id)
            result[item]["projects"] = [
                alert_rule_detector.detector.project for alert_rule_detector in alert_rule_detectors
            ]

        # add created_by
        user_by_user_id: MutableMapping[int, RpcUser] = {
            user.id: user
            for user in user_service.get_many_by_id(
                ids=[
                    detector.created_by_id
                    for detector in detectors
                    if detector.created_by_id is not None
                ]
            )
        }
        for detector in detectors:
            # this is based on who created or updated it during dual write
            rpc_user = user_by_user_id.get(detector.created_by_id)
            created_by = dict(
                id=rpc_user.id, name=rpc_user.get_display_name(), email=rpc_user.email
            )
            alert_rule_detector = alert_rule_detectors.filter(detector_id=detector.id)
            result[alert_rules[alert_rule_detector.alert_rule_id]]["created_by"] = created_by

        # add owner
        for item in item_list:
            if item.user_id or item.team_id:
                actor = item.owner
                if actor:
                    result[item]["owner"] = actor.identifier

        # skipping snapshot data

        # TODO fetch latest metric issue occurrence if "latestIncident" in self.expand
        return result
