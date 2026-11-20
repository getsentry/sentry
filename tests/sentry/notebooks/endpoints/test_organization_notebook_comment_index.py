from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

from sentry.notebooks.models import NotebookComment, NotebookStatus
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationNotebookCommentsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.block = self.create_notebook_block(notebook=self.notebook)
        self.url = reverse(
            "sentry-api-0-organization-notebook-comments",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": self.notebook.id,
            },
        )

    def test_create_page_comment(self) -> None:
        response = self.client.post(self.url, data={"body": "Looks like a deploy"}, format="json")

        assert response.status_code == 201, response.data
        assert response.data["body"] == "Looks like a deploy"
        assert response.data["blockId"] is None
        assert response.data["author"]["id"] == str(self.user.id)
        comment = NotebookComment.objects.get(id=response.data["id"])
        assert comment.notebook_id == self.notebook.id
        assert comment.author_id == self.user.id
        assert response.data["mentions"] == []

    @with_feature("organizations:universal-inbox-recording")
    def test_create_with_mentions(self) -> None:
        mentioned = self.create_user()
        team = self.create_team(organization=self.organization, members=[self.user, mentioned])

        response = self.client.post(
            self.url,
            data={
                "body": "Please take a look",
                "mentions": [f"user:{mentioned.id}", f"team:{team.id}"],
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        comment = NotebookComment.objects.get(id=response.data["id"])
        assert comment.mentions == [
            {"id": mentioned.id, "actor_type": "User", "slug": None},
            {"id": team.id, "actor_type": "Team", "slug": None},
        ]
        assert response.data["mentions"] == comment.mentions
        events = InboxItemEvent.objects.order_by("type")
        assert list(events.values_list("type", "inbox_item__user_id")) == [
            ("notebook.team_mentioned", mentioned.id),
            ("notebook.user_mentioned", mentioned.id),
        ]
        for event in events:
            assert event.actor_id == self.user.id
            assert event.data == {"comment_id": comment.id, "block_id": None}
            assert event.inbox_item.subject_id == str(self.notebook.id)
        assert self.client.get(self.url).data[0]["mentions"] == comment.mentions

    @with_feature({"organizations:universal-inbox-recording": False})
    def test_mentions_with_recording_disabled(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned)

        response = self.client.post(
            self.url,
            data={"body": "Please take a look", "mentions": [f"user:{mentioned.id}"]},
            format="json",
        )

        assert response.status_code == 201, response.data
        comment = NotebookComment.objects.get(id=response.data["id"])
        assert comment.mentions == [{"id": mentioned.id, "actor_type": "User", "slug": None}]
        assert not InboxItemEvent.objects.exists()

    def test_empty_mention(self) -> None:
        response = self.client.post(self.url, data={"body": "Hi", "mentions": [""]}, format="json")

        assert response.status_code == 400
        assert "mentions" in response.data
        assert not NotebookComment.objects.exists()

    def test_mention_user_outside_organization(self) -> None:
        other_org = self.create_organization()
        other_user = self.create_user()
        self.create_member(organization=other_org, user=other_user)

        response = self.client.post(
            self.url, data={"body": "Hi", "mentions": [f"user:{other_user.id}"]}, format="json"
        )

        assert response.status_code == 400
        assert "mentions" in response.data
        assert not NotebookComment.objects.exists()

    def test_mention_team_outside_organization(self) -> None:
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)

        response = self.client.post(
            self.url, data={"body": "Hi", "mentions": [f"team:{other_team.id}"]}, format="json"
        )

        assert response.status_code == 400
        assert "mentions" in response.data
        assert not NotebookComment.objects.exists()

    @with_feature("organizations:universal-inbox-recording")
    def test_create_block_comment(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned)
        response = self.client.post(
            self.url,
            data={
                "body": "This query is wrong",
                "blockId": self.block.id,
                "mentions": [f"user:{mentioned.id}"],
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["blockId"] == str(self.block.id)
        assert InboxItemEvent.objects.get().data == {
            "comment_id": int(response.data["id"]),
            "block_id": self.block.id,
        }

    def test_create_rejects_a_block_from_another_notebook(self) -> None:
        other = self.create_notebook(organization=self.organization, title="Other")
        other_block = self.create_notebook_block(notebook=other)

        response = self.client.post(
            self.url, data={"body": "Hi", "blockId": other_block.id}, format="json"
        )

        assert response.status_code == 400
        assert "blockId" in response.data

    def test_create_rejects_a_deleted_block(self) -> None:
        self.block.update(deleted_at=timezone.now())

        response = self.client.post(
            self.url, data={"body": "Hi", "blockId": self.block.id}, format="json"
        )

        assert response.status_code == 400

    def test_create_rejects_a_blank_body(self) -> None:
        response = self.client.post(self.url, data={"body": "   "}, format="json")

        assert response.status_code == 400
        assert "body" in response.data

    def test_create_rejects_unknown_fields(self) -> None:
        response = self.client.post(self.url, data={"body": "Hi", "author": 1}, format="json")

        assert response.status_code == 400

    def test_archived_notebook_is_read_only(self) -> None:
        self.notebook.update(status=NotebookStatus.ARCHIVED)

        response = self.client.post(self.url, data={"body": "Hi"}, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Archived investigations are read-only."}

    def test_list_is_newest_first(self) -> None:
        first = self.create_notebook_comment(notebook=self.notebook, author=self.user, body="first")
        second = self.create_notebook_comment(
            notebook=self.notebook, author=self.user, block=self.block, body="second"
        )

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert [c["id"] for c in response.data] == [str(second.id), str(first.id)]

    def test_list_hides_comments_on_a_deleted_block(self) -> None:
        page_comment = self.create_notebook_comment(notebook=self.notebook, author=self.user)
        self.create_notebook_comment(notebook=self.notebook, author=self.user, block=self.block)
        self.block.update(deleted_at=timezone.now())

        response = self.client.get(self.url)

        assert [c["id"] for c in response.data] == [str(page_comment.id)]

    def test_list_filters_by_block(self) -> None:
        self.create_notebook_comment(notebook=self.notebook, author=self.user)
        block_comment = self.create_notebook_comment(
            notebook=self.notebook, author=self.user, block=self.block
        )

        response = self.client.get(self.url, {"blockId": self.block.id})

        assert [c["id"] for c in response.data] == [str(block_comment.id)]

    def test_list_rejects_an_invalid_block_id(self) -> None:
        response = self.client.get(self.url, {"blockId": "abc"})

        assert response.status_code == 400

    def test_list_keeps_comments_of_a_deleted_author(self) -> None:
        self.create_notebook_comment(notebook=self.notebook, author=None)

        response = self.client.get(self.url)

        assert response.data[0]["author"] is None

    def test_other_organization_cannot_read(self) -> None:
        other_org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-notebook-comments",
            kwargs={
                "organization_id_or_slug": other_org.slug,
                "notebook_id": self.notebook.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code in (403, 404)
