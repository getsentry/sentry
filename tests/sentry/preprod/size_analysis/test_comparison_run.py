from collections.abc import Callable
from datetime import timedelta
from io import BytesIO
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db import connection, router, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.compare import compare_size_analysis
from sentry.preprod.size_analysis.comparison_run import (
    _delete_unreferenced_result_files,
    _record_size_analysis_comparison,
    run_size_analysis_comparisons,
)
from sentry.preprod.size_analysis.models import SizeAnalysisResults
from sentry.preprod.size_analysis.tasks import (
    compare_preprod_artifact_size_analysis,
    manual_size_analysis_comparison,
)
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.fixtures import Fixtures


class ProcessingDeadline(BaseException):
    pass


class _CompareTaskHelpers(Fixtures):
    def _create_analysis_file(self) -> File:
        results = SizeAnalysisResults(analysis_duration=1.0, download_size=100, install_size=200)
        payload = results.json()
        file = self.create_file(name="analysis.json", type="size_analysis.json")
        file.putfile(BytesIO(payload.encode()))
        return file

    def _create_comparable_pair(
        self,
    ) -> tuple[
        PreprodArtifact,
        list[tuple[PreprodArtifactSizeMetrics, PreprodArtifactSizeMetrics]],
    ]:
        head_artifact, head_main, base_artifact, base_main = (
            self.create_preprod_artifact_pair_for_comparison()
        )
        watch_type = PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        head_watch = self.create_preprod_artifact_size_metrics(
            head_artifact, metrics_type=watch_type, identifier="watch"
        )
        base_watch = self.create_preprod_artifact_size_metrics(
            base_artifact, metrics_type=watch_type, identifier="watch"
        )
        pairs = [(head_main, base_main), (head_watch, base_watch)]
        for head_metric, base_metric in pairs:
            for metric in (head_metric, base_metric):
                analysis_file = self._create_analysis_file()
                metric.analysis_file_id = analysis_file.id
                metric.save()
        return head_artifact, pairs

    def _run_task(self, head_artifact: PreprodArtifact) -> None:
        compare_preprod_artifact_size_analysis(
            project_id=head_artifact.project_id,
            org_id=head_artifact.project.organization_id,
            artifact_id=head_artifact.id,
            triggered_at=timezone.now().isoformat(),
        )

    def _create_pending_rows(
        self, pairs: list[tuple[PreprodArtifactSizeMetrics, PreprodArtifactSizeMetrics]]
    ) -> None:
        for head_metric, base_metric in pairs:
            self.create_preprod_artifact_size_comparison(
                head_size_analysis=head_metric,
                base_size_analysis=base_metric,
                state=PreprodArtifactSizeComparison.State.PENDING,
            )

    def _run_manual_task(
        self,
        head_artifact: PreprodArtifact,
        pairs: list[tuple[PreprodArtifactSizeMetrics, PreprodArtifactSizeMetrics]],
    ) -> None:
        _, main_base = pairs[0]
        manual_size_analysis_comparison(
            project_id=head_artifact.project_id,
            org_id=head_artifact.project.organization_id,
            head_artifact_id=head_artifact.id,
            base_artifact_id=main_base.preprod_artifact_id,
        )

    def _result_files(self) -> list[File]:
        result_files = File.objects.filter(type="size_analysis_comparison.json")
        return list(result_files.order_by("id"))


