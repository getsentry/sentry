from sentry_plugins.segment.plugin import SegmentPlugin


def test_conf_key() -> None:
    assert SegmentPlugin().conf_key == "segment"
