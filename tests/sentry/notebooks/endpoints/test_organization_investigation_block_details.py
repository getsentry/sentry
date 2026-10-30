from __future__ import annotations

from django.urls import reverse

from sentry.notebooks.models import NotebookBlock, NotebookBlockExecutionStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationBlockDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Block tests",
        )

    def block_url(self, block: NotebookBlock) -> str:
        return reverse(
            "sentry-api-0-organization-notebook-block-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": block.id,
            },
        )

    def test_update_and_soft_delete_block(self) -> None:
        block = self.create_notebook_block(
            notebook=self.investigation, kind="query", content="find slow transactions"
        )
        original_investigation_version = self.investigation.version

        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": original_investigation_version,
                "version": block.version,
                "content": "updated query",
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["version"] == block.version + 1
        assert response.data["staleAt"] is not None

        block.refresh_from_db()
        self.investigation.refresh_from_db()
        assert block.content == "updated query"
        assert block.version == 2
        assert block.stale_at is not None
        assert self.investigation.version == original_investigation_version + 1

        response = self.client.delete(
            self.block_url(block),
            data={"investigationVersion": self.investigation.version, "version": block.version},
            format="json",
        )
        assert response.status_code == 204
        block.refresh_from_db()
        assert block.deleted_at is not None

    def test_update_conflict(self) -> None:
        block = self.create_notebook_block(notebook=self.investigation, position=0, kind="text")
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

    def test_update_rejects_version_only_payload_without_changes(self) -> None:
        block = self.create_notebook_block(notebook=self.investigation)
        original_investigation_version = self.investigation.version
        original_block_version = block.version

        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": original_investigation_version,
                "version": original_block_version,
            },
            format="json",
        )

        assert response.status_code == 400
        assert "detail" in response.data
        block.refresh_from_db()
        self.investigation.refresh_from_db()
        assert block.version == original_block_version
        assert self.investigation.version == original_investigation_version

    def test_update_with_identical_values_does_not_change_versions_or_metadata(self) -> None:
        original_editor = self.create_user()
        block = self.create_notebook_block(
            notebook=self.investigation,
            content="unchanged",
            last_edited_by_id=original_editor.id,
        )
        original_investigation_version = self.investigation.version
        original_block_version = block.version
        original_date_updated = block.date_updated

        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": original_investigation_version,
                "version": original_block_version,
                "content": "unchanged",
            },
            format="json",
        )

        assert response.status_code == 200
        block.refresh_from_db()
        self.investigation.refresh_from_db()
        assert block.version == original_block_version
        assert block.date_updated == original_date_updated
        assert block.last_edited_by_id == original_editor.id
        assert block.stale_at is None
        assert self.investigation.version == original_investigation_version

    def test_block_update_rejects_server_owned_and_immutable_fields(self) -> None:
        block = self.create_notebook_block(
            notebook=self.investigation, kind="query", display={"type": "table"}
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
        block = self.create_notebook_block(notebook=self.investigation)
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

    def test_sentry_app_cannot_mutate_block(self) -> None:
        block = self.create_notebook_block(notebook=self.investigation, position=0, kind="text")
        sentry_app_user = self.create_user(is_sentry_app=True)
        self.create_member(
            organization=self.organization,
            user=sentry_app_user,
            role="member",
        )
        self.login_as(sentry_app_user)

        response = self.client.put(
            self.block_url(block),
            data={
                "investigationVersion": self.investigation.version,
                "version": block.version,
                "content": "must not be saved",
            },
            format="json",
        )
        assert response.status_code == 403

        response = self.client.delete(
            self.block_url(block),
            data={
                "investigationVersion": self.investigation.version,
                "version": block.version,
            },
            format="json",
        )
        assert response.status_code == 403

        block.refresh_from_db()
        assert block.content == ""
        assert block.deleted_at is None

    def test_delete_rejects_an_active_block_run(self) -> None:
        block = self.create_notebook_block(notebook=self.investigation, position=0, kind="text")
        self.create_notebook_block_execution(
            block=block,
            executor="text_generation",
            status=NotebookBlockExecutionStatus.AWAITING_INPUT,
            block_version=block.version,
            input_snapshot={},
        )

        response = self.client.delete(
            self.block_url(block),
            data={
                "investigationVersion": self.investigation.version,
                "version": block.version,
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"detail": "Stop the active run before deleting this block."}
