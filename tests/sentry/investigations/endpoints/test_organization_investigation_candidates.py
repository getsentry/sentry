from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import Investigation, InvestigationSourceType
from sentry.investigations.services import investigation_legacy_source_key
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition

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

    def create_metric_open_period(self) -> tuple[Any, GroupOpenPeriod]:
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
            type=Condition.GREATER,
            comparison=100,
            condition_result=2,
        )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
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
