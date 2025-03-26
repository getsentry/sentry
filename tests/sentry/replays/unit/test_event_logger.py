from sentry.replays.usecases.ingest.event_logger import gen_rage_clicks
from sentry.replays.usecases.ingest.event_parser import ClickEvent, ParsedEventMeta


def test_gen_rage_clicks():
    # No clicks.
    meta = ParsedEventMeta([], [], [], [], [], [])
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a", "b"}))) == 0

    # Not a rage click and not URL.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 0, 0, "", "", "", "", "", 0, "", url="")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a", "b"}))) == 0

    # Rage click but not url.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 1, 0, "", "", "", "", "", 0, "", url="")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a", "b"}))) == 0

    # Rage click and url specified.
    meta.click_events.append(
        ClickEvent("", "", [], "", "", 0, 1, 0, "", "", "", "", "", 0, "", url="t")
    )
    assert len(list(gen_rage_clicks(meta, 1, "1", {"a", "b"}))) == 1
    assert len(list(gen_rage_clicks(meta, 1, "1", {}))) == 0
    assert len(list(gen_rage_clicks(meta, 1, "1", None))) == 0
