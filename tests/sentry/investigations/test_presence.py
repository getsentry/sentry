from datetime import timedelta

from django.utils import timezone

from sentry.investigations.presence import PRESENCE_WINDOW, record_heartbeat
from sentry.testutils.cases import TestCase


class RecordHeartbeatTest(TestCase):
    def test_first_heartbeat_is_not_present(self) -> None:
        heartbeat = record_heartbeat(investigation_id=1, user_id=10)

        assert heartbeat.was_present is False
        assert [uid for uid, _ in heartbeat.active] == [10]

    def test_second_heartbeat_is_present(self) -> None:
        now = timezone.now()
        record_heartbeat(investigation_id=1, user_id=10, now=now)

        heartbeat = record_heartbeat(investigation_id=1, user_id=10, now=now + timedelta(seconds=5))

        assert heartbeat.was_present is True
        assert [uid for uid, _ in heartbeat.active] == [10]

    def test_viewers_most_recent_first(self) -> None:
        now = timezone.now()
        record_heartbeat(investigation_id=1, user_id=10, now=now)
        record_heartbeat(investigation_id=1, user_id=20, now=now + timedelta(seconds=1))

        heartbeat = record_heartbeat(investigation_id=1, user_id=30, now=now + timedelta(seconds=2))

        assert [uid for uid, _ in heartbeat.active] == [30, 20, 10]

    def test_expired_viewers_are_dropped(self) -> None:
        now = timezone.now()
        record_heartbeat(investigation_id=1, user_id=10, now=now)
        later = now + PRESENCE_WINDOW + timedelta(seconds=1)

        heartbeat = record_heartbeat(investigation_id=1, user_id=20, now=later)
        assert [uid for uid, _ in heartbeat.active] == [20]

        heartbeat = record_heartbeat(investigation_id=1, user_id=10, now=later)
        assert heartbeat.was_present is False

    def test_investigations_are_separate(self) -> None:
        record_heartbeat(investigation_id=1, user_id=10)

        heartbeat = record_heartbeat(investigation_id=2, user_id=20)

        assert [uid for uid, _ in heartbeat.active] == [20]

    def test_active_viewers_carry_their_last_heartbeat(self) -> None:
        now = timezone.now().replace(microsecond=0)
        record_heartbeat(investigation_id=1, user_id=10, now=now)

        heartbeat = record_heartbeat(investigation_id=1, user_id=20, now=now + timedelta(seconds=2))

        assert heartbeat.active == [(20, now + timedelta(seconds=2)), (10, now)]
