from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationCell,
    InvestigationPermissionsTeam,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationCellEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Cell tests",
        )
        self.create_investigation_permissions(investigation=self.investigation)

    def cells_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-cells",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )

    def cell_url(self, cell: InvestigationCell) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-cell-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": cell.uuid,
            },
        )

    def test_create_update_and_soft_delete_cell(self) -> None:
        response = self.client.post(
            self.cells_url(),
            data={
                "investigationVersion": 1,
                "kind": "query",
                "content": "find slow transactions",
                "generationPrompt": "Generate the query",
                "display": {"type": "bar", "xAxis": "release", "yAxes": ["count"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["content"] == "find slow transactions"
        assert response.data["generationPrompt"] == "Generate the query"
        assert response.data["generatedContent"] == ""
        cell = InvestigationCell.objects.get(uuid=response.data["id"])

        response = self.client.put(
            self.cell_url(cell),
            data={
                "investigationVersion": 2,
                "version": 1,
                "content": "updated query",
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["version"] == 2
        assert response.data["staleAt"] is not None

        self.investigation.refresh_from_db()
        response = self.client.delete(
            self.cell_url(cell),
            data={"investigationVersion": self.investigation.version, "version": 2},
            format="json",
        )
        assert response.status_code == 204
        cell.refresh_from_db()
        assert cell.deleted_at is not None

    def test_update_conflict(self) -> None:
        cell = self.create_investigation_cell(
            investigation=self.investigation, position=0, kind="text"
        )
        response = self.client.put(
            self.cell_url(cell),
            data={
                "investigationVersion": self.investigation.version,
                "version": 99,
                "content": "stale",
            },
            format="json",
        )
        assert response.status_code == 409
        cell.refresh_from_db()
        assert cell.content == ""

    def test_cell_update_rejects_server_owned_and_immutable_fields(self) -> None:
        cell = self.create_investigation_cell(
            investigation=self.investigation, kind="query", display={"type": "table"}
        )
        for field, value in (
            ("generatedContent", "generated"),
            ("output", {"rows": []}),
            ("kind", "text"),
            ("dependencies", []),
            ("parameterKeys", []),
        ):
            response = self.client.put(
                self.cell_url(cell),
                data={
                    "investigationVersion": self.investigation.version,
                    "version": cell.version,
                    field: value,
                },
                format="json",
            )
            assert response.status_code == 400
            assert field in response.data

    def test_cell_update_checks_both_versions_atomically(self) -> None:
        cell = self.create_investigation_cell(investigation=self.investigation)
        response = self.client.put(
            self.cell_url(cell),
            data={
                "investigationVersion": 99,
                "version": cell.version,
                "content": "must not be saved",
            },
            format="json",
        )
        assert response.status_code == 409
        cell.refresh_from_db()
        assert cell.content == ""

    def test_display_validation(self) -> None:
        response = self.client.post(
            self.cells_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"type": "line", "xAxis": "time", "yAxes": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.cells_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "display": {"type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.cells_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "content": "Show error volume",
                "display": {
                    "version": 1,
                    "type": "table",
                    "defaultView": "both",
                    "queryCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

    def test_drag_reorder_requires_exact_permutation(self) -> None:
        cells = [
            self.create_investigation_cell(
                investigation=self.investigation, position=position, kind="text"
            )
            for position in range(3)
        ]
        url = reverse(
            "sentry-api-0-organization-investigation-cell-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "cellIds": [str(cell.uuid) for cell in reversed(cells)],
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        assert [cell["id"] for cell in response.data["cells"]] == [
            str(cell.uuid) for cell in reversed(cells)
        ]

        version = response.data["version"]
        response = self.client.put(
            url,
            data={
                "investigationVersion": version,
                "cellIds": [str(cells[0].uuid), str(cells[0].uuid), str(cells[1].uuid)],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_drag_reorder_rejects_missing_deleted_and_foreign_cells_without_changes(self) -> None:
        first = self.create_investigation_cell(
            investigation=self.investigation, position=0, kind="text"
        )
        second = self.create_investigation_cell(
            investigation=self.investigation, position=1, kind="text"
        )
        foreign_investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Foreign"
        )
        foreign = self.create_investigation_cell(investigation=foreign_investigation)
        url = reverse(
            "sentry-api-0-organization-investigation-cell-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )

        for cell_ids in ([str(first.uuid)], [str(first.uuid), str(foreign.uuid)]):
            response = self.client.put(
                url,
                data={
                    "investigationVersion": self.investigation.version,
                    "cellIds": cell_ids,
                },
                format="json",
            )
            assert response.status_code == 400
            first.refresh_from_db()
            second.refresh_from_db()
            assert (first.position, second.position) == (0, 1)

        second.deleted_at = timezone.now()
        second.save(update_fields=["deleted_at"])
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "cellIds": [str(first.uuid), str(second.uuid)],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_parameter_update_marks_transitive_dependents_stale(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        first = self.create_investigation_cell(
            investigation=self.investigation, position=0, kind="query"
        )
        second = self.create_investigation_cell(
            investigation=self.investigation, position=1, kind="text"
        )
        self.create_investigation_cell_parameter(cell=first, parameter=parameter)
        self.create_investigation_cell_dependency(cell=second, depends_on=first)
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"environment": "production"},
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        first.refresh_from_db()
        second.refresh_from_db()
        assert first.stale_at is not None
        assert second.stale_at is not None

    def test_project_parameter_update_rejects_inaccessible_project(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="project",
            label="Project",
            type="project",
            position=0,
        )
        foreign_project = self.create_project(organization=self.create_organization())
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"project": foreign_project.id},
            },
            format="json",
        )
        assert response.status_code == 400
        parameter.refresh_from_db()
        assert parameter.saved_value is None
        assert parameter.version == 1
        self.investigation.refresh_from_db()
        assert self.investigation.version == 1

    def test_edit_permissions_apply_to_cell_mutations(self) -> None:
        permissions = self.investigation.permissions
        permissions.is_editable_by_everyone = False
        permissions.save()
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)

        response = self.client.post(
            self.cells_url(),
            data={"investigationVersion": 1, "kind": "text"},
            format="json",
        )
        assert response.status_code == 403

        team = self.create_team(organization=self.organization, members=[other_user])
        InvestigationPermissionsTeam.objects.create(permissions=permissions, team=team)
        response = self.client.post(
            self.cells_url(),
            data={"investigationVersion": 1, "kind": "text"},
            format="json",
        )
        assert response.status_code == 201

    def test_only_creator_or_manager_can_change_permissions(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)
        url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [],
            },
            format="json",
        )
        assert response.status_code == 403

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        assert self.client.get(detail_url).data["permissions"]["canManage"] is False

        self.login_as(self.user)
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["isEditableByEveryone"] is False
        assert response.data["canManage"] is True

    def test_permission_update_validates_notebook_version_and_team_organization(self) -> None:
        url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": 99,
                "isEditableByEveryone": False,
                "teamIds": [],
            },
            format="json",
        )
        assert response.status_code == 409
        assert self.investigation.permissions.is_editable_by_everyone is True

        foreign_team = self.create_team(organization=self.create_organization())
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [foreign_team.id],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_manager_can_override_edit_permissions(self) -> None:
        permissions = self.investigation.permissions
        permissions.is_editable_by_everyone = False
        permissions.save(update_fields=["is_editable_by_everyone"])
        manager = self.create_user()
        self.create_member(organization=self.organization, user=manager, role="manager")
        self.login_as(manager)
        response = self.client.post(
            self.cells_url(),
            data={"investigationVersion": 1, "kind": "text"},
            format="json",
        )
        assert response.status_code == 201
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        assert self.client.get(detail_url).data["permissions"]["canEdit"] is True
        assert self.client.get(detail_url).data["permissions"]["canManage"] is True

    def test_team_editor_cannot_manage_but_superuser_can(self) -> None:
        permissions = self.investigation.permissions
        permissions.is_editable_by_everyone = False
        permissions.save(update_fields=["is_editable_by_everyone"])
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )

        team_editor = self.create_user()
        self.create_member(organization=self.organization, user=team_editor, role="member")
        team = self.create_team(organization=self.organization, members=[team_editor])
        InvestigationPermissionsTeam.objects.create(permissions=permissions, team=team)
        self.login_as(team_editor)
        response = self.client.get(detail_url)
        assert response.data["permissions"]["canEdit"] is True
        assert response.data["permissions"]["canManage"] is False

        superuser = self.create_user(is_superuser=True)
        self.create_member(organization=self.organization, user=superuser, role="member")
        self.login_as(superuser, superuser=True)
        response = self.client.get(detail_url)
        assert response.data["permissions"]["canEdit"] is True
        assert response.data["permissions"]["canManage"] is True
