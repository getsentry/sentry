from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    Investigation,
    InvestigationCellComment,
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
    InvestigationCellExecutor,
    InvestigationFavoriteUser,
    InvestigationSourceType,
)
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateCellSpec
from sentry.issues.grouptype import PerformanceP95EndpointRegressionGroupType
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:investigations"


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


@with_feature(FEATURE)
class OrganizationInvestigationsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

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
        assert response.data["cells"] == []
        assert response.data["permissions"]["isEditableByEveryone"] is True

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["cellCount"] == 0
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
                "investigation_uuid": investigation.uuid,
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

    def test_duplicate_copies_notebook_structure_without_collaboration_or_execution(self) -> None:
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
        first = self.create_investigation_cell(
            investigation=source,
            position=0,
            kind="text",
            content="Hypothesis",
        )
        second = self.create_investigation_cell(
            investigation=source,
            position=1,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        self.create_investigation_cell_parameter(cell=second, parameter=parameter)
        self.create_investigation_cell_dependency(cell=second, depends_on=first)
        self.create_investigation_cell_comment(cell=first, author=self.user, body="Do not copy")
        execution = self.create_investigation_cell_execution(
            cell=second,
            executor=InvestigationCellExecutor.MANUAL,
            status=InvestigationCellExecutionStatus.COMPLETED,
            cell_version=1,
            input_fingerprint="b" * 64,
            result={"columns": ["count"], "rows": [[1]]},
        )
        second.current_execution = execution
        second.save(update_fields=["current_execution"])
        duplicate_url = reverse(
            "sentry-api-0-organization-investigation-duplicate",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": source.uuid,
            },
        )

        response = self.client.post(duplicate_url)

        assert response.status_code == 201, response.data
        assert response.data["title"] == "Copy of Original"
        assert response.data["createdBy"] == str(self.user.id)
        assert [cell["content"] for cell in response.data["cells"]] == [
            "Hypothesis",
            "count errors",
        ]
        assert response.data["cells"][1]["dependencies"] == [response.data["cells"][0]["id"]]
        assert response.data["cells"][1]["parameterKeys"] == ["environment"]
        assert all(cell["outputStatus"] == "notRun" for cell in response.data["cells"])
        duplicate = Investigation.objects.get(uuid=response.data["id"])
        assert not InvestigationCellComment.objects.filter(cell__investigation=duplicate).exists()

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
                "investigation_uuid": foreign.uuid,
            },
        )
        assert self.client.get(url).status_code == 404

    def test_create_breached_metric_template(self) -> None:
        group = self.create_group(
            project=self.project,
            type=PerformanceP95EndpointRegressionGroupType.type_id,
            message="Checkout p95 regression",
        )
        end = timezone.now()
        start = end - timedelta(days=7)
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": str(group.id)},
                "parameters": {
                    "timeRange": {"start": start.isoformat(), "end": end.isoformat()},
                    "environments": ["production"],
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["template"] == {"key": "breached_metric", "version": 1}
        assert response.data["projectIds"] == [self.project.id]
        assert [cell["kind"] for cell in response.data["cells"]] == [
            "text",
            "query",
            "text",
            "query",
        ]
        cells = response.data["cells"]
        assert cells[0]["dependencies"] == []
        assert cells[1]["dependencies"] == [cells[0]["id"]]
        assert cells[2]["dependencies"] == [cells[1]["id"]]
        assert set(cells[3]["dependencies"]) == {cells[1]["id"], cells[2]["id"]}
        assert "Checkout p95 regression" in cells[0]["content"]
        assert "before and after" in cells[1]["generationPrompt"]
        assert "Explain the most important change" in cells[2]["generationPrompt"]
        assert "release, environment, and transaction" in cells[3]["generationPrompt"]
        assert cells[0]["parameterKeys"] == []
        assert cells[1]["parameterKeys"] == ["timeRange", "environments"]
        assert cells[2]["parameterKeys"] == ["timeRange", "environments"]
        assert cells[3]["parameterKeys"] == ["timeRange", "environments"]
        assert [parameter["key"] for parameter in response.data["parameters"]] == [
            "timeRange",
            "environments",
        ]
        assert all(cell["outputStatus"] == "notRun" for cell in cells)
        assert InvestigationCellExecution.objects.count() == 0

    def test_template_validation_is_strict_and_atomic(self) -> None:
        group = self.create_group(
            project=self.project,
            type=PerformanceP95EndpointRegressionGroupType.type_id,
        )
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": str(group.id)},
                "parameters": {"unexpected": True},
            },
            format="json",
        )
        assert response.status_code == 400
        assert "parameters" in response.data
        assert Investigation.objects.count() == before

    def test_unknown_template_version_and_out_of_range_time_are_atomic(self) -> None:
        group = self.create_group(
            project=self.project,
            type=PerformanceP95EndpointRegressionGroupType.type_id,
        )
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 999,
                "sourceRef": {"groupId": str(group.id)},
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

        end = timezone.now()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": str(group.id)},
                "parameters": {
                    "timeRange": {
                        "start": (end - timedelta(days=91)).isoformat(),
                        "end": end.isoformat(),
                    }
                },
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
            cells=(
                TemplateCellSpec(key="one", kind="text", title="One", dependencies=("two",)),
                TemplateCellSpec(key="two", kind="text", title="Two", dependencies=("one",)),
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
        end = timezone.now()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"groupId": str(group.id)},
                "parameters": {
                    "timeRange": {
                        "start": (end - timedelta(days=1)).isoformat(),
                        "end": end.isoformat(),
                    }
                },
            },
            format="json",
        )
        assert response.status_code == 400

    def test_detail_returns_persisted_output_and_redacts_by_project(self) -> None:
        create_response = self.client.post(
            self.collection_url, data={"title": "Output"}, format="json"
        )
        investigation = Investigation.objects.get(uuid=create_response.data["id"])
        cell = self.create_investigation_cell(
            investigation=investigation,
            position=0,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        execution = self.create_investigation_cell_execution(
            cell=cell,
            executor=InvestigationCellExecutor.MANUAL,
            status=InvestigationCellExecutionStatus.COMPLETED,
            cell_version=1,
            input_fingerprint="a" * 64,
            result={"columns": ["count"], "rows": [[42]]},
        )
        cell.current_execution = execution
        cell.save(update_fields=["current_execution"])

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": investigation.uuid,
            },
        )
        response = self.client.get(detail_url)
        assert response.data["cells"][0]["outputStatus"] == "available"
        assert response.data["cells"][0]["output"]["rows"] == [[42]]

        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        restricted_team = self.create_team(organization=self.organization)
        inaccessible_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        self.create_investigation_cell_execution_project(
            execution=execution, project=inaccessible_project
        )
        self.login_as(viewer)
        response = self.client.get(detail_url)
        assert response.data["cells"][0]["outputStatus"] == "restricted"
        assert response.data["cells"][0]["output"] is None

    def test_dependencies_are_returned_but_not_writable(self) -> None:
        response = self.client.post(
            self.collection_url, data={"title": "Dependencies"}, format="json"
        )
        investigation = Investigation.objects.get(uuid=response.data["id"])
        first = self.create_investigation_cell(investigation=investigation, position=0, kind="text")
        second = self.create_investigation_cell(
            investigation=investigation, position=1, kind="query"
        )
        self.create_investigation_cell_dependency(cell=second, depends_on=first)
        cell_url = reverse(
            "sentry-api-0-organization-investigation-cell-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": investigation.uuid,
                "cell_uuid": second.uuid,
            },
        )
        response = self.client.put(
            cell_url,
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
                "investigation_uuid": first["id"],
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
                "investigation_uuid": created["id"],
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
                "investigation_uuid": created["id"],
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
        investigation = Investigation.objects.get(uuid=created["id"])
        assert investigation.title == "After"
