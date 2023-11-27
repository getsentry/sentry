from queue import Queue
from threading import Thread

from sentry.services.hybrid_cloud.rpcmetrics import RpcMetricRecord, RpcMetricSpan, RpcMetricTracker
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class RpcMetricsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        assert len(RpcMetricTracker.get_local().spans) == 0

    def test_single_thread(self):
        with RpcMetricSpan() as span:
            for n in range(3):
                with RpcMetricRecord.measure(f"service{n}", f"method{n}"):
                    pass
            assert len(span.records) == 3

    def test_multithreaded(self):
        record_queue: Queue[RpcMetricRecord] = Queue()

        def make_thread(n: int) -> Thread:
            def run() -> None:
                name = str(n)
                with RpcMetricSpan() as span:
                    with RpcMetricRecord.measure(name, name):
                        pass

                    # Verify that the record was captured through the correct tracker
                    assert len(span.records) == 1
                    (record,) = span.records
                    assert record.service_name == name
                    assert record.method_name == name

                    record_queue.put(record)

            return Thread(target=run)

        thread_count = 10
        threads = [make_thread(n) for n in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Verify that all spans ran as expected
        records = list(record_queue.queue)
        assert len(records) == thread_count
        assert len({r.service_name for r in records}) == thread_count
