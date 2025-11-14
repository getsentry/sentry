from typing import int
from sentry.replays.post_process import _archived_row
from sentry.replays.validators import VALID_FIELD_SET


def test_archived_row_contains_all_of_valid_field_set() -> None:
    ret = _archived_row("replay_id", 123)
    missing_keys = frozenset(VALID_FIELD_SET) - ret.keys()
    assert not missing_keys
