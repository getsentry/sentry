from sentry.utils.arroyo import get_reusable_multiprocessing_pool


def test_reusable_multiprocessing_pool() -> None:
    pool1 = get_reusable_multiprocessing_pool(1, None)
    pool2 = get_reusable_multiprocessing_pool(1, None)
    assert id(pool1) == id(pool2)
    pool3 = get_reusable_multiprocessing_pool(2, None)
    assert id(pool3) != id(pool1)
