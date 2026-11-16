from sentry.seer.nav_snapshot import get_nav_snapshot


def test_get_nav_snapshot() -> None:
    snapshot = get_nav_snapshot()
    assert snapshot["version"] == 1
    assert snapshot["entries"]
    for entry in snapshot["entries"]:
        assert entry["crumbs"]
        assert entry["path"].startswith("/")
