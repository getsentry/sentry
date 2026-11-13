from collections import Counter

import pytest
from django.db import router, transaction

from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.savepoints import (
    ApplicationTransaction,
    SavepointUsage,
    evaluate_usage,
)

NODEID = "tests/sentry/example/test_example.py::test_example"
CALL_SITE = "src/sentry/example/transaction.py:10:run"
LOOP_CALLER = "src/sentry/example/loop.py:20:process_all"
LOOP_SITE = "src/sentry/example/loop.py:31:process_one"


def make_usage(counting_savepoints: int, repeats: int) -> SavepointUsage:
    txn = ApplicationTransaction(
        call_site=CALL_SITE,
        counting_savepoints=counting_savepoints,
        callers=Counter({LOOP_CALLER: repeats}),
        sites_by_caller={LOOP_CALLER: Counter({LOOP_SITE: repeats})},
    )
    return SavepointUsage(transactions=[txn])


def open_two_savepoints(using: str, project_id: int) -> None:
    with transaction.atomic(using=using):
        Project.objects.filter(id=project_id).update(name="loop-a")
    with transaction.atomic(using=using):
        Project.objects.filter(id=project_id).update(name="loop-b")


class SavepointCountTest(TestCase):
    def test_counts_only_savepoints_that_keep_an_id(self) -> None:
        project_id = self.project.id
        using = router.db_for_write(Project)

        with transaction.atomic(using=using):
            with transaction.atomic(using=using):
                Project.objects.filter(id=project_id).update(name="written")

            with transaction.atomic(using=using):
                list(Project.objects.filter(id=project_id))

            try:
                with transaction.atomic(using=using):
                    Project.objects.filter(id=project_id).update(name="rolled-back")
                    raise ValueError("roll back this savepoint")
            except ValueError:
                pass

            with transaction.atomic(using=using):
                with transaction.atomic(using=using):
                    Project.objects.filter(id=project_id).update(name="nested")

            for _ in range(5):
                open_two_savepoints(using, project_id)

        txn = self.savepoint_usage.transactions[-1]
        top = txn.top_caller()

        assert txn.counting_savepoints == 1 + 2 + 10
        assert len(txn.savepoints) == 1 + 1 + 1 + 2 + 10
        assert top.repeats == 10
        assert top.caller.startswith("tests/sentry/testutils/pytest/test_savepoints.py:")
        assert top.caller.endswith(":test_counts_only_savepoints_that_keep_an_id")
        assert top.site.endswith(":open_two_savepoints")

        self.savepoint_usage.clear()


def test_fails_at_overflow_and_clear_suppresses() -> None:
    at_limit = make_usage(counting_savepoints=64, repeats=40)
    below_limit = make_usage(counting_savepoints=63, repeats=1)

    with pytest.raises(pytest.fail.Exception) as excinfo:
        evaluate_usage(at_limit, NODEID, [])

    message = str(excinfo.value)
    assert CALL_SITE in message
    assert f"{LOOP_CALLER} (40)" in message
    assert LOOP_SITE in message
    assert "64 savepoints" in message
    assert "overflows" in message
    assert "savepoint_usage" in message

    evaluate_usage(below_limit, NODEID, [])

    at_limit.clear()
    evaluate_usage(at_limit, NODEID, [])


def test_reports_repeated_caller_without_failing() -> None:
    properties: list[tuple[str, object]] = []

    evaluate_usage(make_usage(counting_savepoints=3, repeats=5), NODEID, properties)
    assert properties == []

    evaluate_usage(make_usage(counting_savepoints=3, repeats=6), NODEID, properties)
    assert properties == [
        (
            "savepoint_loop",
            {
                "nodeid": NODEID,
                "caller": LOOP_CALLER,
                "repeats": 6,
                "site": LOOP_SITE,
                "counting_savepoints": 3,
                "call_site": CALL_SITE,
            },
        )
    ]
