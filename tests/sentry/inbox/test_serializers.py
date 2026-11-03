from unittest.mock import patch

from sentry.api.serializers import serialize
from sentry.inbox.serializers import InboxItemEventSerializer, InboxItemSerializer
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.users.services.user.service import user_service


class InboxItemSerializerTest(TestCase):
    def test_bulk_summaries_and_unread_counts(self) -> None:
        first = self.create_group(project=self.project, data={"title": "First issue"})
        second = self.create_group(project=self.project, data={"title": "Second issue"})
        older = before_now(minutes=5)
        item = self.create_inbox_item(subject_id=str(first.id), last_read_at=older)
        other = self.create_inbox_item(subject_id=str(second.id))
        previous = self.create_inbox_item_event(
            inbox_item=item, data={"summary": "Assigned to you"}
        )
        previous.update(date_added=older)
        latest = self.create_inbox_item_event(
            inbox_item=item,
            type="issue.mentioned",
            data={"summary": "Mentioned you", "comment_id": 123},
        )
        self.create_inbox_item_event(inbox_item=other, data={"summary": "Assigned to you"})

        with self.assertNumQueries(3):
            results = serialize([item, other], self.user, InboxItemSerializer())

        assert results[0]["title"] == "First issue"
        assert results[0]["subtitle"] == "Mentioned you"
        assert results[0]["eventCount"] == 2
        assert results[0]["unreadEventCount"] == 1
        assert results[0]["eventTypes"] == ["issue.assigned", "issue.mentioned"]
        assert results[0]["latestEvent"]["id"] == str(latest.id)
        assert results[0]["latestEvent"]["data"] == {"commentId": "123"}
        assert results[1]["title"] == "Second issue"

    def test_missing_subject_and_unregistered_types(self) -> None:
        item = self.create_inbox_item(subject_type="removed.type", subject_id="missing")
        self.create_inbox_item_event(
            inbox_item=item, type="removed.event", data={"summary": "A retained event"}
        )

        result = serialize(item, self.user, InboxItemSerializer())

        assert result["title"] is None
        assert result["subtitle"] == "A retained event"
        assert result["latestEvent"]["type"] == "removed.event"

    def test_deleted_subject(self) -> None:
        group = self.create_group(project=self.project)
        item = self.create_inbox_item(subject_id=str(group.id))
        self.create_inbox_item_event(inbox_item=item, data={"summary": "Assigned to you"})
        group.delete()

        assert serialize(item, self.user, InboxItemSerializer())["title"] is None


class InboxItemEventSerializerTest(TestCase):
    def test_bulk_parent_loading(self) -> None:
        read_at = before_now(minutes=1)
        read_item = self.create_inbox_item(subject_id="1", last_read_at=read_at)
        unread_item = self.create_inbox_item(subject_id="2")
        read_event = self.create_inbox_item_event(
            inbox_item=read_item, data={"summary": "Read event"}
        )
        read_event.update(date_added=read_at)
        unread_event = self.create_inbox_item_event(
            inbox_item=unread_item, data={"summary": "Unread event"}
        )
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
                "summary": "A retained event",
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
            data={"summary": "An assignment"},
        )
        first.update(date_added=before_now(minutes=5))
        second = self.create_inbox_item_event(
            inbox_item=item,
            actor=actor,
            type="issue.pr_ready_for_review",
            data={"summary": "PR ready", "pr_url": "https://example.com/pr/1", "seer_run_id": 12},
        )
        system = self.create_inbox_item_event(inbox_item=item, data={"summary": "A system event"})

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
            data={"summary": "A retained event"},
        )

        with patch.object(user_service, "serialize_many", return_value=[]):
            result = serialize(event, self.user, InboxItemEventSerializer())

        assert result["actor"] == {
            "type": "user",
            "id": str(actor.id),
            "name": "A former member",
            "avatar": None,
        }
