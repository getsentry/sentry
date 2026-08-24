from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import (
    Investigation,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationBreachedMetricInvestigationsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def create_breached_metric_source(self) -> tuple[Any, Any, Any, Any]:
        group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            message="Checkout error spike",
        )
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        open_period.update(date_started=timezone.now() - timedelta(days=7))
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
        return group, open_period, detector, query

    def test_launch_breached_metric_template(self) -> None:
        group, open_period, _, _ = self.create_breached_metric_source()
        unavailable_group = self.create_group(project=self.project)
        status_url = reverse(
            "sentry-api-0-organization-breached-metric-investigation-status",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        availability = self.client.post(
            status_url,
            data={"groupIds": [str(group.id), str(unavailable_group.id)]},
            format="json",
        )
        assert availability.status_code == 200
        assert availability.data["items"][str(group.id)] == {
            "status": "investigate",
            "openPeriodId": str(open_period.id),
        }
        assert availability.data["items"][str(unavailable_group.id)] == {"status": "unavailable"}
        launch_url = reverse(
            "sentry-api-0-organization-breached-metric-investigation-launch",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.post(
            launch_url,
            data={"groupId": str(group.id), "openPeriodId": str(open_period.id)},
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["template"] == {"key": "breached_metric", "version": 1}
        assert response.data["source"]["revision"] == 1
        assert response.data["projectIds"] == [self.project.id]
        assert [block["kind"] for block in response.data["blocks"]] == [
            "query",
            "text",
            "text",
            "query",
        ]
        blocks = response.data["blocks"]
        assert blocks[0]["dependencies"] == []
        assert blocks[1]["dependencies"] == []
        assert blocks[0]["title"] == "Breached metric"
        assert blocks[0]["display"]["defaultView"] == "chart"
        assert set(blocks[2]["dependencies"]) == {blocks[0]["id"], blocks[3]["id"]}
        assert blocks[3]["dependencies"] == []
        assert response.data["title"] == "Untitled investigation"
        assert response.data["parameters"] == []
        assert sum(block["outputStatus"] == "pending" for block in blocks) == 3
        assert blocks[2]["outputStatus"] == "notRun"
        assert InvestigationBlockExecution.objects.count() == 3

        second = self.client.post(
            launch_url,
            data={"groupId": str(group.id), "openPeriodId": str(open_period.id)},
            format="json",
        )
        assert second.status_code == 200
        assert second.data["id"] == response.data["id"]
        assert Investigation.objects.count() == 1

        investigation = Investigation.objects.get(id=response.data["id"])
        for block in investigation.blocks.filter(kind="query"):
            execution = block.current_execution
            assert execution is not None
            execution.update(
                status=InvestigationBlockExecutionStatus.COMPLETED,
                result={
                    "schemaVersion": 1,
                    "tableMarkdown": "| count |\n| ---: |\n| 1 |",
                    "chart": None,
                    "preferredView": "table",
                    "isEmpty": False,
                    "chartUnavailableReason": "No chart",
                    "queryLinks": [],
                },
            )
            block.result_execution = execution
            block.save(update_fields=["result_execution", "date_updated"])
        schedule_eligible_auto_run_blocks(investigation_id=investigation.id, user_id=self.user.id)
        synthesis = investigation.blocks.get(title="What explains the change")
        assert synthesis.current_execution is not None
        assert synthesis.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        assert InvestigationBlockExecution.objects.count() == 4

        investigation.status = "archived"
        investigation.save(update_fields=["status", "date_updated"])
        availability = self.client.post(
            status_url, data={"groupIds": [str(group.id)]}, format="json"
        )
        assert availability.data["items"][str(group.id)] == {
            "status": "investigate",
            "openPeriodId": str(open_period.id),
        }

        relaunched = self.client.post(
            launch_url,
            data={"groupId": str(group.id), "openPeriodId": str(open_period.id)},
            format="json",
        )
        assert relaunched.status_code == 201
        assert relaunched.data["id"] != response.data["id"]
        assert relaunched.data["source"]["revision"] == 2
        investigation.refresh_from_db()
        assert investigation.status == InvestigationStatus.ARCHIVED
        assert Investigation.objects.count() == 2
        fresh = Investigation.objects.get(id=relaunched.data["id"])
        assert fresh.status == InvestigationStatus.ACTIVE
        assert (
            fresh.blocks.filter(
                current_execution__status=InvestigationBlockExecutionStatus.PENDING
            ).count()
            == 3
        )

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )
        restore = self.client.put(
            detail_url,
            data={"investigationVersion": investigation.version, "status": "active"},
            format="json",
        )
        assert restore.status_code == 409

    def test_launch_rejects_a_stale_open_period(self) -> None:
        group, open_period, _, _ = self.create_breached_metric_source()
        response = self.client.post(
            reverse(
                "sentry-api-0-organization-breached-metric-investigation-launch",
                kwargs={"organization_id_or_slug": self.organization.slug},
            ),
            data={"groupId": str(group.id), "openPeriodId": str(open_period.id + 1)},
            format="json",
        )
        assert response.status_code == 404

    def test_concurrent_launch_collision_returns_the_single_winner(self) -> None:
        group, open_period, _, _ = self.create_breached_metric_source()
        source = resolve_breached_metric_sources(
            organization=self.organization,
            group_ids=[group.id],
            accessible_project_ids={self.project.id},
        )[group.id]
        winner = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Concurrent winner",
            template_key="breached_metric",
            template_version=1,
            source_type=InvestigationSourceType.BREACHED_METRIC,
            source_ref={
                "groupId": str(group.id),
                "openPeriodId": str(open_period.id),
            },
            source_key=source.source_key,
            source_revision=1,
        )
        missing_snapshot = mock.Mock()
        missing_snapshot.filter.return_value.first.return_value = None

        launch_url = reverse(
            "sentry-api-0-organization-breached-metric-investigation-launch",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with (
            mock.patch.object(
                Investigation.objects,
                "select_for_update",
                return_value=missing_snapshot,
            ),
            mock.patch(
                "sentry.investigations.endpoints.organization_breached_metric_investigations.create_template_investigation",
                side_effect=IntegrityError("concurrent source revision"),
            ),
        ):
            response = self.client.post(
                launch_url,
                data={"groupId": str(group.id), "openPeriodId": str(open_period.id)},
                format="json",
            )

        assert response.status_code == 200
        assert response.data["id"] == str(winner.id)
        assert (
            Investigation.objects.filter(
                source_key=source.source_key,
                status=InvestigationStatus.ACTIVE,
            ).count()
            == 1
        )

    def test_status_rejects_dynamic_unsupported_and_resolved_sources(self) -> None:
        group, _, detector, query = self.create_breached_metric_source()
        status_url = reverse(
            "sentry-api-0-organization-breached-metric-investigation-status",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        detector.config = {"detection_type": AlertRuleDetectionType.DYNAMIC.value}
        detector.save(update_fields=["config", "date_updated"])
        response = self.client.post(status_url, data={"groupIds": [group.id]}, format="json")
        assert response.data["items"][str(group.id)] == {"status": "unavailable"}

        detector.config = {"detection_type": AlertRuleDetectionType.STATIC.value}
        detector.save(update_fields=["config", "date_updated"])
        query.dataset = Dataset.Sessions.value
        query.save(update_fields=["dataset"])
        response = self.client.post(status_url, data={"groupIds": [group.id]}, format="json")
        assert response.data["items"][str(group.id)] == {"status": "unavailable"}

        query.dataset = Dataset.Events.value
        query.save(update_fields=["dataset"])
        group.status = GroupStatus.RESOLVED
        group.save(update_fields=["status"])
        response = self.client.post(status_url, data={"groupIds": [group.id]}, format="json")
        assert response.data["items"][str(group.id)] == {"status": "unavailable"}
