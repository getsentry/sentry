from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationCommentCountsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.url = reverse(
            "sentry-api-0-organization-investigation-comment-counts",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_counts_comments_per_block(self) -> None:
        commented = self.create_notebook_block(notebook=self.investigation)
        other = self.create_notebook_block(notebook=self.investigation)
        self.create_notebook_block(notebook=self.investigation)
        for _ in range(2):
            self.create_notebook_comment(notebook=self.investigation, block=commented)
        self.create_notebook_comment(notebook=self.investigation, block=other)
        self.create_notebook_comment(notebook=self.investigation)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {str(commented.id): 2, str(other.id): 1}

    def test_leaves_out_deleted_blocks(self) -> None:
        block = self.create_notebook_block(notebook=self.investigation)
        self.create_notebook_comment(notebook=self.investigation, block=block)
        block.update(deleted_at=timezone.now())

        assert self.client.get(self.url).data == {}

    def test_ignores_other_investigations(self) -> None:
        other = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Other"
        )
        block = self.create_notebook_block(notebook=other)
        self.create_notebook_comment(notebook=other, block=block)

        assert self.client.get(self.url).data == {}

    def test_investigation_from_another_organization_is_not_found(self) -> None:
        foreign = self.create_notebook(
            organization=self.create_organization(), created_by=self.user, title="Foreign"
        )
        url = reverse(
            "sentry-api-0-organization-investigation-comment-counts",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": foreign.id,
            },
        )

        assert self.client.get(url).status_code == 404
