from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, DefaultDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializer,
    IncidentSerializerResponse,
)
from sentry.incidents.models.incident import Incident
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import (
    Action,
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
    def __init__(self, expand=None):
        self.expand = expand or []

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
        incident = Incident.objects.get(
            id=IncidentGroupOpenPeriod.objects.get(group_open_period=obj).incident_id
        )
        return serialize(incident, user=user, serializer=IncidentSerializer(expand=self.expand))


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
