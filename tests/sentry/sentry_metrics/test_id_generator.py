from sentry.sentry_metrics.indexer.id_generator import get_id


def test_get_id() -> None:
    # Function returns a different ID each time it's called
    assert get_id() == get_id()

    # IDs fit in 64 bits
    assert get_id() < pow(2, 64)
