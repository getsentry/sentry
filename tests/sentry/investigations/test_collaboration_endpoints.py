from __future__ import annotations

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationCellComment,
    InvestigationCellReaction,
    InvestigationCommentReaction,
    InvestigationCommentTeamMention,
    InvestigationCommentUserMention,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationCollaborationEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Discussion",
        )
        self.create_investigation_permissions(
            investigation=self.investigation, is_editable_by_everyone=False
        )
        self.cell = self.create_investigation_cell(
            investigation=self.investigation,
            position=0,
            kind="text",
            content="A hypothesis",
        )
        self.commenter = self.create_user()
        self.create_member(organization=self.organization, user=self.commenter, role="member")
        self.team = self.create_team(organization=self.organization)
        self.login_as(self.commenter)

    def comments_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-comments",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
            },
        )

    def comment_url(self, comment: InvestigationCellComment) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-comment-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "comment_uuid": comment.uuid,
            },
        )

    def test_non_editor_can_comment_with_recorded_mentions(self) -> None:
        response = self.client.post(
            self.comments_url(),
            data={
                "body": "Please review this",
                "mentions": [f"user:{self.user.id}", f"team:{self.team.id}"],
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        comment = InvestigationCellComment.objects.get(uuid=response.data["id"])
        assert comment.author_id == self.commenter.id
        assert InvestigationCommentUserMention.objects.filter(
            comment=comment, user_id=self.user.id
        ).exists()
        assert InvestigationCommentTeamMention.objects.filter(
            comment=comment, team=self.team
        ).exists()
        assert {mention["type"] for mention in response.data["mentions"]} == {"user", "team"}

    def test_comments_are_linear_and_author_can_edit(self) -> None:
        first = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="First"
        )
        second = self.create_investigation_cell_comment(
            cell=self.cell, author=self.user, body="Second"
        )
        response = self.client.get(self.comments_url())
        assert [comment["id"] for comment in response.data] == [
            str(first.uuid),
            str(second.uuid),
        ]

        response = self.client.put(
            self.comment_url(first), data={"body": "Edited", "mentions": []}, format="json"
        )
        assert response.status_code == 200
        assert response.data["body"] == "Edited"

        response = self.client.put(
            self.comment_url(second), data={"body": "Not mine"}, format="json"
        )
        assert response.status_code == 403

    def test_comment_soft_delete_removes_mentions_and_reactions(self) -> None:
        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Delete me"
        )
        self.create_investigation_comment_user_mention(comment=comment, user=self.user)
        self.create_investigation_comment_reaction(
            comment=comment, user=self.user, reaction="heart"
        )
        response = self.client.delete(self.comment_url(comment))
        assert response.status_code == 204
        comment.refresh_from_db()
        assert comment.deleted_at is not None
        assert not comment.user_mentions.exists()
        assert not comment.reactions.exists()

    def test_edit_replaces_mentions_transactionally(self) -> None:
        response = self.client.post(
            self.comments_url(),
            data={"body": "First", "mentions": [f"user:{self.user.id}"]},
            format="json",
        )
        comment = InvestigationCellComment.objects.get(uuid=response.data["id"])
        response = self.client.put(
            self.comment_url(comment),
            data={"body": "Second", "mentions": [f"team:{self.team.id}"]},
            format="json",
        )
        assert response.status_code == 200
        assert not comment.user_mentions.exists()
        assert list(comment.team_mentions.values_list("team_id", flat=True)) == [self.team.id]

        outside_user = self.create_user()
        response = self.client.put(
            self.comment_url(comment),
            data={"body": "Must roll back", "mentions": [f"user:{outside_user.id}"]},
            format="json",
        )
        assert response.status_code == 400
        comment.refresh_from_db()
        assert comment.body == "Second"
        assert list(comment.team_mentions.values_list("team_id", flat=True)) == [self.team.id]

    def test_cell_and_comment_reactions_are_idempotent(self) -> None:
        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="React"
        )
        cell_reaction_url = reverse(
            "sentry-api-0-organization-investigation-cell-reaction",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
                "reaction": "heart",
            },
        )
        comment_reaction_url = reverse(
            "sentry-api-0-organization-investigation-comment-reaction",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "comment_uuid": comment.uuid,
                "reaction": "eyes",
            },
        )
        assert self.client.put(cell_reaction_url).status_code == 204
        assert self.client.put(cell_reaction_url).status_code == 204
        assert self.client.put(comment_reaction_url).status_code == 204
        assert InvestigationCellReaction.objects.count() == 1
        assert InvestigationCommentReaction.objects.count() == 1

        assert self.client.delete(cell_reaction_url).status_code == 204
        assert self.client.delete(cell_reaction_url).status_code == 204
        assert InvestigationCellReaction.objects.count() == 0

    def test_reaction_counts_and_reacted_by_me_are_returned(self) -> None:
        self.create_investigation_cell_reaction(
            cell=self.cell, user=self.commenter, reaction="heart"
        )
        self.create_investigation_cell_reaction(cell=self.cell, user=self.user, reaction="heart")
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        response = self.client.get(url)
        assert response.data["cells"][0]["reactions"] == [
            {"reaction": "heart", "count": 2, "reactedByMe": True}
        ]

    def test_detail_returns_only_active_comment_count(self) -> None:
        self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Visible"
        )
        deleted = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Deleted"
        )
        deleted.deleted_at = timezone.now()
        deleted.save(update_fields=["deleted_at"])
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["cells"][0]["commentCount"] == 1

    def test_detail_comment_counts_do_not_add_queries_per_cell(self) -> None:
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
            },
        )
        self.client.get(detail_url)
        with CaptureQueriesContext(connection) as sparse_queries:
            assert self.client.get(detail_url).status_code == 200

        for position in range(1, 6):
            cell = self.create_investigation_cell(
                investigation=self.investigation, position=position, kind="text"
            )
            self.create_investigation_cell_comment(
                cell=cell, author=self.commenter, body=f"Comment {position}"
            )
            self.create_investigation_cell_reaction(
                cell=cell, user=self.commenter, reaction="heart"
            )

        with CaptureQueriesContext(connection) as dense_queries:
            response = self.client.get(detail_url)

        assert response.status_code == 200
        assert [cell["commentCount"] for cell in response.data["cells"]] == [0, 1, 1, 1, 1, 1]
        assert len(dense_queries) <= len(sparse_queries) + 1

    def test_invalid_mentions_and_reactions_are_rejected(self) -> None:
        outside_user = self.create_user()
        response = self.client.post(
            self.comments_url(),
            data={"body": "No", "mentions": [f"user:{outside_user.id}"]},
            format="json",
        )
        assert response.status_code == 400

        url = reverse(
            "sentry-api-0-organization-investigation-cell-reaction",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
                "reaction": "fire",
            },
        )
        assert self.client.put(url).status_code == 400

    def test_api_key_only_request_cannot_collaborate(self) -> None:
        api_key = self.create_api_key(self.organization, scope_list=["org:read", "org:write"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
        response = self.client.post(
            self.comments_url(),
            data={"body": "No machine authors"},
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )
        assert response.status_code == 403
        reaction_url = reverse(
            "sentry-api-0-organization-investigation-cell-reaction",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
                "reaction": "heart",
            },
        )
        response = self.client.put(
            reaction_url,
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )
        assert response.status_code == 403
        assert not InvestigationCellReaction.objects.exists()

    def test_archived_investigation_rejects_collaboration(self) -> None:
        self.investigation.status = "archived"
        self.investigation.save()
        response = self.client.post(self.comments_url(), data={"body": "Too late"}, format="json")
        assert response.status_code == 400

        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Existing"
        )
        assert self.client.delete(self.comment_url(comment)).status_code == 400

    def test_deleted_cell_rejects_comments_and_reactions(self) -> None:
        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Existing"
        )
        self.cell.deleted_at = timezone.now()
        self.cell.save(update_fields=["deleted_at"])
        response = self.client.post(self.comments_url(), data={"body": "Too late"}, format="json")
        assert response.status_code == 400
        reaction_url = reverse(
            "sentry-api-0-organization-investigation-comment-reaction",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "comment_uuid": comment.uuid,
                "reaction": "eyes",
            },
        )
        assert self.client.put(reaction_url).status_code == 400
        assert self.client.delete(self.comment_url(comment)).status_code == 400

    def test_manager_may_delete_but_not_rewrite_another_users_comment(self) -> None:
        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Member comment"
        )
        manager = self.create_user()
        self.create_member(organization=self.organization, user=manager, role="manager")
        self.login_as(manager)
        response = self.client.put(
            self.comment_url(comment), data={"body": "Manager rewrite"}, format="json"
        )
        assert response.status_code == 403
        assert self.client.delete(self.comment_url(comment)).status_code == 204
        comment.refresh_from_db()
        assert comment.deleted_at is not None

    def test_comment_lookup_is_scoped_to_nested_investigation(self) -> None:
        comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.commenter, body="Nested"
        )
        other = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Other"
        )
        self.create_investigation_permissions(investigation=other)
        url = reverse(
            "sentry-api-0-organization-investigation-comment-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": other.uuid,
                "comment_uuid": comment.uuid,
            },
        )
        assert self.client.delete(url).status_code == 404
