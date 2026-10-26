from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationBlockOrderEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Block tests",
        )

    def order_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-block-order",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_drag_reorder_requires_exact_permutation(self) -> None:
        blocks = [
            self.create_investigation_block(
                investigation=self.investigation, position=position, kind="text"
            )
            for position in range(3)
        ]
        url = self.order_url()
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
        url = self.order_url()

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

    def test_sentry_app_cannot_reorder_blocks(self) -> None:
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

        response = self.client.put(
            self.order_url(),
            data={
                "investigationVersion": self.investigation.version,
                "blockIds": [second.id, first.id],
            },
            format="json",
        )
        assert response.status_code == 403

        first.refresh_from_db()
        second.refresh_from_db()
        assert (first.position, second.position) == (0, 1)
