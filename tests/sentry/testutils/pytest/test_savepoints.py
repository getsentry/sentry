from collections import Counter

import pytest
from django.db import connections, router, transaction

from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.savepoints import (
    LOOP_REPORT_THRESHOLD,
    SUBTRANSACTION_CACHE_SIZE,
    ApplicationTransaction,
    SavepointUsage,
    evaluate_usage,
)

NODEID = "tests/sentry/example/test_example.py::test_example"
CALL_SITE = "src/sentry/example/transaction.py:run (line 10)"
OPENED_IN = "src/sentry/example/loop.py:process_all"
OPENED_LINE = 20

RAW_WRITE_SQL = """
WITH target AS (SELECT id FROM sentry_project WHERE id = %s)
UPDATE sentry_project SET name = %s WHERE id IN (SELECT id FROM target) RETURNING id
"""


def make_usage(peak_held_ids: int, savepoints_opened: int) -> SavepointUsage:
    txn = ApplicationTransaction(
        call_site=CALL_SITE,
        peak_held_ids=peak_held_ids,
        savepoints_opened=Counter({OPENED_IN: savepoints_opened}),
        first_lines={OPENED_IN: OPENED_LINE},
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

        written_savepoints = 1
        nested_savepoints = 2
        loop_savepoints = 10
        locked_savepoints = 1
        raw_write_savepoints = 1
        savepoints_without_id = 3

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

            with transaction.atomic(using=using):
                Project.objects.filter(id=-1).update(name="matches-nothing")

            with transaction.atomic(using=using):
                list(Project.objects.select_for_update().filter(id=project_id))

            with transaction.atomic(using=using):
                with connections[using].cursor() as cursor:
                    cursor.execute(RAW_WRITE_SQL, [project_id, "raw"])

        txn = self.savepoint_usage.transactions[-1]
        top = txn.top_opener()

        expected_held = (
            written_savepoints
            + nested_savepoints
            + loop_savepoints
            + locked_savepoints
            + raw_write_savepoints
        )
        expected_opened = expected_held + savepoints_without_id
        assert txn.peak_held_ids == expected_held
        assert len(txn.savepoints) == expected_opened
        assert (
            top.opened_in == "tests/sentry/testutils/pytest/test_savepoints.py:open_two_savepoints"
        )
        assert top.savepoints_opened == loop_savepoints

        self.savepoint_usage.clear()

    def test_failed_outer_transaction_releases_every_id(self) -> None:
        project_id = self.project.id
        using = router.db_for_write(Project)
        written_savepoints = 3

        try:
            with transaction.atomic(using=using):
                for index in range(written_savepoints):
                    with transaction.atomic(using=using):
                        Project.objects.filter(id=project_id).update(name=f"written-{index}")
                raise ValueError("fail the outer transaction")
        except ValueError:
            pass

        txn = self.savepoint_usage.transactions[-1]
        assert txn.held_ids == 0
        assert txn.peak_held_ids == written_savepoints

        self.savepoint_usage.clear()


def test_fails_at_overflow_and_clear_suppresses() -> None:
    at_limit = make_usage(peak_held_ids=SUBTRANSACTION_CACHE_SIZE, savepoints_opened=40)
    below_limit = make_usage(peak_held_ids=SUBTRANSACTION_CACHE_SIZE - 1, savepoints_opened=1)

    with pytest.raises(pytest.fail.Exception) as excinfo:
        evaluate_usage(at_limit, NODEID, [])

    message = str(excinfo.value)
    assert CALL_SITE in message
    assert f"{OPENED_IN} (line {OPENED_LINE})" in message

    evaluate_usage(below_limit, NODEID, [])

    at_limit.clear()
    evaluate_usage(at_limit, NODEID, [])


def test_reports_repeated_opener_without_failing() -> None:
    properties: list[tuple[str, object]] = []

    below_threshold = make_usage(peak_held_ids=3, savepoints_opened=LOOP_REPORT_THRESHOLD - 1)
    evaluate_usage(below_threshold, NODEID, properties)
    assert properties == []

    at_threshold = make_usage(peak_held_ids=3, savepoints_opened=LOOP_REPORT_THRESHOLD)
    evaluate_usage(at_threshold, NODEID, properties)
    assert properties == [
        (
            "savepoint_loop",
            {
                "nodeid": NODEID,
                "opened_in": OPENED_IN,
                "line": OPENED_LINE,
                "savepoints_opened": LOOP_REPORT_THRESHOLD,
                "peak_held_ids": 3,
                "call_site": CALL_SITE,
            },
        )
    ]
