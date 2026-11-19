from dataclasses import dataclass, replace
from typing import assert_type
from unittest.mock import patch

import pytest

from sentry.api.serializers import serialize
from sentry.inbox.event_data import InboxEventData
from sentry.inbox.issue import (
    ISSUE_USER_MENTIONED,
    IssueAssignedData,
    IssueAssignedDataResponse,
    IssueMentionedData,
    IssueMentionedDataResponse,
    IssuePRReadyForReviewData,
    IssuePRReadyForReviewDataResponse,
)
from sentry.inbox.notebook import (
    NOTEBOOK,
    NotebookCompletedData,
    NotebookCompletedDataResponse,
    NotebookMentionedData,
    NotebookMentionedDataResponse,
    NotebookParticipantAddedData,
)
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.serializers import InboxItemEventSerializer, InboxItemSerializer
from sentry.inbox.types import SYSTEM_ACTOR
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notebooks.models import NotebookStatus
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils.registry import NoRegistrationExistsError


@dataclass(frozen=True, kw_only=True)
class LinkedMentionData(IssueMentionedData):
    def get_url(self, subject_url: str) -> str:
        return f"{subject_url}#comment-{self.comment_id}"


@pytest.mark.parametrize(
    "latest_data",
    [
        {"comment_id": 456},
        {"comment_id": 456, "summary": "Old wording"},
    ],
)
@django_db_all
def test_latest_event_url(
    default_group: Group,
    default_user: User,
    latest_data: dict[str, int | str],
) -> None:
    item = Factories.create_inbox_item(
        organization=default_group.organization,
        user=default_user,
        subject_id=str(default_group.id),
    )
    latest = Factories.create_inbox_item_event(
        inbox_item=item, type="issue.user_mentioned", data=latest_data
    )
    previous = Factories.create_inbox_item_event(
        inbox_item=item,
        type="issue.user_mentioned",
        data={"comment_id": 123},
    )
    previous.update(date_added=before_now(minutes=5))

    with patch.dict(
        inbox_item_event_type_registry.registrations,
        {"issue.user_mentioned": replace(ISSUE_USER_MENTIONED, data_class=LinkedMentionData)},
    ):
        result = serialize(item, default_user, InboxItemSerializer())

    assert result["latestEvent"]["id"] == str(latest.id)
    organization = default_group.organization
    expected_url = organization.absolute_url(
        f"/organizations/{organization.slug}/inbox/issue/{default_group.id}/"
    )
    assert result["url"] == f"{expected_url}#comment-456"