class ComparePreprodArtifactSizeAnalysisTest(_CompareTaskHelpers, TestCase):
    def _fail_on_second_call(self, exc: BaseException) -> Callable[..., Any]:
        calls: list[dict[str, Any]] = []

        def compare(**kwargs: Any) -> Any:
            calls.append(kwargs)
            if len(calls) > 1:
                raise exc
            return compare_size_analysis(**kwargs)

        return compare

    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_size_pr_comment_task.apply_async"
    )
    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async"
    )
    def test_runs_every_comparison_then_dispatches_follow_ups(
        self, status_check: MagicMock, pr_comment: MagicMock
    ) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        main_head, main_base = pairs[0]
        leftover = self.create_preprod_artifact_size_comparison(
            head_size_analysis=main_head,
            base_size_analysis=main_base,
            state=PreprodArtifactSizeComparison.State.PENDING,
        )

        self._run_task(head_artifact)

        rows = list(PreprodArtifactSizeComparison.objects.order_by("id"))
        assert [row.state for row in rows] == [PreprodArtifactSizeComparison.State.SUCCESS] * 2
        assert rows[0].id == leftover.id
        result_files = self._result_files()
        assert {file.id for file in result_files} == {row.file_id for row in rows}
        assert {file.name for file in result_files} == {str(row.id) for row in rows}
        expected = {"preprod_artifact_id": head_artifact.id, "caller": "compare_completion"}
        status_check.assert_called_once_with(kwargs=expected)
        pr_comment.assert_called_once_with(kwargs=expected)

    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async"
    )
    def test_interrupted_run_leaves_nothing_behind(self, status_check: MagicMock) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        main_head, main_base = pairs[0]
        leftover = self.create_preprod_artifact_size_comparison(
            head_size_analysis=main_head,
            base_size_analysis=main_base,
            state=PreprodArtifactSizeComparison.State.PENDING,
        )

        with patch(
            "sentry.preprod.size_analysis.comparison_run.compare_size_analysis",
            side_effect=self._fail_on_second_call(ProcessingDeadline()),
        ):
            with pytest.raises(ProcessingDeadline):
                self._run_task(head_artifact)

        row = PreprodArtifactSizeComparison.objects.get()
        assert row.id == leftover.id
        assert row.state == PreprodArtifactSizeComparison.State.PENDING
        assert row.file_id is None
        assert self._result_files() == []
        status_check.assert_not_called()

    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async"
    )
    def test_run_interrupted_while_recording_rolls_back_recorded_rows(
        self, status_check: MagicMock
    ) -> None:
        head_artifact, _ = self._create_comparable_pair()
        recorded: list[Any] = []

        def record_first_then_hit_deadline(*args: Any) -> None:
            if recorded:
                raise ProcessingDeadline()
            _record_size_analysis_comparison(*args)
            recorded.append(args)

        with patch(
            "sentry.preprod.size_analysis.comparison_run._record_size_analysis_comparison",
            side_effect=record_first_then_hit_deadline,
        ):
            with pytest.raises(ProcessingDeadline):
                self._run_task(head_artifact)

        assert len(recorded) == 1
        assert not PreprodArtifactSizeComparison.objects.exists()
        assert self._result_files() == []
        status_check.assert_not_called()

    def test_failed_upload_leaves_nothing_behind(self) -> None:
        head_artifact, _ = self._create_comparable_pair()
        with patch.object(File, "putfile", side_effect=OSError("bucket unreachable")):
            with pytest.raises(OSError):
                self._run_task(head_artifact)

        assert not PreprodArtifactSizeComparison.objects.exists()
        assert self._result_files() == []

    def test_missing_analysis_file_fails_only_that_comparison(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        main_head, _ = pairs[0]
        watch_head, _ = pairs[1]
        File.objects.filter(id=watch_head.analysis_file_id).delete()

        self._run_task(head_artifact)

        main = PreprodArtifactSizeComparison.objects.get(head_size_analysis=main_head)
        watch = PreprodArtifactSizeComparison.objects.get(head_size_analysis=watch_head)
        assert main.state == PreprodArtifactSizeComparison.State.SUCCESS
        assert watch.state == PreprodArtifactSizeComparison.State.FAILED
        assert watch.file_id is None

    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async"
    )
    def test_comparison_recorded_by_another_run_is_left_alone(
        self, status_check: MagicMock
    ) -> None:
        head_artifact, _ = self._create_comparable_pair()

        def compare_after_another_run_recorded_it(**kwargs: Any) -> Any:
            self.create_preprod_artifact_size_comparison(
                head_size_analysis=kwargs["head_size_analysis"],
                base_size_analysis=kwargs["base_size_analysis"],
                state=PreprodArtifactSizeComparison.State.SUCCESS,
            )
            return compare_size_analysis(**kwargs)

        with patch(
            "sentry.preprod.size_analysis.comparison_run.compare_size_analysis",
            side_effect=compare_after_another_run_recorded_it,
        ):
            self._run_task(head_artifact)

        rows = list(PreprodArtifactSizeComparison.objects.all())
        assert [row.state for row in rows] == [PreprodArtifactSizeComparison.State.SUCCESS] * 2
        assert [row.file_id for row in rows] == [None, None]
        assert self._result_files() == []
        status_check.assert_called_once()

    @patch(
        "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async"
    )
    def test_comparison_deleted_before_it_is_recorded_is_skipped(
        self, status_check: MagicMock
    ) -> None:
        head_artifact, _ = self._create_comparable_pair()

        with patch.object(PreprodArtifactSizeComparison.objects, "bulk_create"):
            self._run_task(head_artifact)

        assert not PreprodArtifactSizeComparison.objects.exists()
        assert self._result_files() == []
        status_check.assert_called_once()

    def test_cleanup_keeps_result_files_a_comparison_references(self) -> None:
        head_artifact, _ = self._create_comparable_pair()
        self._run_task(head_artifact)
        recorded_files = self._result_files()
        stray_file = self.create_file(name="stray", type="size_analysis_comparison.json")

        _delete_unreferenced_result_files([*recorded_files, stray_file])

        assert self._result_files() == recorded_files

    def test_rows_are_recorded_in_one_order_whatever_the_input_order(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        reversed_pairs = list(reversed(pairs))
        comparisons = [
            {"head_metric": head_metric, "base_metric": base_metric}
            for head_metric, base_metric in reversed_pairs
        ]

        with patch(
            "sentry.preprod.size_analysis.comparison_run._record_size_analysis_comparison",
            wraps=_record_size_analysis_comparison,
        ) as record:
            run_size_analysis_comparisons(head_artifact.project.organization_id, comparisons, [])

        recorded = [call.args[1] for call in record.call_args_list]
        assert [prepared.head_metric.id for prepared in recorded] == [
            head_metric.id for head_metric, _ in pairs
        ]

    def test_rerun_does_not_redo_finished_comparisons(self) -> None:
        head_artifact, _ = self._create_comparable_pair()
        self._run_task(head_artifact)

        with patch("sentry.preprod.size_analysis.comparison_run.compare_size_analysis") as compare:
            self._run_task(head_artifact)

        compare.assert_not_called()
        assert len(self._result_files()) == 2


class ManualSizeAnalysisComparisonTest(_CompareTaskHelpers, TestCase):
    def test_manual_comparison_does_not_overwrite_one_recorded_meanwhile(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        self._create_pending_rows(pairs)
        real_getfile = File.getfile

        def getfile_while_another_run_records(self_: File, *args: Any, **kwargs: Any) -> Any:
            pending_rows = PreprodArtifactSizeComparison.objects.filter(
                state=PreprodArtifactSizeComparison.State.PENDING
            )
            pending_rows.update(state=PreprodArtifactSizeComparison.State.SUCCESS)
            return real_getfile(self_, *args, **kwargs)

        with (
            patch.object(File, "getfile", getfile_while_another_run_records),
            patch("sentry.preprod.size_analysis.comparison_run.compare_size_analysis") as compare,
        ):
            self._run_manual_task(head_artifact, pairs)

        states = list(PreprodArtifactSizeComparison.objects.values_list("state", flat=True))
        assert states == [PreprodArtifactSizeComparison.State.SUCCESS] * len(pairs)
        compare.assert_not_called()
        assert self._result_files() == []

    def test_manual_comparison_failed_success_write_leaves_no_file(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        self._create_pending_rows(pairs)

        with patch.object(
            PreprodArtifactSizeComparison, "save", side_effect=OSError("database unreachable")
        ):
            with pytest.raises(OSError):
                self._run_manual_task(head_artifact, pairs)

        assert self._result_files() == []

    def test_manual_comparison_failed_upload_leaves_no_file(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        self._create_pending_rows(pairs)
        an_hour_ago = timezone.now() - timedelta(hours=1)
        PreprodArtifactSizeComparison.objects.update(date_updated=an_hour_ago)

        with patch.object(File, "putfile", side_effect=OSError("bucket unreachable")):
            with pytest.raises(OSError):
                self._run_manual_task(head_artifact, pairs)

        states = PreprodArtifactSizeComparison.objects.values_list("state", flat=True)
        assert sorted(states) == [
            PreprodArtifactSizeComparison.State.PENDING,
            PreprodArtifactSizeComparison.State.PROCESSING,
        ]
        claimed_comparison = PreprodArtifactSizeComparison.objects.get(
            state=PreprodArtifactSizeComparison.State.PROCESSING
        )
        assert claimed_comparison.date_updated > an_hour_ago
        assert self._result_files() == []


class SizeComparisonTransactionTest(_CompareTaskHelpers, TransactionTestCase):
    def test_file_io_runs_outside_any_transaction(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        in_atomic_block: list[bool] = []
        using = router.db_for_write(PreprodArtifactSizeComparison)

        def record() -> None:
            in_atomic_block.append(transaction.get_connection(using).in_atomic_block)

        real_getfile = File.getfile
        real_putfile = File.putfile

        def spy_getfile(self_: File, *args: Any, **kwargs: Any) -> Any:
            record()
            return real_getfile(self_, *args, **kwargs)

        def spy_putfile(self_: File, *args: Any, **kwargs: Any) -> Any:
            record()
            return real_putfile(self_, *args, **kwargs)

        def spy_compare(*args: Any, **kwargs: Any) -> Any:
            record()
            return compare_size_analysis(*args, **kwargs)

        dispatched_in_atomic_block: list[bool] = []

        def spy_dispatch(*args: Any, **kwargs: Any) -> None:
            dispatched_in_atomic_block.append(transaction.get_connection(using).in_atomic_block)

        with (
            patch.object(File, "getfile", spy_getfile),
            patch.object(File, "putfile", spy_putfile),
            patch("sentry.preprod.size_analysis.comparison_run.compare_size_analysis", spy_compare),
            patch(
                "sentry.preprod.size_analysis.comparison_run.create_preprod_status_check_task.apply_async",
                spy_dispatch,
            ),
            patch(
                "sentry.preprod.size_analysis.comparison_run.create_preprod_size_pr_comment_task.apply_async",
                spy_dispatch,
            ),
            CaptureQueriesContext(connection) as ctx,
        ):
            self._run_task(head_artifact)

        assert dispatched_in_atomic_block == [True, True]

        downloads_diff_and_upload = 4
        assert len(in_atomic_block) >= downloads_diff_and_upload * len(pairs)
        assert set(in_atomic_block) == {False}
        statements = [query["sql"] for query in ctx.captured_queries]
        savepoints = [s for s in statements if s.startswith("SAVEPOINT")]
        assert savepoints == []
        row_locks = [s for s in statements if s.endswith("FOR UPDATE")]
        assert len(row_locks) == len(pairs)
        states = list(PreprodArtifactSizeComparison.objects.values_list("state", flat=True))
        assert states == [PreprodArtifactSizeComparison.State.SUCCESS] * 2

    def test_manual_upload_runs_outside_any_transaction(self) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        in_atomic_block: list[bool] = []
        using = router.db_for_write(PreprodArtifactSizeComparison)
        real_putfile = File.putfile

        def spy_putfile(self_: File, *args: Any, **kwargs: Any) -> Any:
            in_atomic_block.append(transaction.get_connection(using).in_atomic_block)
            return real_putfile(self_, *args, **kwargs)

        self._create_pending_rows(pairs)
        with patch.object(File, "putfile", spy_putfile):
            self._run_manual_task(head_artifact, pairs)

        assert in_atomic_block == [False] * len(pairs)
