from collections.abc import Mapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializerResponse,
)
from sentry.incidents.endpoints.serializers.utils import get_object_id_from_fake_id
from sentry.incidents.models.incident import IncidentStatusMethod, IncidentType
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import DataSourceDetector, Detector, IncidentGroupOpenPeriod


class WorkflowEngineIncidentSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_open_periods_to_detectors(
        self, open_periods: Sequence[GroupOpenPeriod]
    ) -> dict[GroupOpenPeriod, Detector]:
        open_periods_to_detectors = {}

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
            incident_id = get_object_id_from_fake_id(obj.id)
            incident_identifier = incident_id

        # TODO: get event time using offset
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
