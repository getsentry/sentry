from datetime import UTC, datetime

from sentry.issues.action_log.types import FirstSeenAction, GroupAction, GroupActionType
from sentry.testutils.cases import TestCase


class GroupActionRegistrationTest(TestCase):
    def test_all_types_are_registered(self) -> None:
        missing = [member for member in GroupActionType if GroupAction.by_type(member) is None]
        assert missing == [], (
            f"GroupActionType members without a registered GroupAction subclass: "
            f"{[m.name for m in missing]}"
        )


class GroupActionJsonDictTest(TestCase):
    def test_datetime_round_trips_through_json_dict(self) -> None:
        first_seen = datetime(2026, 10, 8, 19, 13, 56, 56000, tzinfo=UTC)
        data = FirstSeenAction(first_seen=first_seen).json_dict()

        assert data == {"first_seen": first_seen.isoformat()}
        assert FirstSeenAction(**data).first_seen == first_seen
