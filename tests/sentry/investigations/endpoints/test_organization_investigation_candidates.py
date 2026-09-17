from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationRun,
    InvestigationSourceType,
)
from sentry.investigations.services import investigation_legacy_source_key
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationCandidatesTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.candidates_url = reverse(
            "sentry-api-0-organization-investigation-candidates",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def create_metric_open_period(
        self,
        *,
        detection_type: AlertRuleDetectionType = AlertRuleDetectionType.STATIC,
        condition_type: str = Condition.GREATER,
        condition_comparison: Any = 100,
        comparison_delta: int | None = None,
    ) -> tuple[Any, GroupOpenPeriod]:
        group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            message="Checkout error spike",
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
            type=condition_type,
            comparison=condition_comparison,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        if condition_type != Condition.ANOMALY_DETECTION:
            resolve_condition_type = (
                Condition.LESS_OR_EQUAL
                if condition_type in {Condition.GREATER, Condition.GREATER_OR_EQUAL}
                else Condition.GREATER_OR_EQUAL
            )
            self.create_data_condition(
                condition_group=condition_group,
                type=resolve_condition_type,
                comparison=condition_comparison,
                condition_result=DetectorPriorityLevel.OK,
            )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={
                "detection_type": detection_type.value,
                "comparison_delta": comparison_delta,
            },
            workflow_condition_group=condition_group,
            name="Checkout errors",
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        self.create_detector_group(detector=detector, group=group)
        return group, open_period

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_candidate_launches_the_exact_open_period(self, schedule_auto_run: mock.Mock) -> None:
        group, open_period = self.create_metric_open_period()
        ended_at = timezone.now() - timedelta(hours=1)
        open_period.update(
            date_started=ended_at - timedelta(hours=2),
            date_ended=ended_at,
        )
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        candidate_payload = {
            "templateKey": "breached_metric",
            "templateVersion": 1,
            "sources": [source],
        }

        response = self.client.post(self.candidates_url, candidate_payload, format="json")
        assert response.status_code == 200
        assert response.data == {"items": [{"status": "investigate"}]}

        launch_payload = {
            "templateKey": "breached_metric",
            "templateVersion": 1,
            "source": source,
        }
        launched = self.client.post(self.collection_url, launch_payload, format="json")
        assert launched.status_code == 201, launched.data
        assert launched.data["source"]["ref"] == source["ref"]
        assert launched.data["source"]["snapshot"]["analysisWindow"]["end"] == ended_at.isoformat()
        assert launched.data["source"]["snapshot"]["monitor"]["detectionType"] == "static"
        assert launched.data["filters"] == {}
        investigation = Investigation.objects.get(id=launched.data["id"])
        assert investigation.source_type == InvestigationSourceType.BREACHED_METRIC
        assert investigation.source_ref == source["ref"]
        assert investigation.source_key is not None
        assert investigation.filters["breachedMetric"] == launched.data["source"]["snapshot"]

        duplicate = self.client.post(self.collection_url, launch_payload, format="json")
        assert duplicate.status_code == 200
        assert duplicate.data["id"] == launched.data["id"]
        assert Investigation.objects.count() == 1
        assert schedule_auto_run.call_count == 2

        response = self.client.post(self.candidates_url, candidate_payload, format="json")
        assert response.data == {
            "items": [{"status": "view", "investigationId": launched.data["id"]}]
        }

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_metric_open_period_launches_agentic_and_candidates_report_its_run(
        self, schedule_auto_run: mock.Mock
    ) -> None:
        group, open_period = self.create_metric_open_period()
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        template_investigation = self.client.post(
            self.collection_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": source,
            },
            format="json",
        )
        assert template_investigation.status_code == 201, template_investigation.data

        launched = self.client.post(
            self.collection_url,
            {"source": source},
            format="json",
        )

        assert launched.status_code == 201, launched.data
        assert launched.data["id"] != template_investigation.data["id"]
        assert launched.data["template"] is None
        assert launched.data["source"]["ref"] == source["ref"]
        assert launched.data["orchestration"] == {
            "phase": "broad_scan",
            "status": "pending",
            "heartbeatAt": None,
            "notebookRevision": 0,
        }
        investigation = Investigation.objects.get(id=launched.data["id"])
        assert investigation.source_type == InvestigationSourceType.METRIC_OPEN_PERIOD
        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)
        assert run.source["type"] == "breached_metric"
        assert run.source["projectIds"] == [self.project.id]
        assert run.source["monitor"] == investigation.source["snapshot"]["monitor"]
        assert run.source["analysisWindow"] == investigation.source["snapshot"]["analysisWindow"]
        assert run.source["metricQuery"] == investigation.source["snapshot"]["monitor"]["query"]
        assert run.source["seed"]["sentrySource"] == investigation.source

        candidate = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )

        assert candidate.status_code == 200, candidate.data
        assert candidate.data == {
            "items": [
                {
                    "status": "view",
                    "investigationId": launched.data["id"],
                    "orchestration": launched.data["orchestration"],
                }
            ]
        }

        duplicate = self.client.post(self.collection_url, {"source": source}, format="json")
        assert duplicate.status_code == 200, duplicate.data
        assert duplicate.data["id"] == launched.data["id"]
        schedule_auto_run.assert_called_once()

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_percent_detector_is_available(self, schedule_auto_run: mock.Mock) -> None:
        group, open_period = self.create_metric_open_period(
            detection_type=AlertRuleDetectionType.PERCENT,
            condition_comparison=150,
            comparison_delta=86_400,
        )
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        candidate = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {"items": [{"status": "investigate"}]}

        launched = self.client.post(
            self.collection_url,
            {"templateKey": "breached_metric", "templateVersion": 1, "source": source},
            format="json",
        )
        assert launched.status_code == 201
        monitor = launched.data["source"]["snapshot"]["monitor"]
        assert monitor["detectionType"] == "percent"
        assert monitor["comparisonDeltaSeconds"] == 86_400
        assert monitor["direction"] == "above"
        assert monitor["conditions"] == [
            {
                "type": Condition.GREATER,
                "comparison": 150,
                "result": DetectorPriorityLevel.HIGH,
                "thresholdChangePercent": 50.0,
            },
            {
                "type": Condition.LESS_OR_EQUAL,
                "comparison": 150,
                "result": DetectorPriorityLevel.OK,
                "thresholdChangePercent": 50.0,
            },
        ]
        schedule_auto_run.assert_called_once()

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_below_percent_detector_snapshot(self, schedule_auto_run: mock.Mock) -> None:
        group, open_period = self.create_metric_open_period(
            detection_type=AlertRuleDetectionType.PERCENT,
            condition_type=Condition.LESS,
            condition_comparison=60,
            comparison_delta=86_400,
        )
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        launched = self.client.post(
            self.collection_url,
            {"templateKey": "breached_metric", "templateVersion": 1, "source": source},
            format="json",
        )

        assert launched.status_code == 201
        monitor = launched.data["source"]["snapshot"]["monitor"]
        assert monitor["detectionType"] == "percent"
        assert monitor["direction"] == "below"
        assert monitor["conditions"] == [
            {
                "type": Condition.LESS,
                "comparison": 60,
                "result": DetectorPriorityLevel.HIGH,
                "thresholdChangePercent": 40.0,
            },
            {
                "type": Condition.GREATER_OR_EQUAL,
                "comparison": 60,
                "result": DetectorPriorityLevel.OK,
                "thresholdChangePercent": 40.0,
            },
        ]
        schedule_auto_run.assert_called_once()

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_migrated_percent_detector_snapshot(self, schedule_auto_run: mock.Mock) -> None:
        group, open_period = self.create_metric_open_period(
            detection_type=AlertRuleDetectionType.STATIC,
            condition_comparison=150,
            comparison_delta=86_400,
        )
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        launched = self.client.post(
            self.collection_url,
            {"templateKey": "breached_metric", "templateVersion": 1, "source": source},
            format="json",
        )

        assert launched.status_code == 201
        monitor = launched.data["source"]["snapshot"]["monitor"]
        assert monitor["detectionType"] == "percent"
        assert monitor["comparisonDeltaSeconds"] == 86_400
        assert all(
            condition["thresholdChangePercent"] == 50.0 for condition in monitor["conditions"]
        )
        schedule_auto_run.assert_called_once()

    @mock.patch(
        "sentry.investigations.endpoints.organization_investigation_index.schedule_eligible_auto_run_blocks"
    )
    def test_dynamic_detector_is_available(self, schedule_auto_run: mock.Mock) -> None:
        comparison = {
            "sensitivity": AnomalyDetectionSensitivity.HIGH,
            "seasonality": AnomalyDetectionSeasonality.AUTO,
            "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
        }
        group, open_period = self.create_metric_open_period(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            condition_type=Condition.ANOMALY_DETECTION,
            condition_comparison=comparison,
        )
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        candidate = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {"items": [{"status": "investigate"}]}

        launched = self.client.post(
            self.collection_url,
            {"templateKey": "breached_metric", "templateVersion": 1, "source": source},
            format="json",
        )
        assert launched.status_code == 201
        monitor = launched.data["source"]["snapshot"]["monitor"]
        assert monitor["detectionType"] == "dynamic"
        assert monitor["comparisonDeltaSeconds"] is None
        assert monitor["direction"] == "both"
        assert monitor["conditions"] == [
            {
                "type": Condition.ANOMALY_DETECTION,
                "comparison": comparison,
                "result": DetectorPriorityLevel.HIGH,
            }
        ]
        schedule_auto_run.assert_called_once()

    def test_inaccessible_source_is_unavailable(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        group = self.create_group(project=other_project, type=MetricIssue.type_id)
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        response = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data == {"items": [{"status": "unavailable"}]}

        response = self.client.post(
            self.collection_url,
            {"templateKey": "breached_metric", "templateVersion": 1, "source": source},
            format="json",
        )
        assert response.status_code == 404

    def test_legacy_only_investigation_is_viewable_and_reused(self) -> None:
        group, open_period = self.create_metric_open_period()
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        snapshot = {"monitor": {"name": "Checkout errors"}}
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            template_key="breached_metric",
            template_version=1,
            source_type=InvestigationSourceType.BREACHED_METRIC,
            source_ref=source["ref"],
            source_key=investigation_legacy_source_key(source),
            source_revision=1,
            filters={"breachedMetric": snapshot},
        )

        candidate = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {
            "items": [{"status": "view", "investigationId": str(investigation.id)}]
        }

        details = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": investigation.id,
                },
            )
        )
        assert details.status_code == 200
        assert details.data["source"] == {
            "type": "metric_open_period",
            "ref": source["ref"],
            "revision": 1,
            "snapshot": snapshot,
        }
        assert details.data["filters"] == {}

        with mock.patch(
            "sentry.investigations.endpoints.organization_investigation_index."
            "schedule_eligible_auto_run_blocks"
        ):
            launched = self.client.post(
                self.collection_url,
                {
                    "templateKey": "breached_metric",
                    "templateVersion": 1,
                    "source": source,
                },
                format="json",
            )
        assert launched.status_code == 200
        assert launched.data["id"] == str(investigation.id)
        assert Investigation.objects.count() == 1

    def test_launch_and_candidate_require_access_to_the_existing_investigation(self) -> None:
        group, open_period = self.create_metric_open_period()
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        launch_payload = {
            "templateKey": "breached_metric",
            "templateVersion": 1,
            "source": source,
        }
        with mock.patch(
            "sentry.investigations.endpoints.organization_investigation_index."
            "schedule_eligible_auto_run_blocks"
        ):
            launched = self.client.post(self.collection_url, launch_payload, format="json")
        assert launched.status_code == 201
        investigation = Investigation.objects.get(id=launched.data["id"])
        restricted_team = self.create_team(organization=self.organization)
        restricted_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        self.create_investigation_project(investigation=investigation, project=restricted_project)
        viewer = self.create_user()
        self.create_member(
            organization=self.organization, user=viewer, role="member", teams=[self.team]
        )
        self.login_as(viewer)

        with mock.patch(
            "sentry.investigations.endpoints.organization_investigation_index."
            "schedule_eligible_auto_run_blocks"
        ) as schedule_auto_run:
            duplicate = self.client.post(self.collection_url, launch_payload, format="json")
        assert duplicate.status_code == 403
        schedule_auto_run.assert_not_called()

        candidate = self.client.post(
            self.candidates_url,
            {
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sources": [source],
            },
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {"items": [{"status": "unavailable"}]}

    def test_launch_rolls_back_when_auto_run_scheduling_fails(self) -> None:
        group, open_period = self.create_metric_open_period()
        before = Investigation.objects.count()
        payload = {
            "templateKey": "breached_metric",
            "templateVersion": 1,
            "source": {
                "type": "metric_open_period",
                "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
            },
        }

        with mock.patch(
            "sentry.investigations.endpoints.organization_investigation_index."
            "schedule_eligible_auto_run_blocks",
            side_effect=RuntimeError("scheduling failed"),
        ):
            response = self.client.post(self.collection_url, payload, format="json")

        assert response.status_code == 500
        assert Investigation.objects.count() == before
