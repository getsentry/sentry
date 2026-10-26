from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import Investigation, InvestigationOrchestrationRun
from sentry.investigations.services.investigations import resolve_investigation_source
from sentry.investigations.services.orchestration import (
    create_agentic_breached_metric_investigation,
    create_agentic_manual_investigation,
    rebuild_orchestration_source,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class RebuildOrchestrationSourceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        ended_at = timezone.now() - timedelta(hours=1)
        open_period.update(date_started=ended_at - timedelta(hours=2), date_ended=ended_at)
        self.snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="level:error",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=None,
        )
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=self.snuba_query
        )
        condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": "static"},
            workflow_condition_group=condition_group,
        )
        self.create_data_source_detector(
            data_source=self.create_data_source(
                organization=self.organization,
                source_id=str(subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            ),
            detector=self.detector,
        )
        self.create_detector_group(detector=self.detector, group=group)
        self.investigation, _ = create_agentic_breached_metric_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            resolved_source=resolve_investigation_source(
                organization=self.organization,
                source={
                    "type": "metric_open_period",
                    "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
                },
                accessible_project_ids={self.project.id},
            ),
            project_ids=[self.project.id],
            filters={},
        )

    def started_source(self, investigation: Investigation) -> dict[str, Any]:
        return InvestigationOrchestrationRun.objects.get(investigation=investigation).source

    def test_matches_the_source_the_run_started_with(self) -> None:
        assert rebuild_orchestration_source(self.investigation) == self.started_source(
            self.investigation
        )

    def test_reads_the_monitor_as_it_is_now(self) -> None:
        self.snuba_query.update(time_window=900)

        rebuilt = rebuild_orchestration_source(self.investigation)

        assert rebuilt is not None
        started = self.started_source(self.investigation)
        monitor = {**started["monitor"], "timeWindowSeconds": 900}
        assert rebuilt["monitor"] == monitor
        assert rebuilt["seed"]["sentrySource"]["snapshot"]["monitor"] == monitor
        unchanged = set(started) - {"monitor", "seed"}
        assert {key: rebuilt[key] for key in unchanged} == {key: started[key] for key in unchanged}

    def test_is_none_once_the_monitor_is_gone(self) -> None:
        Detector.objects.filter(id=self.detector.id).update(status=ObjectStatus.PENDING_DELETION)

        assert rebuild_orchestration_source(self.investigation) is None

    def test_a_manual_source_is_rebuilt_from_the_investigation(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[self.project.id],
            filters={},
        )

        assert rebuild_orchestration_source(investigation) == run.source
