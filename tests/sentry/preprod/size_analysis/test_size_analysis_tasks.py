from collections.abc import Callable
from datetime import datetime, timedelta
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
from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisDetectorHandler,
    PreprodSizeAnalysisGroupType,
    _artifact_to_tags,
)
from sentry.preprod.size_analysis.models import SizeAnalysisResults
from sentry.preprod.size_analysis.tasks import (
    _delete_unreferenced_result_files,
    _get_platform,
    _record_size_analysis_comparison,
    _run_size_analysis_comparisons,
    compare_preprod_artifact_size_analysis,
    manual_size_analysis_comparison,
    maybe_emit_issues_from_absolute_size_results,
    maybe_emit_issues_from_diff_size_results,
)
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.fixtures import Fixtures
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


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

    @patch("sentry.preprod.size_analysis.tasks.create_preprod_size_pr_comment_task.apply_async")
    @patch("sentry.preprod.size_analysis.tasks.create_preprod_status_check_task.apply_async")
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

    @patch("sentry.preprod.size_analysis.tasks.create_preprod_status_check_task.apply_async")
    def test_interrupted_run_leaves_nothing_behind(self, status_check: MagicMock) -> None:
        head_artifact, pairs = self._create_comparable_pair()
        main_head, main_base = pairs[0]
        leftover = self.create_preprod_artifact_size_comparison(
            head_size_analysis=main_head,
            base_size_analysis=main_base,
            state=PreprodArtifactSizeComparison.State.PENDING,
        )

        with patch(
            "sentry.preprod.size_analysis.tasks.compare_size_analysis",
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

    @patch("sentry.preprod.size_analysis.tasks.create_preprod_status_check_task.apply_async")
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
            "sentry.preprod.size_analysis.tasks.compare_size_analysis",
            side_effect=compare_after_another_run_recorded_it,
        ):
            self._run_task(head_artifact)

        rows = list(PreprodArtifactSizeComparison.objects.all())
        assert [row.state for row in rows] == [PreprodArtifactSizeComparison.State.SUCCESS] * 2
        assert [row.file_id for row in rows] == [None, None]
        assert self._result_files() == []
        status_check.assert_called_once()

    @patch("sentry.preprod.size_analysis.tasks.create_preprod_status_check_task.apply_async")
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
            "sentry.preprod.size_analysis.tasks._record_size_analysis_comparison",
            wraps=_record_size_analysis_comparison,
        ) as record:
            _run_size_analysis_comparisons(head_artifact.project.organization_id, comparisons, [])

        recorded = [call.args[1] for call in record.call_args_list]
        assert [prepared.head_metric.id for prepared in recorded] == [
            head_metric.id for head_metric, _ in pairs
        ]

    def test_rerun_does_not_redo_finished_comparisons(self) -> None:
        head_artifact, _ = self._create_comparable_pair()
        self._run_task(head_artifact)

        with patch("sentry.preprod.size_analysis.tasks.compare_size_analysis") as compare:
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
            patch("sentry.preprod.size_analysis.tasks.compare_size_analysis") as compare,
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

        with patch.object(File, "putfile", side_effect=OSError("bucket unreachable")):
            with pytest.raises(OSError):
                self._run_manual_task(head_artifact, pairs)

        states = PreprodArtifactSizeComparison.objects.values_list("state", flat=True)
        assert sorted(states) == [
            PreprodArtifactSizeComparison.State.PENDING,
            PreprodArtifactSizeComparison.State.PROCESSING,
        ]
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
            patch("sentry.preprod.size_analysis.tasks.compare_size_analysis", spy_compare),
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task.apply_async",
                spy_dispatch,
            ),
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_size_pr_comment_task.apply_async",
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


