import threading
from collections.abc import Callable

from django.db import connections, router, transaction

from sentry.db.postgres.transactions import django_test_transaction_water_mark
from sentry.models.organization import Organization
from sentry.testutils.cases import TransactionTestCase


class SimulatedTransactionWatermarksTest(TransactionTestCase):
    def test_watermark_in_another_thread_does_not_flush_on_commit_hooks(self) -> None:
        using = router.db_for_write(Organization)
        watermark_set = threading.Event()
        checked = threading.Event()
        errors: list[BaseException] = []
        hook_ran_before_commit: list[bool] = []
        calls: list[str] = []

        def in_thread(target: Callable[[], None]) -> threading.Thread:
            def run() -> None:
                try:
                    target()
                except BaseException as e:
                    errors.append(e)
                finally:
                    watermark_set.set()
                    checked.set()
                    for connection in connections.all():
                        connection.close()

            return threading.Thread(target=run)

        def hold_watermark() -> None:
            with transaction.atomic(using=using), django_test_transaction_water_mark(using=using):
                watermark_set.set()
                checked.wait(10)

        def commit_with_hook() -> None:
            assert watermark_set.wait(10)
            with transaction.atomic(using=using):
                transaction.on_commit(lambda: calls.append("hook"), using=using)
                hook_ran_before_commit.append(bool(calls))

        threads = [in_thread(hold_watermark), in_thread(commit_with_hook)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(20)

        if errors:
            raise errors[0]
        assert hook_ran_before_commit == [False]
        assert calls == ["hook"]
