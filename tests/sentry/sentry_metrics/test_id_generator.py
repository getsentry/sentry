from sentry.sentry_metrics.indexer.id_generator import get_id


def test_get_id() -> None:
    # Function returns a different ID each time it's called
    assert get_id() != get_id()

    # IDs fit in 64 bits
    assert get_id() < pow(2, 64)

    # Starts with 01 (version)
    id_binary_string = bin(get_id())[2:].zfill(64)
    assert id_binary_string.startswith("0100")