class InboxItemSerializerTest(TestCase):
    def test_notebook_titles(self) -> None:
        first = self.create_notebook(organization=self.organization, title="First notebook")
        archived = self.create_notebook(
            organization=self.organization,
            title="Archived notebook",
            status=NotebookStatus.ARCHIVED,
        )
        other_org = self.create_notebook(
            organization=self.create_organization(), title="Another organization's notebook"
        )
        deleted = self.create_notebook(organization=self.organization, title="Deleted notebook")
        deleted_id = str(deleted.id)
        deleted.delete()

        assert inbox_item_type_registry.get("notebook") is NOTEBOOK
        assert NOTEBOOK.get_subject_id(first) == str(first.id)
        assert NOTEBOOK.get_organization_id(first) == self.organization.id
        with self.assertNumQueries(1):
            titles = NOTEBOOK.get_titles(
                organization=self.organization,
                subject_ids=[
                    str(first.id),
                    str(archived.id),
                    str(other_org.id),
                    deleted_id,
                    "invalid",
                ],
            )
        assert titles == {str(first.id): "First notebook", str(archived.id): "Archived notebook"}

        items = [
            self.create_inbox_item(subject_type="notebook", subject_id=subject_id)
            for subject_id in [str(first.id), str(archived.id), str(other_org.id), deleted_id]
        ]
        for item in items:
            self.create_inbox_item_event(
                inbox_item=item, type="notebook.participant_added", data={}
            )

        with self.assertNumQueries(3):
            results = serialize(items, self.user, InboxItemSerializer())

        assert [result["title"] for result in results] == [
            "First notebook",
            "Archived notebook",
            None,
            None,
        ]

    def test_notebook_url_without_inbox_item(self) -> None:
        notebook = self.create_notebook(organization=self.organization, title="Notebook")
        expected = self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/inbox/notebook/{notebook.id}/"
        )

        with self.assertNumQueries(0):
            assert (
                NOTEBOOK.get_url(organization=self.organization, subject_id=str(notebook.id))
                == expected
            )

    def test_bulk_summaries_and_unread_counts(self) -> None:
        first = self.create_group(project=self.project, data={"title": "First issue"})
        second = self.create_group(project=self.project, data={"title": "Second issue"})
        older = before_now(minutes=5)
        item = self.create_inbox_item(subject_id=str(first.id), last_read_at=older)
        other = self.create_inbox_item(subject_id=str(second.id))
        previous = self.create_inbox_item_event(
            inbox_item=item, data={"assignment_source": None, "activity_id": 1}
        )
        previous.update(date_added=older)
        latest = self.create_inbox_item_event(
            inbox_item=item,
            type="issue.user_mentioned",
            data={"comment_id": 123},
        )
        self.create_inbox_item_event(
            inbox_item=other, data={"assignment_source": None, "activity_id": 1}
        )

        with self.assertNumQueries(3):
            results = serialize([item, other], self.user, InboxItemSerializer())

        assert results[0]["title"] == "First issue"
        assert results[0]["subtitle"] == "Mentioned you in a comment"
        assert results[0]["eventCount"] == 2
        assert results[0]["unreadEventCount"] == 1
        assert results[0]["eventTypes"] == ["issue.user_assigned", "issue.user_mentioned"]
        assert results[0]["latestEvent"]["id"] == str(latest.id)
        assert results[0]["latestEvent"]["data"] == {"commentId": "123"}
        assert results[0]["url"] == self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/inbox/issue/{first.id}/"
        )
        assert results[1]["title"] == "Second issue"
        assert results[1]["url"] == self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/inbox/issue/{second.id}/"
        )

    def test_unregistered_event_type(self) -> None:
        item = self.create_inbox_item(subject_type="removed.type", subject_id="missing")
        self.create_inbox_item_event(inbox_item=item, type="removed.event", data={})

        with pytest.raises(NoRegistrationExistsError, match="removed.event"):
            serialize(item, self.user, InboxItemSerializer())

    def test_unregistered_subject_type(self) -> None:
        item = self.create_inbox_item(subject_type="removed.type", subject_id=str(self.group.id))
        self.create_inbox_item_event(
            inbox_item=item, data={"assignment_source": None, "activity_id": 1}
        )

        result = serialize(item, self.user, InboxItemSerializer())

        assert result["title"] is None
        assert result["url"] == self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/inbox/issue/{self.group.id}/"
        )
        assert result["subtitle"] == "Assigned to you"

    def test_deleted_subject(self) -> None:
        group = self.create_group(project=self.project)
        item = self.create_inbox_item(subject_id=str(group.id))
        self.create_inbox_item_event(
            inbox_item=item, data={"assignment_source": None, "activity_id": 1}
        )
        group.delete()

        assert serialize(item, self.user, InboxItemSerializer())["title"] is None


