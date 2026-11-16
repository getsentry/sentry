from unittest.mock import patch

import pytest

from sentry.api.serializers import serialize
from sentry.inbox.notebook import (
    NOTEBOOK,
    NotebookCompletedData,
    NotebookMentionedData,
    NotebookParticipantAddedData,
)
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.serializers import InboxItemEventSerializer, InboxItemSerializer
from sentry.inbox.types import SYSTEM_ACTOR, InboxEventData
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
        expected = notebook.get_absolute_url()

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
        previous = self.create_inbox_item_event(inbox_item=item, data={})
        previous.update(date_added=older)
        latest = self.create_inbox_item_event(
            inbox_item=item,
            type="issue.user_mentioned",
            data={"comment_id": 123},
        )
        self.create_inbox_item_event(inbox_item=other, data={})

        with self.assertNumQueries(3):
            results = serialize([item, other], self.user, InboxItemSerializer())

        assert results[0]["title"] == "First issue"
        assert results[0]["subtitle"] == "Mentioned you in a comment"
        assert results[0]["eventCount"] == 2
        assert results[0]["unreadEventCount"] == 1
        assert results[0]["eventTypes"] == ["issue.user_assigned", "issue.user_mentioned"]
        assert results[0]["latestEvent"]["id"] == str(latest.id)
        assert results[0]["latestEvent"]["data"] == {"commentId": "123"}
        assert results[1]["title"] == "Second issue"

    def test_unregistered_event_type(self) -> None:
        item = self.create_inbox_item(subject_type="removed.type", subject_id="missing")
        self.create_inbox_item_event(inbox_item=item, type="removed.event", data={})

        with pytest.raises(NoRegistrationExistsError, match="removed.event"):
            serialize(item, self.user, InboxItemSerializer())

    def test_unregistered_subject_type(self) -> None:
        item = self.create_inbox_item(subject_type="removed.type", subject_id="missing")
        self.create_inbox_item_event(inbox_item=item)

        result = serialize(item, self.user, InboxItemSerializer())

        assert result["title"] is None
        assert result["subtitle"] == "Assigned to you"

    def test_deleted_subject(self) -> None:
        group = self.create_group(project=self.project)
        item = self.create_inbox_item(subject_id=str(group.id))
        self.create_inbox_item_event(inbox_item=item, data={})
        group.delete()

        assert serialize(item, self.user, InboxItemSerializer())["title"] is None


class TestNotebookEvents:
    @pytest.mark.parametrize(
        "event_type,data,expected_data",
        [
            (
                "notebook.completed",
                NotebookCompletedData(seer_run_id=123),
                {"seerRunId": "123"},
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
        expected_data: dict[str, str | None],
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
        read_event = self.create_inbox_item_event(inbox_item=read_item, data={})
        read_event.update(date_added=read_at)
        unread_event = self.create_inbox_item_event(inbox_item=unread_item, data={})
        events = list(
            InboxItemEvent.objects.filter(id__in=[read_event.id, unread_event.id]).order_by("id")
        )

        with self.assertNumQueries(1):
            results = serialize(events, self.user, InboxItemEventSerializer())

        assert [event["isUnread"] for event in results] == [False, True]

        with self.assertNumQueries(0):
            serialize(events, self.user, InboxItemEventSerializer())

    def test_payload_id_conversion(self) -> None:
        item = self.create_inbox_item()
        event = self.create_inbox_item_event(
            inbox_item=item,
            data={
                "comment_id": 123,
                "seer_run_id": 456,
                "external_id": 789,
                "optional_id": None,
            },
        )

        result = serialize(event, self.user, InboxItemEventSerializer())

        assert result["data"] == {
            "commentId": "123",
            "seerRunId": "456",
            "externalId": 789,
            "optionalId": None,
        }
        assert event.data["comment_id"] == 123
        assert event.data["seer_run_id"] == 456

    def test_bulk_actor_resolution(self) -> None:
        item = self.create_inbox_item(last_read_at=before_now(minutes=1))
        actor = self.create_user(name="Example User")
        first = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            data={},
        )
        first.update(date_added=before_now(minutes=5))
        second = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            type="issue.pr_ready_for_review",
            data={"pr_url": "https://example.com/pr/1", "seer_run_id": 12},
        )
        system = self.create_inbox_item_event(inbox_item=item, data={})

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
            data={},
        )

        with patch.object(user_service, "serialize_many", return_value=[]):
            result = serialize(event, self.user, InboxItemEventSerializer())

        assert result["actor"] == {
            "type": "user",
            "id": str(actor.id),
            "name": "A former member",
            "avatar": None,
        }
