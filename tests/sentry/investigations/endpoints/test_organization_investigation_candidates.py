from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.urls import reverse
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.notebooks.models import Notebook, NotebookSourceType
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
            "sentry-api-0-organization-notebooks",
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

    def test_closed_membership_organizations_cannot_check_or_launch_candidates(self) -> None:
        group, open_period = self.create_metric_open_period()
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }

        candidate = self.client.post(
            self.candidates_url,
            {"sources": [source]},
            format="json",
        )
        assert candidate.status_code == 404

        launched = self.client.post(
            self.collection_url,
            {"source": source},
            format="json",
        )
        assert launched.status_code == 404
        assert not Notebook.objects.filter(organization=self.organization).exists()

    def test_candidate_launches_the_exact_open_period(self) -> None:
        group, open_period = self.create_metric_open_period()
        ended_at = timezone.now() - timedelta(hours=1)
        open_period.update(
            date_started=ended_at - timedelta(hours=2),
            date_ended=ended_at,
        )
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        candidate_payload = {"sources": [source]}

        response = self.client.post(self.candidates_url, candidate_payload, format="json")
        assert response.status_code == 200
        assert response.data == {"items": [{"status": "investigate"}]}

        launch_payload = {"source": source}
        launched = self.client.post(self.collection_url, launch_payload, format="json")
        assert launched.status_code == 201, launched.data
        assert launched.data["source"]["ref"] == source["ref"]
        assert launched.data["source"]["snapshot"]["analysisWindow"]["end"] == ended_at.isoformat()
        assert launched.data["source"]["snapshot"]["monitor"]["detectionType"] == "static"
        assert launched.data["filters"] == {}
        investigation = Notebook.objects.get(id=launched.data["id"])
        assert investigation.source_type == NotebookSourceType.METRIC_OPEN_PERIOD
        assert investigation.source_key == f"metric_open_period:{group.id}:{open_period.id}"
        assert investigation.filters == {}

        duplicate = self.client.post(self.collection_url, launch_payload, format="json")
        assert duplicate.status_code == 200
        assert duplicate.data["id"] == launched.data["id"]
        assert Notebook.objects.count() == 1

        response = self.client.post(self.candidates_url, candidate_payload, format="json")
        assert response.data == {
            "items": [
                {
                    "status": "view",
                    "investigationId": launched.data["id"],
                    "orchestration": launched.data["orchestration"],
                }
            ]
        }

    def test_metric_open_period_launches_agentic_and_candidates_report_its_run(self) -> None:
        group, open_period = self.create_metric_open_period()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        launched = self.client.post(
            self.collection_url,
            {"source": source},
            format="json",
        )

        assert launched.status_code == 201, launched.data
        assert launched.data["template"] is None
        assert launched.data["source"]["ref"] == source["ref"]
        assert launched.data["orchestration"] == {
            "phase": "broad_scan",
            "status": "pending",
            "heartbeatAt": None,
            "notebookRevision": 0,
        }
        investigation = Notebook.objects.get(id=launched.data["id"])
        assert investigation.source_type == NotebookSourceType.METRIC_OPEN_PERIOD
        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)
        assert run.source["type"] == "breached_metric"
        assert run.source["projectIds"] == [self.project.id]
        assert run.source["monitor"] == investigation.source["snapshot"]["monitor"]
        assert run.source["analysisWindow"] == investigation.source["snapshot"]["analysisWindow"]
        assert run.source["metricQuery"] == investigation.source["snapshot"]["monitor"]["query"]
        assert run.source["seed"]["sentrySource"] == investigation.source

        candidate = self.client.post(
            self.candidates_url,
            {"sources": [source]},
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

    def test_percent_detector_is_available(self) -> None:
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
            {"sources": [source]},
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {"items": [{"status": "investigate"}]}

        launched = self.client.post(
            self.collection_url,
            {"source": source},
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

    def test_below_percent_detector_snapshot(self) -> None:
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
            {"source": source},
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

    def test_migrated_percent_detector_snapshot(self) -> None:
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
            {"source": source},
            format="json",
        )

        assert launched.status_code == 201
        monitor = launched.data["source"]["snapshot"]["monitor"]
        assert monitor["detectionType"] == "percent"
        assert monitor["comparisonDeltaSeconds"] == 86_400
        assert all(
            condition["thresholdChangePercent"] == 50.0 for condition in monitor["conditions"]
        )

    def test_dynamic_detector_is_available(self) -> None:
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
            {"sources": [source]},
            format="json",
        )
        assert candidate.status_code == 200
        assert candidate.data == {"items": [{"status": "investigate"}]}

        launched = self.client.post(
            self.collection_url,
            {"source": source},
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
            {"sources": [source]},
            format="json",
        )
        assert response.status_code == 200
        assert response.data == {"items": [{"status": "unavailable"}]}

        response = self.client.post(
            self.collection_url,
            {"source": source},
            format="json",
        )
        assert response.status_code == 404

    def test_members_without_project_membership_can_reuse_existing_investigations(self) -> None:
        group, open_period = self.create_metric_open_period()
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": str(group.id), "openPeriodId": str(open_period.id)},
        }
        launch_payload = {"source": source}
        launched = self.client.post(self.collection_url, launch_payload, format="json")
        assert launched.status_code == 201
        investigation = Notebook.objects.get(id=launched.data["id"])
        restricted_team = self.create_team(organization=self.organization)
        restricted_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        self.create_notebook_project(notebook=investigation, project=restricted_project)
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member", teams=[])
        self.login_as(viewer)

        duplicate = self.client.post(self.collection_url, launch_payload, format="json")
        assert duplicate.status_code == 200
        assert duplicate.data["id"] == str(investigation.id)
        assert Notebook.objects.count() == 1

        candidate = self.client.post(
            self.candidates_url,
            {"sources": [source]},
            format="json",
        )
        assert candidate.status_code == 200
        [item] = candidate.data["items"]
        assert item["status"] == "view"
        assert item["investigationId"] == str(investigation.id)
