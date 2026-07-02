from typing import get_args

from sentry.types.activity import ActivityType, ActivityTypeStr, activity_type_to_str


def test_activity_type_str_matches_enum() -> None:
    assert set(get_args(ActivityTypeStr)) == {member.name.lower() for member in ActivityType}


def test_activity_type_to_str() -> None:
    assert activity_type_to_str(ActivityType.NOTE.value) == "note"
    assert activity_type_to_str(ActivityType.PULL_REQUEST_CLOSED.value) == "pull_request_closed"
