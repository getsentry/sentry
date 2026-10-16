from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import Investigation, InvestigationSourceType
from sentry.investigations.triggers import InvestigationTriggerReferrer, trigger_investigation
from sentry.models.group import Group
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


@mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
class TriggerInvestigationTest(TestCase):
    def create_metric_group(self) -> tuple[Group, GroupOpenPeriod]:
        group = self.create_group(
            project=self.project, type=MetricIssue.type_id, message="Checkout error spike"
        )
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="is:unresolved",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=None,
        )
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=query
        )
        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": "static", "comparison_delta": None},
            workflow_condition_group=condition_group,
            name="Checkout errors",
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        self.create_detector_group(detector=detector, group=group)
        return group, open_period

    def test_metric_issue_investigates_the_open_period(self, dispatch: mock.Mock) -> None:
        group, open_period = self.create_metric_group()

        with self.capture_on_commit_callbacks(execute=True):
            result = trigger_investigation(
                group=group,
                user_id=self.user.id,
                referrer=InvestigationTriggerReferrer.ALERT_ACTION,
            )

        assert result is not None
        assert result.created is True
        investigation = result.investigation
        assert investigation.organization_id == self.organization.id
        assert investigation.created_by_id == self.user.id
        assert investigation.source_type == InvestigationSourceType.METRIC_OPEN_PERIOD
        assert investigation.source_ref == {
            "groupId": str(group.id),
            "openPeriodId": str(open_period.id),
        }
        assert list(investigation.projects.values_list("id", flat=True)) == [self.project.id]
        dispatch.assert_called_once()

    def test_metric_issue_reuses_the_active_investigation(self, dispatch: mock.Mock) -> None:
        group, _ = self.create_metric_group()
        first = trigger_investigation(
            group=group, user_id=self.user.id, referrer=InvestigationTriggerReferrer.ALERT_ACTION
        )
        second = trigger_investigation(
            group=group, user_id=self.user.id, referrer=InvestigationTriggerReferrer.ALERT_ACTION
        )

        assert first is not None and second is not None
        assert second.created is False
        assert second.investigation.id == first.investigation.id
        assert Investigation.objects.filter(organization=self.organization).count() == 1

    def test_metric_issue_with_closed_open_period_is_skipped(self, dispatch: mock.Mock) -> None:
        group, open_period = self.create_metric_group()
        open_period.update(date_ended=timezone.now())

        result = trigger_investigation(
            group=group, user_id=self.user.id, referrer=InvestigationTriggerReferrer.ALERT_ACTION
        )

        assert result is None
        assert not Investigation.objects.filter(organization=self.organization).exists()

    def test_metric_issue_without_a_resolvable_source_is_skipped(self, dispatch: mock.Mock) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        result = trigger_investigation(
            group=group, user_id=self.user.id, referrer=InvestigationTriggerReferrer.ALERT_ACTION
        )

        assert result is None
        assert not Investigation.objects.filter(organization=self.organization).exists()

    def test_issue_starts_a_seeded_investigation(self, dispatch: mock.Mock) -> None:
        group = self.create_group(project=self.project, message="Checkout failed")

        result = trigger_investigation(
            group=group,
            user_id=self.user.id,
            referrer=InvestigationTriggerReferrer.ALERT_ACTION,
            event_id="a" * 32,
        )

        assert result is not None
        assert result.created is True
        investigation = result.investigation
        assert investigation.source_type == InvestigationSourceType.MANUAL
        assert investigation.source["type"] == "manual"
        assert group.qualified_short_id in investigation.source["prompt"]
        assert investigation.source["seed"]["sentrySource"] == {
            "type": "issue",
            "groupId": group.id,
            "shortId": group.qualified_short_id,
            "projectId": self.project.id,
            "eventId": "a" * 32,
        }
        assert investigation.orchestration_run.status == "pending"