class TestNotebookEvents:
    @pytest.mark.parametrize(
        "event_type,data,expected_data",
        [
            (
                "notebook.completed",
                NotebookCompletedData(seer_run_id=123, generation=1),
                {"seerRunId": "123", "generation": 1},
            ),
            (
                "notebook.user_mentioned",
                NotebookMentionedData(comment_id=123),
                {"commentId": "123", "blockId": None},
            ),
            (
                "notebook.user_mentioned",
                NotebookMentionedData(comment_id=123, block_id=456),
                {"commentId": "123", "blockId": "456"},
            ),
            (
                "notebook.team_mentioned",
                NotebookMentionedData(comment_id=123),
                {"commentId": "123", "blockId": None},
            ),
            (
                "notebook.team_mentioned",
                NotebookMentionedData(comment_id=123, block_id=456),
                {"commentId": "123", "blockId": "456"},
            ),
            (
                "notebook.participant_added",
                NotebookParticipantAddedData(),
                {},
            ),
        ],
    )
    @with_feature(
        {"organizations:universal-inbox-recording": True, "organizations:universal-inbox": False}
    )
    @django_db_all
    def test_notebook_events(
        self,
        default_organization: Organization,
        default_user: User,
        event_type: str,
        data: InboxEventData,
        expected_data: dict[str, str | int | None],
    ) -> None:
        notebook = Factories.create_notebook(organization=default_organization, title="Notebook")
        event_type_definition = inbox_item_event_type_registry.get(event_type)
        assert event_type_definition.item_type is NOTEBOOK
        assert event_type_definition.data_class is type(data)

        event_type_definition.record(
            subject=notebook, data=data, recipient_user_ids=[default_user.id], actor=SYSTEM_ACTOR
        )

        item = InboxItem.objects.get()
        event = InboxItemEvent.objects.get(inbox_item=item)
        result = serialize(event, default_user, InboxItemEventSerializer())

        assert item.organization_id == default_organization.id
        assert item.subject_type == "notebook"
        assert item.subject_id == str(notebook.id)
        assert result["type"] == event_type
        assert result["summary"] == event_type_definition.summary
        assert result["data"] == expected_data


class InboxItemEventSerializerTest(TestCase):
    def test_missing_required_payload_fields_are_broken_data(self) -> None:
        event = self.create_inbox_item_event(
            inbox_item=self.create_inbox_item(),
            type="notebook.completed",
            data={"seer_run_id": 123},
        )

        with pytest.raises(TypeError, match="generation"):
            InboxItemEventSerializer().serialize(event, {}, self.user)

    def test_summary_comes_from_event_definition(self) -> None:
        item = self.create_inbox_item()
        for payload in ({"comment_id": 123}, {"comment_id": 123, "summary": "Old wording"}):
            event = self.create_inbox_item_event(
                inbox_item=item, type="issue.user_mentioned", data=payload
            )

            result = serialize(event, self.user, InboxItemEventSerializer())

            assert result["summary"] == "Mentioned you in a comment"
            assert result["data"] == {"commentId": "123"}

    def test_bulk_parent_loading(self) -> None:
        read_at = before_now(minutes=1)
        read_item = self.create_inbox_item(subject_id="1", last_read_at=read_at)
        unread_item = self.create_inbox_item(subject_id="2")
        read_event = self.create_inbox_item_event(
            inbox_item=read_item, data={"assignment_source": None, "activity_id": 1}
        )
        read_event.update(date_added=read_at)
        unread_event = self.create_inbox_item_event(
            inbox_item=unread_item, data={"assignment_source": None, "activity_id": 1}
        )
        events = list(
            InboxItemEvent.objects.filter(id__in=[read_event.id, unread_event.id]).order_by("id")
        )

        with self.assertNumQueries(1):
            results = serialize(events, self.user, InboxItemEventSerializer())

        assert [event["isUnread"] for event in results] == [False, True]

        with self.assertNumQueries(0):
            serialize(events, self.user, InboxItemEventSerializer())

    def test_bulk_actor_resolution(self) -> None:
        item = self.create_inbox_item(last_read_at=before_now(minutes=1))
        actor = self.create_user(name="Example User")
        first = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            data={"assignment_source": None, "activity_id": 1},
        )
        first.update(date_added=before_now(minutes=5))
        second = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            type="issue.pr_ready_for_review",
            data={"pr_url": "https://example.com/pr/1", "seer_run_id": 12},
        )
        system = self.create_inbox_item_event(
            inbox_item=item, data={"assignment_source": None, "activity_id": 1}
        )

        with patch.object(
            user_service,
            "serialize_many",
            return_value=[{"id": str(actor.id), "name": "Example User", "avatar": None}],
        ) as users:
            results = serialize([first, second, system], self.user, InboxItemEventSerializer())

        assert users.call_count == 1
        assert results[0]["actor"]["name"] == "Example User"
        assert results[0]["actor"]["id"] == str(actor.id)
        assert results[0]["isUnread"] is False
        assert results[1]["isUnread"] is True
        assert results[1]["data"] == {"prUrl": "https://example.com/pr/1", "seerRunId": "12"}
        assert results[2]["actor"] == {
            "type": "system",
            "id": None,
            "name": "Sentry",
            "avatar": None,
        }

    def test_missing_user_actor(self) -> None:
        item = self.create_inbox_item()
        actor = self.create_user()
        event = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            data={"assignment_source": None, "activity_id": 1},
        )

        with patch.object(user_service, "serialize_many", return_value=[]):
            result = serialize(event, self.user, InboxItemEventSerializer())

        assert result["actor"] == {
            "type": "user",
            "id": str(actor.id),
            "name": "A former member",
            "avatar": None,
        }


