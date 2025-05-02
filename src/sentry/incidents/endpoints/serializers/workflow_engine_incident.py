from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer
from sentry.api.serializers.models.incidentactivity import IncidentActivitySerializerResponse
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializerResponse,
)
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import (
    ActionGroupStatus,
    DataCondition,
    DataConditionGroupAction,
    DataSourceDetector,
    DetectorWorkflow,
    WorkflowDataConditionGroup,
)


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
    ) -> defaultdict[GroupOpenPeriod, dict[str, list[str]]]:
        # TODO: improve typing here
        results: dict[GroupOpenPeriod, dict[str, Any]] = {}
        for open_period in item_list:
            results[open_period] = {
                "alert_rule": self.get_alert_rule(open_period),
            }

        if "activities" in self.expand:
            for open_period in item_list:
                results[open_period]["activities"] = self.get_open_period_activities(open_period)

        return results

    def get_incident_status(self, priority: int | None) -> int:
        if priority is None:
            raise ValueError("Priority is required to get an incident status")
        return self.priority_to_incident_status[priority]

    def get_open_period_activities(
        self, open_period: GroupOpenPeriod
    ) -> list[IncidentActivitySerializerResponse]:
        # a metric issue will only have one openperiod because if it's reopened it'll make a new metric issue
        # this won't actually work until we start writing to the table for metric issues (or are we planning a backfill? I can't remember)
        return [
            {
                "id": "-1",  # how important is returning the IncidentActivity id? would need to add to join table
                "incidentIdentifier": "-1",  # also dont have this info, need to add to IncidentGroupOpenPeriod
                "type": 1,  # detected, created (both made at the same time), status change (move to warning, critical, or resolved)
                # groupopenperiod has resolution_activity set if it's resolved
                # if that's not set it's open and we'd read the warning/crit from the group priority Activity row
                # maybe just dupe it since detected and created are the exact same data except for the IncidentActivity id
                "value": "test",  # value is IncidentStatus but is only set when type = IncidentActivityType.STATUS_CHANGE
                # should be able to get from Activity
                # class IncidentStatus(Enum):
                #     OPEN = 1
                #     CLOSED = 2
                #     WARNING = 10
                #     CRITICAL = 20
                "previousValue": "test",  # also IncidentStatus, should be able to get via Activity
                "user": None,  # we have data in this column from 2020-03-04 - 2021-06-01 only, otherwise it's empty
                "comment": None,  # not supported now, same timeline as user
                "dateCreated": open_period.date_started,
            }
        ]

    def get_alert_rule(self, open_period: GroupOpenPeriod) -> AlertRuleSerializerResponse:
        # TODO: Implement this
        return {
            "id": "-1",
            "name": "Test Alert Rule",
            "organizationId": "-1",
            "status": 1,
            "query": "test",
            "aggregate": "test",
            "timeWindow": 1,
            "resolution": 1,
            "thresholdPeriod": 1,
            "triggers": [
                {
                    "id": "-1",
                    "status": 1,
                    "dateModified": datetime.now(),
                    "dateCreated": datetime.now(),
                }
            ],
            "dateModified": datetime.now(),
            "dateCreated": datetime.now(),
            "createdBy": {},
            "description": "test",
            "detectionType": "test",
        }

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

        date_closed = obj.date_ended.replace(second=0, microsecond=0) if obj.date_ended else None
        return {
            "id": str(obj.id),
            "identifier": str(
                obj.id
            ),  # TODO this isn't the same thing, it's Incident.identifier which we might want to add to IncidentGroupOpenPeriod
            "organizationId": str(obj.project.organization.id),
            "projects": [obj.project.slug],
            "alertRule": attrs["alert_rule"],
            "activities": attrs["activities"] if "activities" in self.expand else None,
            "status": self.get_incident_status(obj.group.priority),
            "statusMethod": IncidentStatusMethod.RULE_TRIGGERED.value,  # We don't allow manual updates or status updates based on detector config updates
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
        if "original_alert_rule" not in expand:
            expand.append("original_alert_rule")
        super().__init__(expand=expand)

    def serialize(self, obj, attrs, user, **kwargs) -> DetailedIncidentSerializerResponse:
        base_context = super().serialize(obj, attrs, user)
        # The query we should use to get accurate results in Discover.
        context = DetailedIncidentSerializerResponse(
            **base_context, discoverQuery=self._build_discover_query(obj)
        )

        return context

    def _build_discover_query(self, open_period: GroupOpenPeriod) -> str:
        try:
            action_group_status = ActionGroupStatus.objects.get(group=open_period.group)
        except ActionGroupStatus.DoesNotExist:
            return ""

        condition_groups = Subquery(
            DataConditionGroupAction.filter(action=action_group_status.action).values(
                "condition_group"
            )
        )
        action_filters = DataCondition.objects.filter(condition_group__in=condition_groups)

        try:
            detector = DetectorWorkflow.objects.get(
                workflow__in=Subquery(
                    WorkflowDataConditionGroup.objects.filter(
                        condition_group__in=Subquery(action_filters.values("condition_group"))
                    ).values("workflow")
                )
            ).values("detector")
        except DetectorWorkflow.DoesNotExist:
            return ""

        try:
            data_source_detector = DataSourceDetector.objects.get(detector=detector)
        except DataSourceDetector.DoesNotExist:
            return ""

        try:
            query_subscription = QuerySubscription.objects.get(
                id=data_source_detector.detector.data_source.source_id
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
