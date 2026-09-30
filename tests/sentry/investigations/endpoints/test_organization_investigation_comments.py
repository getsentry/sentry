from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationCommentsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.block = self.create_investigation_block(investigation=self.investigation)
        self.url = reverse(
            "sentry-api-0-organization-investigation-comments",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_list_is_newest_first(self) -> None:
        first = self.create_investigation_comment(
            investigation=self.investigation, author=self.user, body="first"
        )
        second = self.create_investigation_comment(
            investigation=self.investigation, author=self.user, block=self.block, body="second"
        )

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert [c["id"] for c in response.data] == [str(second.id), str(first.id)]

    def test_list_hides_comments_on_a_deleted_block(self) -> None:
        page_comment = self.create_investigation_comment(
            investigation=self.investigation, author=self.user
        )
        self.create_investigation_comment(
            investigation=self.investigation, author=self.user, block=self.block
        )
        self.block.update(deleted_at=timezone.now())

        response = self.client.get(self.url)

        assert [c["id"] for c in response.data] == [str(page_comment.id)]

    def test_list_filters_by_block(self) -> None:
        self.create_investigation_comment(investigation=self.investigation, author=self.user)
        block_comment = self.create_investigation_comment(
            investigation=self.investigation, author=self.user, block=self.block
        )

        response = self.client.get(self.url, {"blockId": self.block.id})

        assert [c["id"] for c in response.data] == [str(block_comment.id)]

    def test_list_rejects_an_invalid_block_id(self) -> None:
        response = self.client.get(self.url, {"blockId": "abc"})

        assert response.status_code == 400

    def test_list_keeps_comments_of_a_deleted_author(self) -> None:
        self.create_investigation_comment(investigation=self.investigation, author=None)

        response = self.client.get(self.url)

        assert response.data[0]["author"] is None

    def test_other_organization_cannot_read(self) -> None:
        other_org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-investigation-comments",
            kwargs={
                "organization_id_or_slug": other_org.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code in (403, 404)
