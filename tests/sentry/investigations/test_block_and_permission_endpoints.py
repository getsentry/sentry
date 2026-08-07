from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import InvestigationBlock
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationBlockEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Block tests",
        )
        self.create_investigation_permissions(investigation=self.investigation)

    def blocks_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-blocks",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def block_url(self, block: InvestigationBlock) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-block-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": block.id,
            },
        )

    def test_create_update_and_soft_delete_block(self) -> None:
        response = self.client.post(
            self.blocks_url(),
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
        block = InvestigationBlock.objects.get(id=response.data["id"])

        response = self.client.put(
            self.block_url(block),
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

        block.refresh_from_db()
        self.investigation.refresh_from_db()
        assert block.content == "updated query"
        assert block.version == 2
        assert block.stale_at is not None
        assert self.investigation.version == 3
        response = self.client.delete(
            self.block_url(block),
            data={"investigationVersion": self.investigation.version, "version": 2},
            format="json",
        )
        assert response.status_code == 204
        block.refresh_from_db()
        assert block.deleted_at is not None

    def test_update_conflict(self) -> None:
        block = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="text"
        )
        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": self.investigation.version,
                "version": 99,
                "content": "stale",
            },
            format="json",
        )
        assert response.status_code == 409
        block.refresh_from_db()
        assert block.content == ""

    def test_block_update_rejects_server_owned_and_immutable_fields(self) -> None:
        block = self.create_investigation_block(
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
                self.block_url(block),
                data={
                    "investigationVersion": self.investigation.version,
                    "version": block.version,
                    field: value,
                },
                format="json",
            )
            assert response.status_code == 400
            assert field in response.data

    def test_block_update_checks_both_versions_atomically(self) -> None:
        block = self.create_investigation_block(investigation=self.investigation)
        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": 99,
                "version": block.version,
                "content": "must not be saved",
            },
            format="json",
        )
        assert response.status_code == 409
        block.refresh_from_db()
        assert block.content == ""

    def test_display_validation(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"type": "line", "xAxis": "time", "yAxes": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "display": {"type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "content": "Show error volume",
                "display": {
                    "version": 1,
                    "type": "table",
                    "defaultView": "chart",
                    "queryCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

    def test_versioned_display_rejects_invalid_field_types(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"version": 1.0, "type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "display": {"version": True, "type": "markdown"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"version": 1, "type": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "stacked": "yes",
                },
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "topN": True,
                },
            },
            format="json",
        )
        assert response.status_code == 400

    def test_text_display_accepts_persisted_prompt_collapse(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "generationPrompt": "Summarize the context",
                "display": {
                    "version": 1,
                    "type": "markdown",
                    "promptCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["display"]["promptCollapsed"] is True

    def test_drag_reorder_requires_exact_permutation(self) -> None:
        blocks = [
            self.create_investigation_block(
                investigation=self.investigation, position=position, kind="text"
            )
            for position in range(3)
        ]
        url = reverse(
            "sentry-api-0-organization-investigation-block-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "blockIds": [block.id for block in reversed(blocks)],
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        assert [block["id"] for block in response.data["blocks"]] == [
            str(block.id) for block in reversed(blocks)
        ]

        version = response.data["version"]
        response = self.client.put(
            url,
            data={
                "investigationVersion": version,
                "blockIds": [blocks[0].id, blocks[0].id, blocks[1].id],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_drag_reorder_rejects_missing_deleted_and_foreign_blocks_without_changes(self) -> None:
        first = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="text"
        )
        second = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="text"
        )
        foreign_investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Foreign"
        )
        foreign = self.create_investigation_block(investigation=foreign_investigation)
        url = reverse(
            "sentry-api-0-organization-investigation-block-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        for block_ids in ([first.id], [first.id, foreign.id]):
            response = self.client.put(
                url,
                data={
                    "investigationVersion": self.investigation.version,
                    "blockIds": block_ids,
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
                "blockIds": [first.id, second.id],
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
        first = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )
        second = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="text"
        )
        self.create_investigation_block_parameter(block=first, parameter=parameter)
        self.create_investigation_block_dependency(block=second, depends_on=first)
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
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
                "investigation_id": self.investigation.id,
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

    def test_edit_permissions_apply_to_block_mutations(self) -> None:
        permissions = self.investigation.permissions
        permissions.is_editable_by_everyone = False
        permissions.save()
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)

        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": 1, "kind": "text"},
            format="json",
        )
        assert response.status_code == 403

        team = self.create_team(organization=self.organization, members=[other_user])
        permissions.teams_with_edit_access.add(team)
        response = self.client.post(
            self.blocks_url(),
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
                "investigation_id": self.investigation.id,
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
                "investigation_id": self.investigation.id,
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

    def test_permission_update_grants_and_replaces_team_access(self) -> None:
        editor = self.create_user()
        self.create_member(organization=self.organization, user=editor, role="member")
        editor_team = self.create_team(organization=self.organization, members=[editor])
        other_team = self.create_team(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [other_team.id, editor_team.id],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["teamIds"] == sorted([editor_team.id, other_team.id])
        permissions = self.investigation.permissions
        permissions.refresh_from_db()
        self.investigation.refresh_from_db()
        assert set(permissions.teams_with_edit_access.values_list("id", flat=True)) == {
            editor_team.id,
            other_team.id,
        }
        assert self.investigation.version == 2

        self.login_as(editor)
        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": self.investigation.version, "kind": "text"},
            format="json",
        )
        assert response.status_code == 201

        self.login_as(self.user)
        self.investigation.refresh_from_db()
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [other_team.id],
            },
            format="json",
        )
        assert response.status_code == 200
        permissions.refresh_from_db()
        self.investigation.refresh_from_db()
        assert set(permissions.teams_with_edit_access.values_list("id", flat=True)) == {
            other_team.id
        }
        assert self.investigation.version == 4

        self.login_as(editor)
        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": self.investigation.version, "kind": "text"},
            format="json",
        )
        assert response.status_code == 403

    def test_permission_update_validates_investigation_version_and_team_organization(self) -> None:
        url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
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
        permissions = self.investigation.permissions
        permissions.refresh_from_db()
        self.investigation.refresh_from_db()
        assert permissions.is_editable_by_everyone is True
        assert list(permissions.teams_with_edit_access.all()) == []
        assert self.investigation.version == 1

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
        permissions.refresh_from_db()
        self.investigation.refresh_from_db()
        assert permissions.is_editable_by_everyone is True
        assert list(permissions.teams_with_edit_access.all()) == []
        assert self.investigation.version == 1

    def test_permission_get_returns_configured_teams(self) -> None:
        permissions = self.investigation.permissions
        first_team = self.create_team(organization=self.organization)
        second_team = self.create_team(organization=self.organization)
        permissions.teams_with_edit_access.add(second_team, first_team)
        url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["teamIds"] == sorted([first_team.id, second_team.id])

    def test_sentry_app_cannot_update_parameters_or_permissions(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        sentry_app_user = self.create_user(is_sentry_app=True)
        self.create_member(
            organization=self.organization,
            user=sentry_app_user,
            role="member",
        )
        self.login_as(sentry_app_user)
        parameters_url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        permissions_url = reverse(
            "sentry-api-0-organization-investigation-permissions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(
            parameters_url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"environment": "production"},
            },
            format="json",
        )
        assert response.status_code == 403

        response = self.client.put(
            permissions_url,
            data={
                "investigationVersion": self.investigation.version,
                "isEditableByEveryone": False,
                "teamIds": [],
            },
            format="json",
        )
        assert response.status_code == 403

        parameter.refresh_from_db()
        self.investigation.permissions.refresh_from_db()
        assert parameter.saved_value is None
        assert self.investigation.permissions.is_editable_by_everyone is True

    def test_manager_can_override_edit_permissions(self) -> None:
        permissions = self.investigation.permissions
        permissions.is_editable_by_everyone = False
        permissions.save(update_fields=["is_editable_by_everyone"])
        manager = self.create_user()
        self.create_member(organization=self.organization, user=manager, role="manager")
        self.login_as(manager)
        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": 1, "kind": "text"},
            format="json",
        )
        assert response.status_code == 201
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
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
                "investigation_id": self.investigation.id,
            },
        )

        team_editor = self.create_user()
        self.create_member(organization=self.organization, user=team_editor, role="member")
        team = self.create_team(organization=self.organization, members=[team_editor])
        permissions.teams_with_edit_access.add(team)
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

    def test_sentry_app_cannot_mutate_blocks(self) -> None:
        first = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="text"
        )
        second = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="text"
        )
        sentry_app_user = self.create_user(is_sentry_app=True)
        self.create_member(
            organization=self.organization,
            user=sentry_app_user,
            role="member",
        )
        self.login_as(sentry_app_user)

        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": self.investigation.version, "kind": "text"},
            format="json",
        )
        assert response.status_code == 403

        response = self.client.put(
            self.block_url(first),
            data={
                "investigationVersion": self.investigation.version,
                "version": first.version,
                "content": "must not be saved",
            },
            format="json",
        )
        assert response.status_code == 403

        response = self.client.delete(
            self.block_url(first),
            data={
                "investigationVersion": self.investigation.version,
                "version": first.version,
            },
            format="json",
        )
        assert response.status_code == 403

        order_url = reverse(
            "sentry-api-0-organization-investigation-block-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        response = self.client.put(
            order_url,
            data={
                "investigationVersion": self.investigation.version,
                "blockIds": [second.id, first.id],
            },
            format="json",
        )
        assert response.status_code == 403

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.content == ""
        assert first.deleted_at is None
        assert (first.position, second.position) == (0, 1)

    def test_delete_marks_transitive_downstream_blocks_stale(self) -> None:
        upstream = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )
        child = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="query"
        )
        grandchild = self.create_investigation_block(
            investigation=self.investigation, position=2, kind="text"
        )
        unrelated = self.create_investigation_block(
            investigation=self.investigation, position=3, kind="text"
        )
        self.create_investigation_block_dependency(block=child, depends_on=upstream)
        self.create_investigation_block_dependency(block=grandchild, depends_on=child)

        response = self.client.delete(
            self.block_url(upstream),
            data={
                "investigationVersion": self.investigation.version,
                "version": upstream.version,
            },
            format="json",
        )
        assert response.status_code == 204

        upstream.refresh_from_db()
        child.refresh_from_db()
        grandchild.refresh_from_db()
        unrelated.refresh_from_db()
        assert upstream.deleted_at is not None
        assert child.stale_at is not None
        assert grandchild.stale_at is not None
        assert unrelated.stale_at is None
        assert (child.position, grandchild.position, unrelated.position) == (0, 1, 2)

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        detail_response = self.client.get(detail_url)
        assert detail_response.status_code == 200
        blocks_by_id = {block["id"]: block for block in detail_response.data["blocks"]}
        assert str(upstream.id) not in blocks_by_id
        assert blocks_by_id[str(child.id)]["dependencies"] == []
        assert blocks_by_id[str(grandchild.id)]["dependencies"] == [str(child.id)]

    def test_update_marks_transitive_downstream_blocks_stale(self) -> None:
        upstream = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )
        child = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="query"
        )
        grandchild = self.create_investigation_block(
            investigation=self.investigation, position=2, kind="text"
        )
        unrelated = self.create_investigation_block(
            investigation=self.investigation, position=3, kind="text"
        )
        self.create_investigation_block_dependency(block=child, depends_on=upstream)
        self.create_investigation_block_dependency(block=grandchild, depends_on=child)

        response = self.client.put(
            self.block_url(upstream),
            data={
                "investigationVersion": self.investigation.version,
                "version": upstream.version,
                "content": "updated input",
            },
            format="json",
        )
        assert response.status_code == 200

        upstream.refresh_from_db()
        child.refresh_from_db()
        grandchild.refresh_from_db()
        unrelated.refresh_from_db()
        assert upstream.stale_at is not None
        assert child.stale_at is not None
        assert grandchild.stale_at is not None
        assert unrelated.stale_at is None

    def test_failed_delete_does_not_mark_downstream_blocks_stale(self) -> None:
        upstream = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )
        downstream = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="text"
        )
        self.create_investigation_block_dependency(block=downstream, depends_on=upstream)

        response = self.client.delete(
            self.block_url(upstream),
            data={
                "investigationVersion": self.investigation.version,
                "version": upstream.version + 1,
            },
            format="json",
        )
        assert response.status_code == 409

        upstream.refresh_from_db()
        downstream.refresh_from_db()
        assert upstream.deleted_at is None
        assert downstream.stale_at is None
