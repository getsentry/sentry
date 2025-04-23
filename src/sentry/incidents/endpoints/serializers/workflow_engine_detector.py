from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, DefaultDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleStatus
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorState,
    DetectorWorkflow,
)


class WorkflowEngineDetectorSerializer(Serializer):
    """
    A temporary serializer to be used by the old alert rule endpoints to return data read from the new ACI models
    """

    def __init__(self, expand: list[str] | None = None, prepare_component_fields: bool = False):
        self.expand = expand or []
        self.prepare_component_fields = prepare_component_fields

    def get_attrs(
        self, item_list: Sequence[Detector], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[str, Any]:
        detectors = {item.id: item for item in item_list}
        detector_ids = list(detectors.keys())
        result: DefaultDict[Detector, dict[str, Any]] = defaultdict(dict)

        workflow_dcg_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow__in=Subquery(
                DetectorWorkflow.objects.filter(detector__in=detector_ids).values_list(
                    "workflow_id", flat=True
                )
            )
        ).values_list("id", flat=True)
        data_conditions = DataCondition.objects.filter(condition_group__in=workflow_dcg_ids)
        dcgas = DataConditionGroupAction.objects.filter(
            condition_group__in=workflow_dcg_ids
        ).select_related("action")
        actions = [dcga.action for dcga in dcgas]

        # get sentry app data
        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext] = {}
        organization_ids = [detector.project.organization_id for detector in detectors.values()]
        if self.prepare_component_fields:
            sentry_app_ids = [
                action.config.get("sentry_app_id")
                for action in actions
                if action.config.get("sentry_app_id")
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

        # build up trigger and action data
        serialized_data_conditions = serialize(
            data_conditions, WorkflowEngineDataConditionSerializer(), **kwargs
        )
        for data_condition, serialized in zip(data_conditions, serialized_data_conditions):
            errors = []
            detector = detectors[data_condition.get("alertRuleId")]
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

        # add projects
        detector_projects = set()
        for detector in detectors.values():
            detector_projects.add((detector.id, detector.project.slug))

        for detector_id, project_slug in detector_projects:
            rule_result = result[detectors[detector_id]].setdefault("projects", [])
            rule_result.append(project_slug)

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
            result[detector]["created_by"] = created_by

        # add owner
        for detector in detectors.values():
            if detector.owner_user_id or detector.owner_team_id:
                actor = detector.owner
                if actor:
                    result[detector]["owner"] = actor.identifier

        # skipping snapshot data

        # TODO fetch latest metric issue occurrence (open period?) if "latestIncident" in self.expand
        # if "latestIncident" in self.expand:
        #     incident_map = {}
        #     for incident in Incident.objects.filter(
        #         id__in=Incident.objects.filter(alert_rule__in=alert_rules)
        #         .values("alert_rule_id")
        #         .annotate(incident_id=Max("id"))
        #         .values("incident_id")
        #     ):
        #         incident_map[incident.alert_rule_id] = serialize(incident, user=user)
        #     for alert_rule in alert_rules.values():
        #         result[alert_rule]["latestIncident"] = incident_map.get(alert_rule.id, None)
        return result

    def serialize(self, obj: Detector, attrs, user, **kwargs) -> AlertRuleSerializerResponse:
        alert_rule_detector_id = AlertRuleDetector.objects.values_list(
            "alert_rule_id", flat=True
        ).get(detector=obj)
        active = DetectorState.objects.values_list("active", flat=True).get(detector=obj)

        return {
            "id": str(alert_rule_detector_id),
            "name": obj.name,
            "organizationId": obj.project.organization_id,
            "status": (
                AlertRuleStatus.PENDING.value if active is True else AlertRuleStatus.DISABLED
            ),  # this is a rough first pass, need to handle other statuses
            "query": "test",  # TODO get these all from get attrs
            "aggregate": "test",
            "timeWindow": 1,
            "resolution": 1,
            "thresholdPeriod": 1,
            "triggers": attrs.get("triggers", []),
            "projects": sorted(attrs.get("projects", [])),
            "owner": attrs.get("owner", None),
            "dateModified": obj.date_updated,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by", None),
            "description": obj.description,
            "detectionType": obj.type,
        }
