from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar, DefaultDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializerResponse,
)
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.endpoints.serializers.group_open_period_serializer import (
    GroupOpenPeriodActivitySerializer,
)
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    DataSourceDetector,
    Detector,
    DetectorGroup,
    IncidentGroupOpenPeriod,
)


class WorkflowEngineIncidentSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    priority_to_incident_status: ClassVar[dict[int, int]] = {
        PriorityLevel.HIGH.value: IncidentStatus.CRITICAL.value,
        PriorityLevel.MEDIUM.value: IncidentStatus.WARNING.value,
    }

    def get_incident_status(self, priority: int | None, date_ended: datetime | None) -> int:
        if priority is None:
            raise ValueError("Priority is required to get an incident status")

        if date_ended:
            return IncidentStatus.CLOSED.value

        return self.priority_to_incident_status[priority]

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
            alert_rule["id"]: alert_rule  # we are serializing detectors to look like alert rules
            for alert_rule in serialize(
                list(open_periods_to_detectors.values()),
                user,
                WorkflowEngineDetectorSerializer(expand=self.expand),
            )
        }
        alert_rule_detectors = AlertRuleDetector.objects.filter(
            detector__in=list(open_periods_to_detectors.values())
        ).values_list("alert_rule_id", "detector_id")
        detector_ids_to_alert_rule_ids = {}
        for alert_rule_id, detector_id in alert_rule_detectors:
            detector_ids_to_alert_rule_ids[detector_id] = alert_rule_id

        for open_period in item_list:
            detector_id = open_periods_to_detectors[open_period].id
            if detector_id in detector_ids_to_alert_rule_ids:
                alert_rule_id = detector_ids_to_alert_rule_ids[detector_id]
            else:
                alert_rule_id = get_fake_id_from_object_id(detector_id)

            results[open_period] = {"projects": [open_period.project.slug]}
            results[open_period]["alert_rule"] = alert_rules.get(str(alert_rule_id))

        if "activities" in self.expand:
            gopas = list(
                GroupOpenPeriodActivity.objects.filter(group_open_period__in=item_list)[:1000]
            )
            open_period_activities = defaultdict(list)
            # XXX: the incident endpoint is undocumented, so we aren' on the hook for supporting
            # any specific payloads. Since this isn't used on the Sentry side for notification charts,
            # I've opted to just use the GroupOpenPeriodActivity serializer.
            for gopa, serialized_activity in zip(
                gopas,
                serialize(gopas, user=user, serializer=GroupOpenPeriodActivitySerializer()),
            ):
                open_period_activities[gopa.group_open_period_id].append(serialized_activity)
            for open_period in item_list:
                results[open_period]["activities"] = open_period_activities[open_period.id]

        return results

    def get_open_periods_to_detectors(
        self, open_periods: Sequence[GroupOpenPeriod]
    ) -> dict[GroupOpenPeriod, Detector]:
        # open period -> group -> detector via detectorgroup
        groups = [op.group for op in open_periods]
        group_to_open_periods = defaultdict(list)

        for op in open_periods:
            group_to_open_periods[op.group].append(op)

        detector_groups = DetectorGroup.objects.filter(group__in=groups).select_related(
            "group", "detector"
        )

        groups_to_detectors = {}
        for dg in detector_groups:
            if dg.detector is not None:
                groups_to_detectors[dg.group] = dg.detector

        open_periods_to_detectors = {}
        for group in group_to_open_periods:
            for op in group_to_open_periods[group]:
                open_periods_to_detectors[op] = groups_to_detectors[group]

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
        try:
            igop = IncidentGroupOpenPeriod.objects.get(group_open_period=obj)
            incident_id = igop.incident_id
            incident_identifier = igop.incident_identifier
        except IncidentGroupOpenPeriod.DoesNotExist:
            incident_id = get_fake_id_from_object_id(obj.id)
            incident_identifier = incident_id

        date_closed = obj.date_ended.replace(second=0, microsecond=0) if obj.date_ended else None
        return {
            "id": str(incident_id),
            "identifier": str(incident_identifier),
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
            "type": IncidentType.ALERT_TRIGGERED.value,
            "title": obj.group.title,
            "dateStarted": obj.date_started,
            "dateDetected": obj.date_started,
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
