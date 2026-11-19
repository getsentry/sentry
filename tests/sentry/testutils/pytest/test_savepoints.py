from collections import Counter

import pytest
from django.db import connections, router, transaction

from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.savepoints import (
    LOOP_REPORT_THRESHOLD,
    SUBTRANSACTION_CACHE_SIZE,
    ApplicationTransaction,
    Opening,
    SavepointUsage,
    evaluate_usage,
)

NODEID = "tests/sentry/example/test_example.py::test_example"
CALL_SITE = Opening("src/sentry/example/transaction.py:run", 10)
FORMATTED_CALL_SITE = "src/sentry/example/transaction.py:run (line 10)"
OPENED_IN = "src/sentry/example/loop.py:process_all"
OPENED_LINE = 20
OTHER_OPENER = "src/sentry/example/other.py:write_one"
NO_BASELINE: frozenset[str] = frozenset()
OVERFLOWING_PEAK = SUBTRANSACTION_CACHE_SIZE + 1

RAW_WRITE_INDENT = " " * 40
RAW_WRITE_SQL = f"""
{RAW_WRITE_INDENT}WITH target AS (SELECT id FROM sentry_project WHERE id = %s)
UPDATE sentry_project SET name = %s WHERE id IN (SELECT id FROM target) RETURNING id
"""


def make_usage(peak_held_ids: int, savepoints_opened: int) -> SavepointUsage:
    txn = ApplicationTransaction(
        call_site=CALL_SITE,
        peak_held_ids=peak_held_ids,
        savepoints_opened=Counter({OPENED_IN: savepoints_opened, OTHER_OPENER: 1}),
        first_lines={OPENED_IN: OPENED_LINE, OTHER_OPENER: 1},
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
        loop_savepoints = 12
        locked_savepoints = 1
        raw_write_savepoints = 1
        rolled_back_savepoints = 3
        savepoints_without_id = 2

        with transaction.atomic(using=using):
            with transaction.atomic(using=using):
                Project.objects.filter(id=project_id).update(name="written")

            with transaction.atomic(using=using):
                list(Project.objects.filter(id=project_id))

            try:
                with transaction.atomic(using=using):
                    with transaction.atomic(using=using):
                        Project.objects.filter(id=project_id).update(name="rolled-back-a")
                    with transaction.atomic(using=using):
                        Project.objects.filter(id=project_id).update(name="rolled-back-b")
                    raise ValueError("roll back this savepoint")
            except ValueError:
                pass

            with transaction.atomic(using=using):
                with transaction.atomic(using=using):
                    Project.objects.filter(id=project_id).update(name="nested")

            for _ in range(6):
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
        expected_opened = expected_held + savepoints_without_id + rolled_back_savepoints
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
    past_limit = make_usage(peak_held_ids=OVERFLOWING_PEAK, savepoints_opened=40)
    at_limit = make_usage(peak_held_ids=SUBTRANSACTION_CACHE_SIZE, savepoints_opened=1)

    with pytest.raises(pytest.fail.Exception) as excinfo:
        evaluate_usage(past_limit, NODEID, [], NO_BASELINE)

    message = str(excinfo.value)
    assert FORMATTED_CALL_SITE in message
    assert f"{OPENED_IN} (line {OPENED_LINE})" in message

    evaluate_usage(at_limit, NODEID, [], NO_BASELINE)

    past_limit.clear()
    evaluate_usage(past_limit, NODEID, [], NO_BASELINE)


def test_baseline_reports_known_overflows_instead_of_failing() -> None:
    overflowing = make_usage(peak_held_ids=OVERFLOWING_PEAK, savepoints_opened=2)

    by_call_site: list[tuple[str, object]] = []
    evaluate_usage(overflowing, NODEID, by_call_site, frozenset({CALL_SITE.opened_in}))
    assert by_call_site == [
        (
            "savepoint_baseline_hit",
            {
                "nodeid": NODEID,
                "entry": CALL_SITE.opened_in,
                "peak_held_ids": OVERFLOWING_PEAK,
                "call_site": FORMATTED_CALL_SITE,
            },
        )
    ]

    by_top_opener: list[tuple[str, object]] = []
    evaluate_usage(overflowing, NODEID, by_top_opener, frozenset({OPENED_IN}))
    assert by_top_opener[0][1] == {
        "nodeid": NODEID,
        "entry": OPENED_IN,
        "peak_held_ids": OVERFLOWING_PEAK,
        "call_site": FORMATTED_CALL_SITE,
    }

    with pytest.raises(pytest.fail.Exception):
        evaluate_usage(overflowing, NODEID, [], frozenset({OTHER_OPENER}))


def test_reports_repeated_opener_without_failing() -> None:
    properties: list[tuple[str, object]] = []

    below_threshold = make_usage(peak_held_ids=3, savepoints_opened=LOOP_REPORT_THRESHOLD - 1)
    evaluate_usage(below_threshold, NODEID, properties, NO_BASELINE)
    assert properties == []

    at_threshold = make_usage(peak_held_ids=3, savepoints_opened=LOOP_REPORT_THRESHOLD)
    evaluate_usage(at_threshold, NODEID, properties, NO_BASELINE)
    assert properties == [
        (
            "savepoint_loop",
            {
                "nodeid": NODEID,
                "opened_in": OPENED_IN,
                "line": OPENED_LINE,
                "savepoints_opened": LOOP_REPORT_THRESHOLD,
                "peak_held_ids": 3,
                "call_site": FORMATTED_CALL_SITE,
            },
        )
    ]
