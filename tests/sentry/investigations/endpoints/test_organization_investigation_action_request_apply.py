from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from django.urls import reverse

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.investigations.models import (
    InvestigationActionRequest,
)
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.workflow_engine.models import DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba, requires_kafka]

FEATURE = "organizations:investigations"


@with_feature({FEATURE: True, **METRIC_SUBSCRIPTION_FEATURE_FLAGS})
class OrganizationInvestigationActionRequestApplyTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.environment = self.create_environment(project=self.project, name="production")
        self.detector = self.create_metric_detector()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Breach"
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=4815,
                mirror_status=SeerRunMirrorStatus.LIVE,
            ),
            workflow_version=4,
            phase="completed",
            status="completed",
            source={"type": "breached_metric", "detectorId": str(self.detector.id)},
            projection={"workflowVersion": 4, "report": {"revision": 0, "status": "completed"}},
        )

    def create_metric_detector(
        self,
        *,
        dataset: Dataset = Dataset.Events,
        time_window: int = 300,
        high: float = 500.0,
        conditions: Sequence[tuple[Condition, float, int]] | None = None,
        config: dict[str, Any] | None = None,
    ) -> Detector:
        eap = dataset == Dataset.EventsAnalyticsPlatform
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.PERFORMANCE if eap else SnubaQuery.Type.ERROR,
                dataset=dataset,
                query="span.op:http.client" if eap else "level:error",
                aggregate="count(span.duration)" if eap else "count()",
                time_window=timedelta(seconds=time_window),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[
                    SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
                    if eap
                    else SnubaQueryEventType.EventType.ERROR
                ],
                extrapolation_mode=(ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED if eap else None),
            )
            subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )
        group = self.create_data_condition_group(
            organization_id=self.organization.id, logic_type=DataConditionGroup.Type.ANY
        )
        for condition_type, comparison, result in conditions or [
            (Condition.GREATER, high, DetectorPriorityLevel.HIGH),
            (Condition.LESS_OR_EQUAL, high, DetectorPriorityLevel.OK),
        ]:
            self.create_data_condition(
                condition_group=group,
                type=condition_type,
                comparison=comparison,
                condition_result=result,
            )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            workflow_condition_group=group,
            config=config or {"detection_type": "static"},
        )
        data_source = self.create_data_source(
            organization=self.organization, source_id=subscription.id
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        return detector

    def suggest(
        self,
        *,
        before: dict[str, Any] | None = None,
        changes: dict[str, Any] | None = None,
        detector_id: int | None = None,
        **values: Any,
    ) -> InvestigationActionRequest:
        values.setdefault("action_kind", "update_detector")
        values.setdefault(
            "action_payload",
            {
                "kind": "update_detector",
                "detectorId": str(detector_id or self.detector.id),
                "before": before or {"timeWindowSeconds": 300},
                "changes": changes or {"timeWindowSeconds": 900},
            },
        )
        return self.create_investigation_action_request(
            investigation=self.investigation, key="widen-window", **values
        )

    def details_request(self) -> dict[str, Any]:
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": self.investigation.id,
                },
            )
        )
        assert response.status_code == 200
        [action_request] = response.data["actionRequests"]
        return action_request

    def test_details_say_the_viewer_can_apply_a_change_to_the_monitor(self) -> None:
        self.suggest(
            before={"query": "level:error"}, changes={"query": "level:error !logger:health"}
        )

        serialized = self.details_request()

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)

    def test_a_dataset_the_plan_no_longer_allows_cannot_apply(self) -> None:
        self.detector = self.create_metric_detector(dataset=Dataset.EventsAnalyticsPlatform)
        self.orchestration_run.update(
            source={"type": "breached_metric", "detectorId": str(self.detector.id)}
        )
        self.suggest()

        with self.feature({"organizations:visibility-explore-view": False}):
            serialized = self.details_request()

        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (
            False,
            "detector_not_found",
        )
