from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import Investigation
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
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
        query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset=Dataset.Events.value,
            query="is:unresolved",
            aggregate="count()",
            time_window=300,
            resolution=60,
        )
        subscription = QuerySubscription.objects.create(
            project=self.project,
            snuba_query=query,
            type="incidents",
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
            "templateVersion": 2,
            "sources": [source],
        }

        response = self.client.post(self.candidates_url, candidate_payload, format="json")
        assert response.status_code == 200
        assert response.data == {"items": [{"status": "investigate"}]}

        launch_payload = {
            "templateKey": "breached_metric",
            "templateVersion": 2,
            "source": source,
        }
        launched = self.client.post(self.collection_url, launch_payload, format="json")
        assert launched.status_code == 201, launched.data
        assert launched.data["template"] == {"key": "breached_metric", "version": 2}
        assert launched.data["blocks"][0]["title"] == "Investigation summary"
        assert len(launched.data["blocks"][0]["dependencies"]) == 4
        assert launched.data["source"]["ref"] == source["ref"]
        assert launched.data["source"]["snapshot"]["analysisWindow"]["end"] == ended_at.isoformat()

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
