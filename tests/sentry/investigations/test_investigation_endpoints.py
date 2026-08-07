from __future__ import annotations

from unittest import mock

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationFavoriteUser,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateBlockSpec
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

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