@pytest.mark.parametrize(
    "event_type,data,expected_data",
    [
        (
            "issue.user_assigned",
            {"activity_id": 0, "assignment_source": None},
            {"activityId": "0", "assignmentSource": None},
        ),
        (
            "issue.team_assigned",
            {"activity_id": 123, "assignment_source": "slack"},
            {"activityId": "123", "assignmentSource": "slack"},
        ),
        (
            "issue.user_mentioned",
            {"comment_id": 123, "external_id": 789, "summary": "Old wording"},
            {"commentId": "123"},
        ),
        (
            "issue.team_mentioned",
            {"comment_id": "123"},
            {"commentId": "123"},
        ),
        (
            "issue.pr_ready_for_review",
            {"seer_run_id": 456, "pr_url": "https://example.com/pr/1"},
            {"seerRunId": "456", "prUrl": "https://example.com/pr/1"},
        ),
        (
            "notebook.user_mentioned",
            {"comment_id": 123},
            {"commentId": "123", "blockId": None},
        ),
        (
            "notebook.participant_added",
            {"activity_id": 123},
            {},
        ),
    ],
    ids=[
        "zero-id",
        "assignment-source",
        "unknown-fields",
        "string-id",
        "pull-request",
        "default-block-id",
        "empty-payload",
    ],
)
@django_db_all
def test_stored_payload_serialization(
    default_user: User,
    default_organization: Organization,
    event_type: str,
    data: dict[str, str | int | None],
    expected_data: dict[str, str | int | None],
) -> None:
    item = Factories.create_inbox_item(organization=default_organization, user=default_user)
    original_data = data.copy()
    event = Factories.create_inbox_item_event(
        inbox_item=item,
        type=event_type,
        data=data,
    )

    result = serialize(event, default_user, InboxItemEventSerializer())

    assert result["data"] == expected_data
    assert event.data == original_data


def test_payload_response_types() -> None:
    assert_type(
        IssueAssignedData(assignment_source=ActivityIntegration.SLACK, activity_id=123).serialize(),
        IssueAssignedDataResponse,
    )
    assert_type(IssueMentionedData(comment_id=123).serialize(), IssueMentionedDataResponse)
    assert_type(
        IssuePRReadyForReviewData(pr_url="https://example.com/pr/1", seer_run_id=123).serialize(),
        IssuePRReadyForReviewDataResponse,
    )
    assert_type(
        NotebookCompletedData(seer_run_id=123, generation=2).serialize(),
        NotebookCompletedDataResponse,
    )
    assert_type(NotebookMentionedData(comment_id=123).serialize(), NotebookMentionedDataResponse)
