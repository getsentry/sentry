from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q, Subquery

from sentry.api.serializers import Serializer, serialize

if TYPE_CHECKING:
    from sentry.incidents.endpoints.serializers.alert_rule import (
        AlertRuleSerializerResponse,
        DetailedAlertRuleSerializerResponse,
    )

from sentry.incidents.endpoints.serializers.utils import (
    get_fake_id_from_object_id,
    get_object_id_from_fake_id,
)
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.models.alert_rule import (
    AlertRuleStatus,
    AlertRuleThresholdType,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.snuba.models import ExtrapolationMode, QuerySubscription, SnubaQueryEventType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow_action_group_status import WorkflowActionGroupStatus
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
                int(action.config.get("target_identifier"))
                for action in actions
                if action.type == Action.Type.SENTRY_APP.value
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
        result: defaultdict[Detector, dict[str, Any]],
        detectors: dict[int, Detector],
        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext],
        serialized_data_conditions: list[dict[str, Any]],
    ) -> None:
        for serialized in serialized_data_conditions:
            errors = []
            alert_rule_id = serialized.get("alertRuleId")
            assert alert_rule_id
            try:
                detector_id = AlertRuleDetector.objects.values_list("detector_id", flat=True).get(
                    alert_rule_id=alert_rule_id
                )
            except AlertRuleDetector.DoesNotExist:
                detector_id = get_object_id_from_fake_id(int(alert_rule_id))

            detector = detectors[int(detector_id)]
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
        self, result: defaultdict[Detector, dict[str, Any]], detectors: dict[int, Detector]
    ) -> None:
        detector_projects = set()
        for detector in detectors.values():
            detector_projects.add((detector.id, detector.project.slug))

        for detector_id, project_slug in detector_projects:
            rule_result = result[detectors[detector_id]].setdefault(
                "projects", []
            )  # keyerror I guess could be here
            rule_result.append(project_slug)

    def add_created_by(
        self, result: defaultdict[Detector, dict[str, Any]], detectors: Sequence[Detector]
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
            rpc_user = None
            if detector.created_by_id:
                rpc_user = user_by_user_id.get(detector.created_by_id)
            if not rpc_user:
                result[detector]["created_by"] = None
            else:
                created_by = dict(
                    id=rpc_user.id, name=rpc_user.get_display_name(), email=rpc_user.email
                )
                result[detector]["created_by"] = created_by

    def add_owner(
        self, result: defaultdict[Detector, dict[str, Any]], detectors: Sequence[Detector]
    ) -> None:
        for detector in detectors:
            if detector.owner_user_id or detector.owner_team_id:
                actor = detector.owner
                if actor:
                    result[detector]["owner"] = actor.identifier

    def add_latest_incident(
        self,
        result: defaultdict[Detector, dict[str, Any]],
        user: User | RpcUser | AnonymousUser,
        detectors: dict[int, Detector],
        detector_to_action_ids: defaultdict[Detector, list[int]],
    ) -> None:
        all_action_ids = []
        for action_ids in detector_to_action_ids.values():
            all_action_ids.extend(action_ids)

        wf_action_group_statuses = WorkflowActionGroupStatus.objects.filter(
            action_id__in=all_action_ids
        )

        detector_to_group_ids = defaultdict(set)
        for wf_action_group_status in wf_action_group_statuses:
            for detector, action_ids in detector_to_action_ids.items():
                if wf_action_group_status.action_id in action_ids:
                    detector_to_group_ids[detector].add(wf_action_group_status.group_id)

        open_periods = None
        group_ids = {
            wf_action_group_status.group_id for wf_action_group_status in wf_action_group_statuses
        }
        if group_ids:
            open_periods = GroupOpenPeriod.objects.filter(group__in=group_ids)

        for detector in detectors.values():
            # TODO: this serializer is half baked
            if open_periods:
                latest_open_periods = open_periods.filter(
                    Q(group__in=detector_to_group_ids[detector])
                ).order_by("-date_started")
                serialized_group_open_period = serialize(
                    latest_open_periods.first(), user, WorkflowEngineIncidentSerializer()
                )
                result[detector]["latestIncident"] = serialized_group_open_period

    def get_attrs(
        self, item_list: Sequence[Detector], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[Detector, dict[str, Any]]:
        detectors = {item.id: item for item in item_list}
        detector_ids = [item.id for item in item_list]
        result: defaultdict[Detector, dict[str, Any]] = defaultdict(dict)

        detector_workflow_condition_group_ids = [
            detector.workflow_condition_group.id
            for detector in detectors.values()
            if detector.workflow_condition_group
        ]
        # NOTE: Assumes DataConditions are limited to what would be dual written.
        detector_trigger_data_conditions = DataCondition.objects.filter(
            condition_group__in=detector_workflow_condition_group_ids,
            condition_result__in=[DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM],
        )
        workflow_dcg_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow__in=Subquery(
                DetectorWorkflow.objects.filter(detector__in=detector_ids).values_list(
                    "workflow_id", flat=True
                )
            )
        ).values_list("id", flat=True)
        action_filter_data_condition_groups = DataCondition.objects.filter(
            comparison__in=[
                detector_trigger.condition_result
                for detector_trigger in detector_trigger_data_conditions
            ],
            condition_group__in=Subquery(workflow_dcg_ids),
        ).select_related("condition_group")

        dcgas = DataConditionGroupAction.objects.filter(
            condition_group__in=[
                action_filter.condition_group
                for action_filter in action_filter_data_condition_groups
            ]
        ).select_related("action")
        actions = [dcga.action for dcga in dcgas]

        # add sentry app data
        organization_id = [detector.project.organization_id for detector in detectors.values()][0]
        sentry_app_installations_by_sentry_app_id = (
            self.add_sentry_app_installations_by_sentry_app_id(actions, organization_id)
        )

        # add trigger and action data
        # Evaluate queryset once and reuse for both serialization and lookup dict
        detector_trigger_data_conditions_list = list(detector_trigger_data_conditions)
        serialized_data_conditions = serialize(
            detector_trigger_data_conditions_list,
            user,
            WorkflowEngineDataConditionSerializer(),
            **kwargs,
        )
        self.add_triggers_and_actions(
            result,
            detectors,
            sentry_app_installations_by_sentry_app_id,
            serialized_data_conditions,
        )
        # derive thresholdType and sensitivity/seasonality from trigger data conditions
        # Build a dict to avoid N queries when looking up by condition_group_id
        trigger_dc_by_condition_group_id = {
            dc.condition_group_id: dc for dc in detector_trigger_data_conditions_list
        }
        for detector in detectors.values():
            wcg = detector.workflow_condition_group
            if wcg:
                trigger_dc = trigger_dc_by_condition_group_id.get(wcg.id)
                if trigger_dc:
                    if trigger_dc.type == Condition.ANOMALY_DETECTION:
                        result[detector]["thresholdType"] = trigger_dc.comparison.get(
                            "threshold_type"
                        )
                        result[detector]["sensitivity"] = trigger_dc.comparison.get("sensitivity")
                        result[detector]["seasonality"] = trigger_dc.comparison.get("seasonality")
                    else:
                        result[detector]["thresholdType"] = (
                            AlertRuleThresholdType.ABOVE.value
                            if trigger_dc.type == Condition.GREATER
                            else AlertRuleThresholdType.BELOW.value
                        )
                        result[detector]["sensitivity"] = None
                        result[detector]["seasonality"] = None

        self.add_projects(result, detectors)
        self.add_created_by(result, list(detectors.values()))
        self.add_owner(result, list(detectors.values()))

        alert_rule_ids_by_detector_id = dict(
            AlertRuleDetector.objects.filter(detector_id__in=detector_ids).values_list(
                "detector_id", "alert_rule_id"
            )
        )
        for detector in detectors.values():
            result[detector]["alert_rule_id"] = alert_rule_ids_by_detector_id.get(detector.id)

        # Note: originalAlertRuleId comes from AlertRuleActivity snapshots, which were not
        # migrated to the workflow engine. This field will always be None for detectors.

        if "latestIncident" in self.expand:
            # to get the actions for a detector, we need to go from detector -> workflow -> action filters for that workflow -> actions
            detector_workflow_values = DetectorWorkflow.objects.filter(
                detector__in=detector_ids
            ).values_list("detector_id", "workflow_id")
            detector_id_to_workflow_ids = defaultdict(list)
            for detector_id, workflow_id in detector_workflow_values:
                detector_id_to_workflow_ids[detector_id].append(workflow_id)

            workflow_action_values = dcgas.values_list(
                "condition_group__workflowdataconditiongroup__workflow_id", "action_id"
            )

            workflow_id_to_action_ids = defaultdict(list)
            for workflow_id, action_id in workflow_action_values:
                workflow_id_to_action_ids[workflow_id].append(action_id)

            detector_to_action_ids = defaultdict(list)
            for detector_id in detectors:
                for workflow_id in detector_id_to_workflow_ids.get(detector_id, []):
                    detector_to_action_ids[detectors[detector_id]].extend(
                        workflow_id_to_action_ids.get(workflow_id, [])
                    )

            self.add_latest_incident(result, user, detectors, detector_to_action_ids)

        # add information from snubaquery
        data_source_detectors = DataSourceDetector.objects.filter(
            detector_id__in=detectors.keys()
        ).select_related("data_source")
        # Assumption: 1 DataSource per Detector
        dsd_by_detector_id = {dsd.detector_id: dsd for dsd in data_source_detectors}

        query_subscriptions = QuerySubscription.objects.filter(
            id__in=[int(dsd.data_source.source_id) for dsd in data_source_detectors]
        ).select_related("snuba_query__environment")
        qs_by_id = {qs.id: qs for qs in query_subscriptions}

        snuba_query_ids = []
        for detector in detectors.values():
            data_source_detector = dsd_by_detector_id[detector.id]
            query_subscription = qs_by_id[int(data_source_detector.data_source.source_id)]
            snuba_query = query_subscription.snuba_query
            snuba_query_ids.append(snuba_query.id)
            result[detector]["query"] = snuba_query.query
            result[detector]["aggregate"] = snuba_query.aggregate
            result[detector]["timeWindow"] = snuba_query.time_window / 60
            result[detector]["resolution"] = snuba_query.resolution / 60
            env = snuba_query.environment
            result[detector]["environment"] = env.name if env else None
            result[detector]["queryType"] = snuba_query.type
            result[detector]["dataset"] = snuba_query.dataset
            extrapolation_mode = snuba_query.extrapolation_mode
            result[detector]["extrapolationMode"] = (
                ExtrapolationMode(extrapolation_mode).name.lower()
                if extrapolation_mode is not None
                else None
            )
            result[detector]["snuba_query_id"] = snuba_query.id

        # Only query for event types if they will be included in the output
        if "eventTypes" in self.expand:
            event_types_by_snuba_query: defaultdict[int, list[str]] = defaultdict(list)
            for event_type in SnubaQueryEventType.objects.filter(
                snuba_query_id__in=snuba_query_ids
            ):
                event_types_by_snuba_query[event_type.snuba_query_id].append(
                    SnubaQueryEventType.EventType(event_type.type).name.lower()
                )
            for detector in detectors.values():
                sq_id: int | None = result[detector].get("snuba_query_id")
                result[detector]["event_types"] = sorted(
                    event_types_by_snuba_query[sq_id] if sq_id is not None else []
                )

        return result

    def serialize(self, obj: Detector, attrs, user, **kwargs) -> AlertRuleSerializerResponse:
        triggers = attrs.get("triggers", [])
        alert_rule_id = None

        if triggers:
            alert_rule_id = triggers[0].get("alertRuleId")
        else:
            alert_rule_id = attrs.get("alert_rule_id") or get_fake_id_from_object_id(obj.id)

        comparison_delta = obj.config.get("comparison_delta")

        data: AlertRuleSerializerResponse = {
            "id": str(alert_rule_id),
            "name": obj.name,
            "organizationId": str(obj.project.organization_id),
            "status": AlertRuleStatus.PENDING.value,
            "queryType": attrs.get("queryType"),
            "dataset": attrs.get("dataset"),
            "query": attrs.get("query"),
            "aggregate": attrs.get("aggregate"),
            "thresholdType": attrs.get("thresholdType"),
            "resolveThreshold": triggers[0].get("resolveThreshold") if triggers else None,
            "timeWindow": attrs.get("timeWindow"),
            "environment": attrs.get("environment"),
            "resolution": attrs.get("resolution"),
            "thresholdPeriod": 1,  # unset on detectors
            "triggers": triggers,
            "projects": sorted(attrs.get("projects", [])),
            "owner": attrs.get("owner", None),
            "originalAlertRuleId": attrs.get("originalAlertRuleId", None),
            "comparisonDelta": comparison_delta / 60 if comparison_delta else None,
            "dateModified": obj.date_updated,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "description": obj.description if obj.description else "",
            "sensitivity": attrs.get("sensitivity"),
            "seasonality": attrs.get("seasonality"),
            "detectionType": obj.config.get("detection_type"),
        }

        if not obj.enabled:
            data["snooze"] = True

        if "latestIncident" in self.expand:
            data["latestIncident"] = attrs.get("latestIncident", None)

        extrapolation_mode = attrs.get("extrapolationMode")
        if extrapolation_mode is not None:
            data["extrapolationMode"] = extrapolation_mode

        # Only include eventTypes when explicitly requested (e.g., in detail views)
        # to match DetailedAlertRuleSerializer behavior
        if "eventTypes" in self.expand:
            data["eventTypes"] = attrs.get("event_types", [])

        return data


class DetailedWorkflowEngineDetectorSerializer(Serializer):
    """
    Detailed serializer for detector detail endpoints.
    Always includes eventTypes and snooze fields to match DetailedAlertRuleSerializer.

    Known differences from DetailedAlertRuleSerializer:
    - snooze/snoozeForEveryone: Derived from Detector.enabled instead of querying RuleSnooze
    - snoozeCreatedBy: Not included (RuleSnooze model tracks this, but workflow engine doesn't)
    - Detector.enabled=False is treated as snoozed for everyone
    """

    def __init__(self, expand: list[str] | None = None, prepare_component_fields: bool = False):
        # Force eventTypes to always be in expand for detail views
        expand = expand or []
        if "eventTypes" not in expand:
            expand = list(expand) + ["eventTypes"]
        self.base_serializer = WorkflowEngineDetectorSerializer(
            expand=expand, prepare_component_fields=prepare_component_fields
        )

    def get_attrs(
        self, item_list: Sequence[Detector], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[Detector, dict[str, Any]]:
        return self.base_serializer.get_attrs(item_list, user, **kwargs)

    def serialize(
        self, obj: Detector, attrs, user, **kwargs
    ) -> DetailedAlertRuleSerializerResponse:
        base_data = self.base_serializer.serialize(obj, attrs, user, **kwargs)
        data: DetailedAlertRuleSerializerResponse = {
            **base_data,
            "snooze": not obj.enabled,
        }
        if not obj.enabled:
            data["snoozeForEveryone"] = True
        return data
