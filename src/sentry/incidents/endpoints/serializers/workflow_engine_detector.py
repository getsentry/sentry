from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, DefaultDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleStatus
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.snuba.models import SnubaQuery
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    DataCondition,
    DataConditionGroupAction,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowEngineDetectorSerializer(Serializer):
    """
    A temporary serializer to be used by the old alert rule endpoints to return data read from the new ACI models
    """

    def __init__(self, expand: list[str] | None = None, prepare_component_fields: bool = False):
        self.expand = expand or []
        self.prepare_component_fields = prepare_component_fields

    def add_sentry_app_installations_by_sentry_app_id(
        self, actions: list[Action], organization_id: int
    ) -> Mapping[str, RpcSentryAppComponentContext]:
        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext] = {}
        if self.prepare_component_fields:
            sentry_app_ids = [
                action.config.get("sentry_app_id")
                for action in actions
                if action.config.get("sentry_app_id")
            ]
            install_contexts = app_service.get_component_contexts(
                filter={"app_ids": sentry_app_ids, "organization_id": organization_id},
                component_type="alert-rule-action",
            )
            sentry_app_installations_by_sentry_app_id = {
                str(context.installation.sentry_app.id): context
                for context in install_contexts
                if context.installation.sentry_app
            }
        return sentry_app_installations_by_sentry_app_id

    def add_triggers_and_actions(
        self,
        result: DefaultDict[Detector, dict[str, Any]],
        detectors: dict[int, Detector],
        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext],
        data_conditions: list[DataCondition],
        serialized_data_conditions: dict[str, Any],
    ) -> None:
        for data_condition, serialized in zip(data_conditions, serialized_data_conditions):
            errors = []
            detector = detectors[int(serialized.get("alertRuleId"))]
            alert_rule_triggers = result[detector].setdefault("triggers", [])
            for action in serialized.get("actions", []):
                if action is None:
                    continue

                # Prepare AlertRuleTriggerActions that are SentryApp components
                install_context = None
                sentry_app_id = str(action.get("sentryAppId"))
                if sentry_app_id:
                    install_context = sentry_app_installations_by_sentry_app_id.get(sentry_app_id)
                if install_context:
                    rpc_install = install_context.installation
                    rpc_component = install_context.component
                    rpc_app = rpc_install.sentry_app
                    assert rpc_app

                    action["sentryAppInstallationUuid"] = rpc_install.uuid

                    component = (
                        prepare_ui_component(
                            rpc_install,
                            rpc_component,
                            None,
                            action.get("settings"),
                        )
                        if rpc_component
                        else None
                    )
                    if component is None:
                        errors.append({"detail": f"Could not fetch details from {rpc_app.name}"})
                        action["disabled"] = True
                        continue

                    action["formFields"] = component.app_schema.get("settings", {})

            if errors:
                result[detector]["errors"] = errors
            alert_rule_triggers.append(serialized)

    def add_projects(
        self, result: DefaultDict[Detector, dict[str, Any]], detectors: dict[int, Detector]
    ) -> None:
        detector_projects = set()
        for detector in detectors.values():
            detector_projects.add((detector.id, detector.project.slug))

        for detector_id, project_slug in detector_projects:
            rule_result = result[detectors[detector_id]].setdefault("projects", [])
            rule_result.append(project_slug)

    def add_created_by(
        self, result: DefaultDict[Detector, dict[str, Any]], detectors: Sequence[Detector]
    ) -> None:
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
            if not rpc_user:
                result[detector]["created_by"] = {}
            else:
                created_by = dict(
                    id=rpc_user.id, name=rpc_user.get_display_name(), email=rpc_user.email
                )
                result[detector]["created_by"] = created_by

    def add_owner(
        self, result: DefaultDict[Detector, dict[str, Any]], detectors: Sequence[Detector]
    ) -> None:
        for detector in detectors:
            if detector.owner_user_id or detector.owner_team_id:
                actor = detector.owner
                if actor:
                    result[detector]["owner"] = actor.identifier

    def get_attrs(
        self, item_list: Sequence[Detector], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[str, Any]:
        detectors = {item.id: item for item in item_list}
        result: DefaultDict[Detector, dict[str, Any]] = defaultdict(dict)

        detector_workflow_condition_group_ids = [
            detector.workflow_condition_group.id for detector in detectors.values()
        ]
        detector_trigger_data_conditions = DataCondition.objects.filter(
            condition_group__in=detector_workflow_condition_group_ids,
            condition_result__in=[DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM],
        )
        dcgas = DataConditionGroupAction.objects.filter(
            condition_group__in=detector_workflow_condition_group_ids
        ).select_related("action")
        actions = [dcga.action for dcga in dcgas]

        # add sentry app data
        organization_id = [detector.project.organization_id for detector in detectors.values()][0]
        sentry_app_installations_by_sentry_app_id = (
            self.add_sentry_app_installations_by_sentry_app_id(actions, organization_id)
        )

        # add trigger and action data
        serialized_data_conditions = serialize(
            list(detector_trigger_data_conditions),
            user,
            WorkflowEngineDataConditionSerializer(),
            **kwargs,
        )
        self.add_triggers_and_actions(
            result,
            detectors,
            sentry_app_installations_by_sentry_app_id,
            detector_trigger_data_conditions,
            serialized_data_conditions,
        )
        self.add_projects(result, detectors)
        self.add_created_by(result, detectors.values())
        self.add_owner(result, detectors.values())
        # skipping snapshot data

        # TODO fetch incident group open period if "latestIncident" in self.expand, needs new incident serializer
        # how to look this up?
        if "latestIncident" in self.expand:
            pass

        # add information from snubaquery
        for detector in detectors.values():
            data_source_detector = DataSourceDetector.objects.get(detector_id=detector.id)
            snuba_query = SnubaQuery.objects.get(id=data_source_detector.data_source.source_id)
            result[detector]["query"] = snuba_query.query
            result[detector]["aggregate"] = snuba_query.aggregate
            result[detector]["timeWindow"] = snuba_query.time_window
            result[detector]["resolution"] = snuba_query.resolution

        return result

    def serialize(self, obj: Detector, attrs, user, **kwargs) -> AlertRuleSerializerResponse:
        alert_rule_detector_id = AlertRuleDetector.objects.values_list(
            "alert_rule_id", flat=True
        ).get(detector=obj)
        return {
            "id": str(alert_rule_detector_id),
            "name": obj.name,
            "organizationId": obj.project.organization_id,
            "status": AlertRuleStatus.PENDING.value,  # TODO look into how other statuses translate
            "query": attrs.get("query"),
            "aggregate": attrs.get("aggregate"),
            "timeWindow": attrs.get("timeWindow"),
            "resolution": attrs.get("resolution"),
            "thresholdPeriod": obj.config.get("thresholdPeriod"),
            "triggers": attrs.get("triggers", []),
            "projects": sorted(attrs.get("projects", [])),
            "owner": attrs.get("owner", None),
            "dateModified": obj.date_updated,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "description": obj.description,
            "detectionType": obj.type,
        }
