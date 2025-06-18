from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar, DefaultDict, cast

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializerResponse,
)
from sentry.incidents.models.incident import (
    IncidentActivityType,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentType,
)
from sentry.models.activity import Activity
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    DataCondition,
    DataConditionGroupAction,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
    IncidentGroupOpenPeriod,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.workflow_action_group_status import WorkflowActionGroupStatus


class WorkflowEngineIncidentSerializer(Serializer):
    priority_to_incident_status: ClassVar[dict[int, int]] = {
        PriorityLevel.HIGH.value: IncidentStatus.CRITICAL.value,
        PriorityLevel.MEDIUM.value: IncidentStatus.WARNING.value,
        PriorityLevel.LOW.value: IncidentStatus.OPEN.value,
    }

    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(
        self,
        item_list: Sequence[GroupOpenPeriod],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> defaultdict[GroupOpenPeriod, dict[str, Any]]:

        from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
            WorkflowEngineDetectorSerializer,
        )

        results: DefaultDict[GroupOpenPeriod, dict[str, Any]] = defaultdict()
        open_periods_to_detectors = self.get_open_periods_to_detectors(item_list)
        alert_rules = {
            d["id"]: d
            for d in serialize(
                list(open_periods_to_detectors.values()),
                user,
                WorkflowEngineDetectorSerializer(expand=self.expand),
            )
        }
        alert_rule_detectors = AlertRuleDetector.objects.filter(
            detector__in=list(open_periods_to_detectors.values())
        )
        open_periods_to_alert_rules: DefaultDict[GroupOpenPeriod, int] = defaultdict()
        for open_period, detector in open_periods_to_detectors.items():
            for ard in alert_rule_detectors:
                if ard.detector == detector:
                    open_periods_to_alert_rules[open_period] = ard.alert_rule_id

        for open_period in item_list:
            results[open_period] = {"projects": [open_period.project.slug]}
            results[open_period]["alert_rule"] = alert_rules.get(
                str(open_periods_to_alert_rules.get(open_period))
            )

        if "activities" in self.expand:
            for open_period in item_list:
                results[open_period]["activities"] = self.get_open_period_activities(open_period)

        return results

    def get_incident_status(self, priority: int | None, date_ended: datetime | None) -> int:
        if priority is None:
            raise ValueError("Priority is required to get an incident status")

        if date_ended:
            return IncidentStatus.CLOSED.value

        return self.priority_to_incident_status[priority]

    def get_open_period_activities(self, open_period: GroupOpenPeriod) -> list[dict[str, Any]]:
        # XXX: an incident will be 1:1 with open periods, but there can be multiple open periods per metric issue
        # XXX: this won't actually work until we start writing to the table for metric issues (or are we planning a backfill?)

        open_period_activities = []
        incident_activity_id = "-1"  # temp until we add lookup table
        incident_group_open_period = IncidentGroupOpenPeriod.objects.get(
            group_open_period=open_period
        )
        incident_identifier = str(incident_group_open_period.incident_identifier)

        # if we are here we have both IncidentActivityType.CREATED and IncidentActivityType.DETECTED
        created = {
            "id": incident_activity_id,
            "incidentIdentifier": incident_identifier,
            "type": IncidentActivityType.CREATED,
            "value": None,
            "previousValue": None,
            "user": None,
            "comment": None,
            "dateCreated": open_period.date_started,
        }
        detected = created.copy()
        detected["type"] = IncidentActivityType.DETECTED
        open_period_activities.append(created)
        open_period_activities.append(detected)

        # look up Activity rows for other status changes (warning, critical, and resolved)
        activity_status_to_incident_status: dict[str, Any] = {
            "high": IncidentStatus.CRITICAL,
            "medium": IncidentStatus.WARNING,
        }
        status_change_activities = Activity.objects.filter(
            group=open_period.group,
            type__in=[ActivityType.SET_PRIORITY.value, ActivityType.SET_RESOLVED.value],
        ).order_by("datetime")

        previous_activity: Activity | None = None
        previous_priority: str | None = None

        for activity in status_change_activities:
            current_activity = activity
            current_priority = cast(str, current_activity.data.get("priority"))

            if previous_activity:
                previous_priority = previous_activity.data.get("priority")

            if current_activity.type == ActivityType.SET_PRIORITY.value:
                status_change = {
                    "id": incident_activity_id,
                    "incidentIdentifier": incident_identifier,
                    "type": IncidentActivityType.STATUS_CHANGE,
                    "value": activity_status_to_incident_status.get(current_priority),
                    "previousValue": (
                        activity_status_to_incident_status.get(previous_priority)
                        if previous_priority
                        else None
                    ),
                    "user": None,
                    "comment": None,
                    "dateCreated": open_period.date_started,
                }
                open_period_activities.append(status_change)

            elif (
                current_activity.type == ActivityType.SET_RESOLVED.value
                and open_period.resolution_activity
            ):
                resolved = {
                    "id": incident_activity_id,
                    "incidentIdentifier": incident_identifier,
                    "type": IncidentActivityType.STATUS_CHANGE,
                    "value": IncidentStatus.CLOSED,
                    "previousValue": (
                        activity_status_to_incident_status.get(previous_priority)
                        if previous_priority
                        else None
                    ),
                    "user": open_period.user_id,
                    "comment": None,
                    "dateCreated": open_period.date_started,
                }
                open_period_activities.append(resolved)

            previous_activity = current_activity

        return open_period_activities

    def get_open_periods_to_detectors(
        self, open_periods: Sequence[GroupOpenPeriod]
    ) -> dict[GroupOpenPeriod, Detector]:
        wf_action_group_statuses = WorkflowActionGroupStatus.objects.filter(
            group__in=[open_period.group for open_period in open_periods]
        )
        open_periods_to_actions: DefaultDict[GroupOpenPeriod, Action] = defaultdict()
        for open_period in open_periods:
            for wf_action_group_status in wf_action_group_statuses:
                if wf_action_group_status.group == open_period.group:
                    open_periods_to_actions[open_period] = wf_action_group_status.action
                    break

        dcgas = DataConditionGroupAction.objects.filter(
            action__in=list(open_periods_to_actions.values())
        )
        open_periods_to_condition_group: DefaultDict[GroupOpenPeriod, DataConditionGroupAction] = (
            defaultdict()
        )
        for open_period, action in open_periods_to_actions.items():
            for dcga in dcgas:
                if dcga.action == action:
                    open_periods_to_condition_group[open_period] = dcga
                    break

        action_filters = DataCondition.objects.filter(
            condition_group__in=[dcga.condition_group for dcga in dcgas]
        )
        open_period_to_action_filters: DefaultDict[GroupOpenPeriod, DataCondition] = defaultdict()
        for open_period, dcga in open_periods_to_condition_group.items():
            for action_filter in action_filters:
                if action_filter.condition_group == dcga.condition_group:
                    open_period_to_action_filters[open_period] = action_filter
                    break

        workflow_dcgs = WorkflowDataConditionGroup.objects.filter(
            condition_group__in=Subquery(action_filters.values("condition_group"))
        )

        open_periods_to_workflow_dcgs: DefaultDict[GroupOpenPeriod, WorkflowDataConditionGroup] = (
            defaultdict()
        )
        for open_period, action_filter in open_period_to_action_filters.items():
            for workflow_dcg in workflow_dcgs:
                if workflow_dcg.condition_group == action_filter.condition_group:
                    open_periods_to_workflow_dcgs[open_period] = workflow_dcg

        detector_workflows = DetectorWorkflow.objects.filter(
            workflow__in=Subquery(workflow_dcgs.values("workflow"))
        )
        open_periods_to_detectors: DefaultDict[GroupOpenPeriod, Detector] = defaultdict()
        for open_period, workflow_dcg in open_periods_to_workflow_dcgs.items():
            for detector_workflow in detector_workflows:
                if detector_workflow.workflow == workflow_dcg.workflow:
                    open_periods_to_detectors[open_period] = detector_workflow.detector
                    break

        return open_periods_to_detectors

    def serialize(
        self,
        obj: GroupOpenPeriod,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs,
    ) -> IncidentSerializerResponse:
        """
        Temporary serializer to take a GroupOpenPeriod and serialize it for the old incident endpoint
        """
        incident_group_open_period = IncidentGroupOpenPeriod.objects.get(group_open_period=obj)
        date_closed = obj.date_ended.replace(second=0, microsecond=0) if obj.date_ended else None
        return {
            "id": str(incident_group_open_period.incident_id),
            "identifier": str(incident_group_open_period.incident_identifier),
            "organizationId": str(obj.project.organization.id),
            "projects": attrs["projects"],
            "alertRule": attrs["alert_rule"],
            "activities": attrs["activities"] if "activities" in self.expand else None,
            "status": self.get_incident_status(obj.group.priority, obj.date_ended),
            "statusMethod": (
                IncidentStatusMethod.RULE_TRIGGERED.value
                if not date_closed
                else IncidentStatusMethod.RULE_UPDATED.value
            ),
            "type": IncidentType.ALERT_TRIGGERED.value,  # IncidentType.Detected isn't used anymore
            "title": obj.group.title,
            "dateStarted": obj.date_started,
            "dateDetected": obj.date_started,  # In workflow engine, date_started is the date the incident was detected
            "dateCreated": obj.date_added,
            "dateClosed": date_closed,
        }


class WorkflowEngineDetailedIncidentSerializer(WorkflowEngineIncidentSerializer):
    def __init__(self, expand=None):
        if expand is None:
            expand = []
        super().__init__(expand=expand)

    def serialize(self, obj, attrs, user, **kwargs) -> DetailedIncidentSerializerResponse:
        base_context = super().serialize(obj, attrs, user)
        # The query we should use to get accurate results in Discover.
        return DetailedIncidentSerializerResponse(
            **base_context, discoverQuery=self._build_discover_query(obj)
        )

    def _build_discover_query(self, open_period: GroupOpenPeriod) -> str:
        detector = self.get_open_periods_to_detectors([open_period])[open_period]
        try:
            data_source_detector = DataSourceDetector.objects.get(detector=detector)
        except DataSourceDetector.DoesNotExist:
            return ""

        try:
            query_subscription = QuerySubscription.objects.get(
                id=data_source_detector.detector.data_sources.all()[0].source_id
            )
        except QuerySubscription.DoesNotExist:
            return ""

        try:
            snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        except SnubaQuery.DoesNotExist:
            return ""

        return apply_dataset_query_conditions(
            SnubaQuery.Type(snuba_query.type),
            snuba_query.query,
            snuba_query.event_types,
            discover=True,
        )
