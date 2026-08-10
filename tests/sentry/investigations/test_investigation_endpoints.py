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
    InvestigationBlockExecutor,
    InvestigationFavoriteUser,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateBlockSpec
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.workflow_engine.models.data_condition import Condition

FEATURE = "organizations:investigations"
QUERY_EXECUTION_FEATURE = "organizations:investigations-query-execution"


class OrganizationInvestigationsFeatureTest(APITestCase):
    def test_feature_is_required(self) -> None:
        self.login_as(self.user)
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-investigations",
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
        )
        assert response.status_code == 404
        assert not Investigation.objects.exists()


@with_feature(FEATURE)
class OrganizationInvestigationsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

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

    def test_create_manual_and_list(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout follow-up",
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == "Checkout follow-up"
        assert response.data["projectIds"] == [self.project.id]
        assert response.data["blocks"] == []
        assert response.data["permissions"]["isEditableByEveryone"] is True

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["blockCount"] == 0
        assert response.data[0]["isFavorited"] is False
        assert response.data[0]["permissions"]["canManage"] is True

    def test_favorite_is_user_specific_and_returned_in_list(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Star me"
        )
        self.create_investigation_permissions(investigation=investigation)
        favorite_url = reverse(
            "sentry-api-0-organization-investigation-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.put(favorite_url, data={"shouldFavorite": True}, format="json")
        assert response.status_code == 204
        assert InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=self.user.id
        ).exists()
        assert self.client.get(self.collection_url).data[0]["isFavorited"] is True

        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)
        assert self.client.get(self.collection_url).data[0]["isFavorited"] is False

        self.login_as(self.user)
        response = self.client.put(favorite_url, data={"shouldFavorite": False}, format="json")
        assert response.status_code == 204
        assert not InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=self.user.id
        ).exists()

    def test_read_only_viewer_can_favorite_an_investigation(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Read only"
        )
        self.create_investigation_permissions(
            investigation=investigation, is_editable_by_everyone=False
        )
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        self.login_as(viewer)
        favorite_url = reverse(
            "sentry-api-0-organization-investigation-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.put(favorite_url, data={"shouldFavorite": True}, format="json")

        assert response.status_code == 204
        assert InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=viewer.id
        ).exists()

    def test_empty_project_scope_does_not_require_every_organization_project(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Unscoped"
        )
        self.create_investigation_permissions(investigation=investigation)
        restricted_team = self.create_team(organization=self.organization)
        self.create_project(organization=self.organization, teams=[restricted_team])
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        self.login_as(viewer)
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.get(detail_url)

        assert response.status_code == 200

    def test_duplicate_copies_notebook_structure_without_execution_or_per_user_state(self) -> None:
        source = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Original",
            filters={"environments": ["production"]},
        )
        self.create_investigation_permissions(investigation=source)
        parameter = self.create_investigation_parameter(
            investigation=source,
            key="environment",
            label="Environment",
            type="string",
            position=0,
            saved_value="production",
        )
        first = self.create_investigation_block(
            investigation=source,
            position=0,
            kind="text",
            content="Hypothesis",
        )
        second = self.create_investigation_block(
            investigation=source,
            position=1,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        self.create_investigation_block_parameter(block=second, parameter=parameter)
        self.create_investigation_block_dependency(block=second, depends_on=first)
        execution = self.create_investigation_block_execution(
            block=second,
            executor=InvestigationBlockExecutor.MANUAL,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            block_version=1,
            input_fingerprint="b" * 64,
            result={"columns": ["count"], "rows": [[1]]},
        )
        second.current_execution = execution
        second.save(update_fields=["current_execution"])
        duplicate_url = reverse(
            "sentry-api-0-organization-investigation-duplicate",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": source.id,
            },
        )

        response = self.client.post(duplicate_url)

        assert response.status_code == 201, response.data
        assert response.data["title"] == "Copy of Original"
        assert response.data["createdBy"] == str(self.user.id)
        assert [block["content"] for block in response.data["blocks"]] == [
            "Hypothesis",
            "count errors",
        ]
        assert response.data["blocks"][1]["dependencies"] == [response.data["blocks"][0]["id"]]
        assert response.data["blocks"][1]["parameterKeys"] == ["environment"]
        assert all(block["outputStatus"] == "notRun" for block in response.data["blocks"])

    def test_manual_creation_rejects_inaccessible_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        response = self.client.post(
            self.collection_url,
            data={"title": "No access", "projectIds": [other_project.id]},
            format="json",
        )
        assert response.status_code == 400
        assert not Investigation.objects.filter(title="No access").exists()

    def test_unauthenticated_request_is_rejected(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
        response = self.client.get(self.collection_url)
        assert response.status_code in {401, 403}

    def test_detail_is_scoped_to_organization(self) -> None:
        other_organization = self.create_organization()
        foreign = self.create_investigation(
            organization=other_organization, created_by=self.user, title="Foreign"
        )
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": foreign.id,
            },
        )
        assert self.client.get(url).status_code == 404

    @with_feature(QUERY_EXECUTION_FEATURE)
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

    @with_feature(QUERY_EXECUTION_FEATURE)
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

    @with_feature(QUERY_EXECUTION_FEATURE)
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
        self.create_investigation_permissions(investigation=winner)
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
                "sentry.investigations.endpoints.organization_investigations.create_template_investigation",
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

    @with_feature(QUERY_EXECUTION_FEATURE)
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

    def test_template_validation_is_strict_and_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": "1", "openPeriodId": "1"},
                "parameters": {"unexpected": True},
            },
            format="json",
        )
        assert response.status_code == 400
        assert "parameters" in response.data
        assert Investigation.objects.count() == before

    def test_unknown_template_version_is_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 999,
                "sourceRef": {"groupId": "1", "openPeriodId": "1"},
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_cyclic_template_rolls_back_before_source_resolution(self) -> None:
        template = InvestigationTemplateSpec(
            key="cyclic",
            version=1,
            source_type=InvestigationSourceType.BREACHED_METRIC,
            parameters=(),
            blocks=(
                TemplateBlockSpec(key="one", kind="text", title="One", dependencies=("two",)),
                TemplateBlockSpec(key="two", kind="text", title="Two", dependencies=("one",)),
            ),
        )
        before = Investigation.objects.count()
        with mock.patch(
            "sentry.investigations.services.investigations.get_investigation_template",
            return_value=template,
        ):
            response = self.client.post(
                self.collection_url,
                data={
                    "templateKey": "cyclic",
                    "templateVersion": 1,
                    "sourceRef": {"groupId": "1"},
                    "parameters": {},
                },
                format="json",
            )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_template_rejects_wrong_issue_category(self) -> None:
        group = self.create_group(project=self.project)
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": str(group.id), "openPeriodId": "1"},
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 404

    def test_detail_requires_result_project_access_but_list_remains_visible(self) -> None:
        create_response = self.client.post(
            self.collection_url, data={"title": "Output"}, format="json"
        )
        investigation = Investigation.objects.get(id=create_response.data["id"])
        block = self.create_investigation_block(
            investigation=investigation,
            position=0,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        execution = self.create_investigation_block_execution(
            block=block,
            executor=InvestigationBlockExecutor.MANUAL,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            block_version=1,
            input_fingerprint="a" * 64,
            result={"columns": ["count"], "rows": [[42]]},
        )
        block.current_execution = execution
        block.result_execution = execution
        block.save(update_fields=["current_execution", "result_execution"])

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )
        response = self.client.get(detail_url)
        assert response.data["blocks"][0]["outputStatus"] == "available"
        assert response.data["blocks"][0]["output"]["rows"] == [[42]]

        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        restricted_team = self.create_team(organization=self.organization)
        inaccessible_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        self.create_investigation_block_execution_project(
            execution=execution, project=inaccessible_project
        )
        self.login_as(viewer)
        response = self.client.get(detail_url)
        assert response.status_code == 403

        list_response = self.client.get(self.collection_url)
        assert list_response.status_code == 200
        assert str(investigation.id) in {item["id"] for item in list_response.data}

    def test_dependencies_are_returned_but_not_writable(self) -> None:
        response = self.client.post(
            self.collection_url, data={"title": "Dependencies"}, format="json"
        )
        investigation = Investigation.objects.get(id=response.data["id"])
        first = self.create_investigation_block(
            investigation=investigation, position=0, kind="text"
        )
        second = self.create_investigation_block(
            investigation=investigation, position=1, kind="query"
        )
        self.create_investigation_block_dependency(block=second, depends_on=first)
        block_url = reverse(
            "sentry-api-0-organization-investigation-block-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
                "block_id": second.id,
            },
        )
        response = self.client.put(
            block_url,
            data={
                "investigationVersion": investigation.version,
                "version": second.version,
                "dependencies": [],
            },
            format="json",
        )
        assert response.status_code == 400
        assert "dependencies" in response.data

    def test_archive_restore_and_list_filters(self) -> None:
        first = self.client.post(
            self.collection_url, data={"title": "Checkout investigation"}, format="json"
        ).data
        self.client.post(
            self.collection_url, data={"title": "Payments investigation"}, format="json"
        )
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first["id"],
            },
        )

        response = self.client.delete(
            detail_url,
            data={"investigationVersion": first["version"]},
            format="json",
        )
        assert response.status_code == 204
        response = self.client.get(f"{self.collection_url}?query=Checkout")
        assert response.data == []
        response = self.client.get(self.collection_url, {"status": "archived"})
        assert [item["id"] for item in response.data] == [first["id"]]

        archived = self.client.get(detail_url).data
        response = self.client.put(
            detail_url,
            data={"investigationVersion": archived["version"], "status": "active"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "active"

    def test_source_lineage_lists_latest_and_keeps_historical_detail(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source_type": InvestigationSourceType.ISSUE,
            "source_key": "issue:123",
            "source_ref": {"groupId": "123"},
        }
        first = self.create_investigation(
            title="First revision", source_revision=1, status=InvestigationStatus.ACTIVE, **lineage
        )
        second = self.create_investigation(
            title="Second revision", source_revision=2, status=InvestigationStatus.ACTIVE, **lineage
        )
        self.create_investigation_permissions(investigation=first)
        self.create_investigation_permissions(investigation=second)

        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(second.id)]

        first_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first.id,
            },
        )
        assert self.client.get(first_url).status_code == 200

        second_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": second.id,
            },
        )
        assert (
            self.client.delete(
                second_url,
                data={"investigationVersion": second.version},
                format="json",
            ).status_code
            == 204
        )
        assert not Investigation.objects.filter(
            source_key="issue:123", status=InvestigationStatus.ACTIVE
        ).exists()

        third = self.create_investigation(
            title="Third revision", source_revision=3, status=InvestigationStatus.ACTIVE, **lineage
        )
        self.create_investigation_permissions(investigation=third)
        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(third.id)]

    def test_archive_rejects_an_active_block_run(self) -> None:
        created = self.client.post(
            self.collection_url, data={"title": "Running investigation"}, format="json"
        ).data
        investigation = Investigation.objects.get(id=created["id"])
        block = self.create_investigation_block(investigation=investigation, kind="text")
        self.create_investigation_block_execution(
            block=block,
            executor="text_generation",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=block.version,
            input_snapshot={},
        )
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.delete(
            detail_url,
            data={"investigationVersion": investigation.version},
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {
            "detail": "Stop active block runs before archiving this investigation."
        }

    def test_non_creator_cannot_archive_even_when_everyone_can_edit(self) -> None:
        created = self.client.post(
            self.collection_url, data={"title": "Shared"}, format="json"
        ).data
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": created["id"],
            },
        )
        assert self.client.get(url).status_code == 200
        assert (
            self.client.delete(
                url,
                data={"investigationVersion": created["version"]},
                format="json",
            ).status_code
            == 403
        )

    def test_metadata_update_persists_and_stale_version_rolls_back(self) -> None:
        created = self.client.post(
            self.collection_url,
            data={"title": "Before", "projectIds": [self.project.id]},
            format="json",
        ).data
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": created["id"],
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": created["version"],
                "title": "After",
                "filters": {"environment": ["production"]},
                "projectIds": [],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["title"] == "After"
        assert response.data["filters"] == {"environment": ["production"]}
        assert response.data["projectIds"] == []

        response = self.client.put(
            url,
            data={"investigationVersion": created["version"], "title": "Stale write"},
            format="json",
        )
        assert response.status_code == 409
        investigation = Investigation.objects.get(id=created["id"])
        assert investigation.title == "After"
