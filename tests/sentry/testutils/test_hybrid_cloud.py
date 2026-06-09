import threading

from sentry.testutils.hybrid_cloud import SimulatedTransactionWatermarks


def test_simulated_transaction_watermarks_state_is_thread_local() -> None:
    # ``state`` must be isolated per-thread. A regression here (e.g. declaring
    # ``state`` as a class attribute) would mean a background thread shares the
    # same dict as the main test thread, leaking watermark state between threads
    # and producing spurious CrossTransactionAssertionErrors.
    watermarks = SimulatedTransactionWatermarks()
    watermarks.state["default"] = 5

    seen_in_thread: dict[str, int] = {}

    def worker() -> None:
        # A freshly-seen thread should get its own empty dict, not the main
        # thread's populated one.
        seen_in_thread.update(watermarks.state)
        watermarks.state["leaked"] = 1

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join()

    assert seen_in_thread == {}
    # The background thread's mutation must not be visible on the main thread.
    assert watermarks.state == {"default": 5}
