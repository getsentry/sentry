from sentry.notifications.notifications.digest_types import NotificationSerializedEvent
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.testutils.cases import TestCase


class TestSerializedEvent(TestCase):
    def _get_event(self) -> Event:
        return self.store_event(data={"message": "oh no"}, project_id=self.project.id)

    def _get_group_event(self) -> GroupEvent:
        return self.store_group_event(data={"message": "oh no"}, project_id=self.project.id)

    def test_basic_serialization(self) -> None:
        event = self._get_event()
        serialized = NotificationSerializedEvent.from_event(event)
        # validate that JSON serialization works as intended
        serialized.json()

        assert serialized.project_id == event.project_id
        assert serialized.event_id == event.event_id
        assert serialized.datetime == event.datetime
        assert serialized.title == event.title
        assert serialized.culprit == event.culprit
        assert serialized.transaction == event.transaction
        assert serialized.platform == event.platform
        assert serialized.message == event.message
        assert serialized.tags == event.tags
        assert serialized.data == event.data

    def test_serialization_equality(self) -> None:
        event = self._get_event()
        serialized = NotificationSerializedEvent.from_event(event)
        assert serialized == NotificationSerializedEvent.from_event(event)
