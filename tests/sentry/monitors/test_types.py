from sentry.monitors.testutils import build_checkin_item
from sentry.monitors.types import CheckinItem


def test_checkin_item_round_trip() -> None:
    checkin_item = build_checkin_item()
    recreated_checkin_item = CheckinItem.from_dict(checkin_item.to_dict())
    assert checkin_item.ts == recreated_checkin_item.ts
    assert checkin_item.partition == recreated_checkin_item.partition
    assert checkin_item.message == recreated_checkin_item.message
    assert checkin_item.payload == recreated_checkin_item.payload