class MaybeEmitIssuesFromDiffSizeResultsTest(TestCase):
    """Tests for the maybe_emit_issues_from_diff_size_results function."""

    def _create_artifact_with_metrics(
        self,
        max_install_size: int = 5000000,
        max_download_size: int = 2000000,
        date_added: datetime | None = None,
        app_name: str | None = None,
        **kwargs: Any,
    ) -> PreprodArtifact:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            date_added=date_added,
            app_name=app_name,
            **kwargs,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=max_install_size,
            max_download_size=max_download_size,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        return artifact

    def _create_diff_detector(
        self,
        threshold_type: str = "absolute_diff",
        comparison: int = 500000,
        **kwargs: Any,
    ) -> Detector:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=comparison,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        config = {"threshold_type": threshold_type, "measurement": "install_size", **kwargs}
        return self.create_detector(
            name="test-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config=config,
            workflow_condition_group=condition_group,
        )

    def test_triggers_detector_evaluation(self) -> None:
        now = timezone.now()
        self._create_artifact_with_metrics(
            max_install_size=4000000,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            date_added=now - timedelta(hours=1),
        )
        self._create_diff_detector()

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_on_complete.call_count == 1

    def test_no_detectors(self) -> None:
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_on_complete.call_count == 0

    def test_populates_metadata(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(
            max_install_size=4000000,
            max_download_size=1500000,
            date_added=now - timedelta(hours=2),
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            max_download_size=2000000,
            date_added=now - timedelta(hours=1),
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        self._create_diff_detector()

        with patch("sentry.preprod.size_analysis.tasks.process_detectors") as mock_process:
            mock_process.return_value = {}
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_process.call_count == 1
        data_packet = mock_process.call_args[0][0]
        packet = data_packet.packet
        metadata = packet["metadata"]

        assert metadata["platform"] == "android"
        assert metadata["head_artifact_id"] == head.id
        assert metadata["base_artifact_id"] == base.id
        assert metadata["head_artifact"].id == head.id
        assert metadata["base_artifact"].id == base.id
        assert packet["head_install_size_bytes"] == 5000000
        assert packet["head_download_size_bytes"] == 2000000
        assert packet["base_install_size_bytes"] == 4000000
        assert packet["base_download_size_bytes"] == 1500000

    def test_skips_absolute_detectors(self) -> None:
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_on_complete.call_count == 0

    def test_skips_when_no_base(self) -> None:
        head = self._create_artifact_with_metrics()
        self._create_diff_detector()

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_on_complete.call_count == 0

    def test_skips_when_no_head_metrics(self) -> None:
        head = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        self._create_diff_detector()

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_on_complete.call_count == 0

    def test_batches_queries(self) -> None:
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        # Two detectors with the same (empty) query
        self._create_diff_detector(threshold_type="absolute_diff")
        self._create_diff_detector(threshold_type="relative_diff")

        with patch(
            "sentry.preprod.size_analysis.tasks.get_sequential_base_artifact"
        ) as mock_lookup:
            mock_lookup.return_value = None
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        # Should only be called once for the shared empty query
        assert mock_lookup.call_count == 1

    def test_creates_comparison_record(self) -> None:
        now = timezone.now()
        self._create_artifact_with_metrics(
            max_install_size=4000000,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            date_added=now - timedelta(hours=1),
        )
        self._create_diff_detector()

        maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert PreprodArtifactSizeComparison.objects.count() == 1
        comparison = PreprodArtifactSizeComparison.objects.first()
        assert comparison is not None


class MaybeEmitIssuesFromSizeResultsTest(TestCase):
    """Tests for the maybe_emit_issues_from_absolute_size_results function."""

    def test_triggers_absolute_detector(self) -> None:
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_absolute_size_results(head_metric=metric)

        assert mock_on_complete.call_count == 1

    def test_skips_diff_detectors(self) -> None:
        """Diff-based detectors should not fire from the single-build path."""
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="diff-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_absolute_size_results(head_metric=metric)

        assert mock_on_complete.call_count == 0

    def test_populates_metadata_without_base(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with patch("sentry.preprod.size_analysis.tasks.process_detectors") as mock_process:
            mock_process.return_value = {}
            maybe_emit_issues_from_absolute_size_results(head_metric=metric)

        assert mock_process.call_count == 1
        data_packet = mock_process.call_args[0][0]
        metadata = data_packet.packet["metadata"]

        assert metadata["platform"] == "android"
        assert metadata["head_metric_id"] == metric.id
        assert metadata["head_artifact_id"] == artifact.id
        assert metadata["head_artifact"].id == artifact.id
        assert "base_metric_id" not in metadata
        assert "base_artifact_id" not in metadata
        assert "base_artifact" not in metadata

    def test_no_detectors(self) -> None:
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with patch.object(PreprodSizeAnalysisDetectorHandler, "on_complete") as mock_on_complete:
            maybe_emit_issues_from_absolute_size_results(head_metric=metric)

        assert mock_on_complete.call_count == 0


class GetPlatformTest(TestCase):
    def _make_artifact(self, artifact_type: int | None) -> PreprodArtifact:
        file = self.create_file(name="test", type="application/octet-stream")
        return self.create_preprod_artifact(
            project=self.project, file_id=file.id, artifact_type=artifact_type
        )

    def test_xcarchive_returns_apple(self) -> None:
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.XCARCHIVE)) == "apple"

    def test_aab_returns_android(self) -> None:
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.AAB)) == "android"

    def test_apk_returns_android(self) -> None:
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.APK)) == "android"

    def test_none_returns_unknown(self) -> None:
        assert _get_platform(self._make_artifact(None)) == "unknown"


class ArtifactToTagsTest(TestCase):
    def test_full_artifact_data(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_name="MyApp",
            build_version="1.2.3",
            build_number=42,
        )
        # Refresh to load mobile_app_info
        artifact = PreprodArtifact.objects.select_related("mobile_app_info").get(id=artifact.id)

        tags = _artifact_to_tags(artifact)

        assert tags["app_id"] == "com.example.app"
        assert tags["app_name"] == "MyApp"
        assert tags["build_version"] == "1.2.3"
        assert tags["build_number"] == "42"
        assert tags["artifact_type"] == "apk"

    def test_minimal_artifact_data(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=None,
            create_mobile_app_info=False,
        )

        tags = _artifact_to_tags(artifact)

        assert tags == {"app_id": "com.example.app", "preprod_artifact_id": str(artifact.id)}
