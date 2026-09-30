from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import InvestigationComment, InvestigationStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationCommentDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.comment = self.create_investigation_comment(
            investigation=self.investigation, author=self.user, body="before"
        )
        self.member = self.create_user()
        self.create_member(organization=self.organization, user=self.member, role="member")

    def url(self, comment_id: int | str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-comment-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "comment_id": comment_id,
            },
        )

    def test_author_can_edit(self) -> None:
        response = self.client.put(self.url(self.comment.id), data={"body": "after"}, format="json")

        assert response.status_code == 200, response.data
        assert response.data["body"] == "after"
        self.comment.refresh_from_db()
        assert self.comment.body == "after"

    def test_other_member_cannot_edit(self) -> None:
        self.login_as(self.member)

        response = self.client.put(self.url(self.comment.id), data={"body": "after"}, format="json")

        assert response.status_code == 403

    def test_edit_rejects_a_blank_body(self) -> None:
        response = self.client.put(self.url(self.comment.id), data={"body": ""}, format="json")

        assert response.status_code == 400

    def test_author_can_delete(self) -> None:
        response = self.client.delete(self.url(self.comment.id))

        assert response.status_code == 204
        assert not InvestigationComment.objects.filter(id=self.comment.id).exists()

    def test_other_member_cannot_delete(self) -> None:
        self.login_as(self.member)

        response = self.client.delete(self.url(self.comment.id))

        assert response.status_code == 403
        assert InvestigationComment.objects.filter(id=self.comment.id).exists()

    def test_manager_cannot_delete_another_users_comment(self) -> None:
        manager = self.create_user()
        self.create_member(organization=self.organization, user=manager, role="manager")
        self.login_as(manager)

        response = self.client.delete(self.url(self.comment.id))

        assert response.status_code == 403

    def test_comment_from_another_investigation_is_not_found(self) -> None:
        other = self.create_investigation(organization=self.organization, title="Other")
        comment = self.create_investigation_comment(investigation=other, author=self.user)

        assert self.client.delete(self.url(comment.id)).status_code == 404
        assert InvestigationComment.objects.filter(id=comment.id).exists()

    def test_archived_investigation_is_read_only(self) -> None:
        self.investigation.update(status=InvestigationStatus.ARCHIVED)

        response = self.client.put(self.url(self.comment.id), data={"body": "after"}, format="json")
        assert response.status_code == 400
        assert self.client.delete(self.url(self.comment.id)).status_code == 400
