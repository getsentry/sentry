from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlock,
)
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

    def cells_url(self) -> str:
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

        self.investigation.refresh_from_db()
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
                    "defaultView": "chart",
                    "queryCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

    def test_text_display_accepts_persisted_prompt_collapse(self) -> None:
        response = self.client.post(
            self.cells_url(),
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

    def test_drag_reorder_rejects_missing_deleted_and_foreign_cells_without_changes(self) -> None:
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
