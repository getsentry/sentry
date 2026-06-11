from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest
from objectstore_client import RequestError

from sentry.preprod.snapshots.models import PreprodSnapshotComparison
from sentry.preprod.snapshots.tasks import _retry_objectstore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class ChunksDoneIndicesTest(TestCase):
    def _comparison(self) -> PreprodSnapshotComparison:
        artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(artifact)
        base_artifact = self.create_preprod_artifact(project=self.project)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        return self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head,
            base_snapshot_metrics=base,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )

    def test_chunks_total_nullable_default(self):
        comparison = self._comparison()
        assert comparison.chunks_total is None

    def test_mark_chunk_done_accumulates_distinct_indices(self):
        from sentry.preprod.snapshots.tasks import _mark_chunk_done

        comparison = self._comparison()
        _mark_chunk_done(comparison.id, 0)
        _mark_chunk_done(comparison.id, 2)
        _mark_chunk_done(comparison.id, 0)
        comparison.refresh_from_db()
        assert sorted(comparison.chunks_done_indices) == [0, 2]

    def test_mark_chunk_done_bumps_date_updated(self):
        from datetime import timedelta

        from django.utils import timezone

        from sentry.preprod.snapshots.tasks import _mark_chunk_done

        comparison = self._comparison()
        stale = timezone.now() - timedelta(seconds=10_000)
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(date_updated=stale)
        _mark_chunk_done(comparison.id, 0)
        comparison.refresh_from_db()
        assert (timezone.now() - comparison.date_updated).total_seconds() < 5


def test_retry_objectstore_retries_once_on_429():
    calls = {"n": 0}

    def op():
        calls["n"] += 1
        if calls["n"] == 1:
            raise RequestError("rate limited", 429, "rate limited")
        return "ok"

    assert _retry_objectstore(op) == "ok"
    assert calls["n"] == 2


def test_retry_objectstore_fails_fast_on_404():
    def op():
        raise RequestError("missing", 404, "missing")

    with pytest.raises(RequestError):
        _retry_objectstore(op)


def test_retry_objectstore_gives_up_after_max_attempts():
    def op():
        raise RequestError("unavailable", 503, "unavailable")

    with pytest.raises(RequestError):
        _retry_objectstore(op)


def _mock_session_with_manifests(manifests_by_key: dict[str, bytes]) -> MagicMock:
    session = MagicMock()

    def _get(key):
        if key not in manifests_by_key:
            raise RequestError(f"Key not found: {key}", 404, "not found")
        result = MagicMock()
        result.payload.read.return_value = manifests_by_key[key]
        return result

    session.get.side_effect = _get
    return session


def _dict_backed_session(stored: dict[str, bytes]) -> MagicMock:
    session = MagicMock()

    def _get(key):
        if key not in stored:
            raise RequestError(f"Key not found: {key}", 404, "not found")
        result = MagicMock()
        result.payload.read.return_value = stored[key]
        return result

    def _put(contents, key, content_type):
        stored[key] = contents

    session.get.side_effect = _get
    session.put.side_effect = _put
    return session


@cell_silo_test
class ProcessChunkTest(TestCase):
    def test_chunk_processes_slice_and_records_done_index(self):
        from sentry.preprod.snapshots.image_diff.types import DiffResult
        from sentry.preprod.snapshots.manifest import (
            ChunkAssignment,
            ChunkCandidate,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.tasks import process_snapshot_comparison_chunk

        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head,
            base_snapshot_metrics=base,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )

        plan = ComparisonPlan(
            head_artifact_id=head_artifact.id,
            base_artifact_id=base_artifact.id,
            chunks=[
                ChunkAssignment(
                    chunk_index=0,
                    candidates=[
                        ChunkCandidate(
                            name="a.png",
                            head_hash="h",
                            base_hash="b",
                            pixel_count=10,
                            diff_threshold=0.0,
                        )
                    ],
                )
            ],
            non_diff_images={},
        )
        prefix = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )

        diff = DiffResult(
            diff_mask_png=b"png",
            changed_pixels=5,
            total_pixels=100,
            aligned_height=10,
            before_width=10,
            before_height=10,
            after_width=10,
            after_height=10,
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks._fetch_batch_images",
                return_value=({"h": b"img", "b": b"img"}, set()),
            ),
            patch("sentry.preprod.snapshots.tasks.compare_images_batch", return_value=[diff]),
        ):
            process_snapshot_comparison_chunk(
                comparison_id=comparison.id,
                chunk_index=0,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

            comparison.refresh_from_db()
            assert comparison.chunks_done_indices == [0]
            assert f"{prefix}/chunks/0.json" in stored

            process_snapshot_comparison_chunk(
                comparison_id=comparison.id,
                chunk_index=0,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

            comparison.refresh_from_db()
            assert comparison.chunks_done_indices == [0]

    def _comparison(self, chunks_total, done_indices=None):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head,
            base_snapshot_metrics=base,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        comparison.chunks_total = chunks_total
        if done_indices is not None:
            comparison.chunks_done_indices = done_indices
        comparison.save()
        return comparison, head_artifact, base_artifact

    def _single_chunk_plan(self, head_artifact, base_artifact):
        from sentry.preprod.snapshots.manifest import (
            ChunkAssignment,
            ChunkCandidate,
            ComparisonPlan,
        )

        return ComparisonPlan(
            head_artifact_id=head_artifact.id,
            base_artifact_id=base_artifact.id,
            chunks=[
                ChunkAssignment(
                    chunk_index=0,
                    candidates=[
                        ChunkCandidate(
                            name="a.png",
                            head_hash="h",
                            base_hash="b",
                            pixel_count=10,
                            diff_threshold=0.0,
                        )
                    ],
                )
            ],
            non_diff_images={},
        )

    def _diff_result(self):
        from sentry.preprod.snapshots.image_diff.types import DiffResult

        return DiffResult(
            diff_mask_png=b"png",
            changed_pixels=5,
            total_pixels=100,
            aligned_height=10,
            before_width=10,
            before_height=10,
            after_width=10,
            after_height=10,
        )

    def test_chunk_triggers_finalize_when_last(self):
        from sentry.preprod.snapshots.tasks import process_snapshot_comparison_chunk

        comparison, head_artifact, base_artifact = self._comparison(1)
        plan = self._single_chunk_plan(head_artifact, base_artifact)
        prefix = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks._fetch_batch_images",
                return_value=({"h": b"img", "b": b"img"}, set()),
            ),
            patch(
                "sentry.preprod.snapshots.tasks.compare_images_batch",
                return_value=[self._diff_result()],
            ),
            patch(
                "sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"
            ) as finalize,
        ):
            process_snapshot_comparison_chunk(
                comparison_id=comparison.id,
                chunk_index=0,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert 0 in comparison.chunks_done_indices
        assert finalize.call_count == 1

    def test_chunk_does_not_trigger_finalize_when_not_last(self):
        from sentry.preprod.snapshots.tasks import process_snapshot_comparison_chunk

        comparison, head_artifact, base_artifact = self._comparison(2)
        plan = self._single_chunk_plan(head_artifact, base_artifact)
        prefix = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks._fetch_batch_images",
                return_value=({"h": b"img", "b": b"img"}, set()),
            ),
            patch(
                "sentry.preprod.snapshots.tasks.compare_images_batch",
                return_value=[self._diff_result()],
            ),
            patch(
                "sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"
            ) as finalize,
        ):
            process_snapshot_comparison_chunk(
                comparison_id=comparison.id,
                chunk_index=0,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.chunks_done_indices == [0]
        assert not finalize.called

    def test_chunk_hard_failure_still_recorded_and_triggers_finalize(self):
        from sentry.preprod.snapshots.tasks import process_snapshot_comparison_chunk

        comparison, head_artifact, base_artifact = self._comparison(1)
        plan = self._single_chunk_plan(head_artifact, base_artifact)
        prefix = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks._process_chunk",
                side_effect=Exception("boom"),
            ),
            patch(
                "sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"
            ) as finalize,
        ):
            process_snapshot_comparison_chunk(
                comparison_id=comparison.id,
                chunk_index=0,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert 0 in comparison.chunks_done_indices
        assert f"{prefix}/chunks/0.json" not in stored
        assert finalize.call_count == 1


@cell_silo_test
class FinalizeSnapshotComparisonTest(TestCase):
    def _comparison(
        self, chunks_total, state=PreprodSnapshotComparison.State.PROCESSING, done_indices=None
    ):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head, base_snapshot_metrics=base, state=state
        )
        comparison.chunks_total = chunks_total
        if done_indices is not None:
            comparison.chunks_done_indices = done_indices
        comparison.save()
        return comparison, head_artifact, base_artifact

    def _kwargs(self, comparison, head_artifact, base_artifact):
        return dict(
            comparison_id=comparison.id,
            org_id=self.organization.id,
            project_id=self.project.id,
            head_artifact_id=head_artifact.id,
            base_artifact_id=base_artifact.id,
        )

    def _single_chunk_plan(self, h, b):
        from sentry.preprod.snapshots.manifest import (
            ChunkAssignment,
            ChunkCandidate,
            ComparisonPlan,
        )

        return ComparisonPlan(
            head_artifact_id=h.id,
            base_artifact_id=b.id,
            chunks=[
                ChunkAssignment(
                    chunk_index=0,
                    candidates=[
                        ChunkCandidate(
                            name="a.png",
                            head_hash="h",
                            base_hash="b",
                            pixel_count=10,
                            diff_threshold=0.0,
                        )
                    ],
                )
            ],
            non_diff_images={},
        )

    def _changed_chunk_result(self):
        from sentry.preprod.snapshots.manifest import ChunkResult, ComparisonImageResult

        return ChunkResult(chunk_index=0, images={"a.png": ComparisonImageResult(status="changed")})

    def test_terminal_state_skips_finalize(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, state=PreprodSnapshotComparison.State.SUCCESS)
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session") as session:
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert not session.called

    def test_all_done_finalizes(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[0])
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        stored = {
            f"{prefix}/plan.json": orjson.dumps(self._single_chunk_plan(h, b).dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(self._changed_chunk_result().dict()),
        }
        session = _dict_backed_session(stored)
        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks._try_auto_approve_snapshot") as mock_auto_approve,
        ):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 1
        assert f"{prefix}/comparison.json" in stored
        assert mock_auto_approve.call_count == 1
        called_head_artifact, called_manifest, called_session = mock_auto_approve.call_args.args
        assert called_head_artifact.id == h.id
        assert called_manifest.head_artifact_id == h.id
        assert called_session is session

    def test_finalize_is_exactly_once(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[0])
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        stored = {
            f"{prefix}/plan.json": orjson.dumps(self._single_chunk_plan(h, b).dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(self._changed_chunk_result().dict()),
        }
        session = _dict_backed_session(stored)
        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks._try_auto_approve_snapshot") as mock_auto_approve,
        ):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert mock_auto_approve.call_count == 1

    def test_chunks_total_none_skips_finalize(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(None)
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session") as session:
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert not session.called
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING

    def test_not_all_done_skips_finalize(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(3, done_indices=[0])
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session") as session:
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert not session.called
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING

    def test_finalize_heartbeats_before_assembly(self):
        from datetime import timedelta

        from django.utils import timezone

        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[0])
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        stored = {
            f"{prefix}/plan.json": orjson.dumps(self._single_chunk_plan(h, b).dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(self._changed_chunk_result().dict()),
        }
        session = _dict_backed_session(stored)

        stale = timezone.now() - timedelta(seconds=10_000)
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(date_updated=stale)

        date_updated_at_finalize = {}

        def _capture(*args, **kwargs):
            date_updated_at_finalize["value"] = PreprodSnapshotComparison.objects.values_list(
                "date_updated", flat=True
            ).get(id=comparison.id)
            return session

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", side_effect=_capture),
            patch("sentry.preprod.snapshots.tasks._try_auto_approve_snapshot"),
        ):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert date_updated_at_finalize["value"] > stale
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS

    def test_finalize_marks_missing_chunk_images_errored(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[1])
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(self._single_chunk_plan(h, b).dict())}
        session = _dict_backed_session(stored)
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        comparison_manifest = orjson.loads(stored[f"{prefix}/comparison.json"])
        assert comparison_manifest["summary"]["errored"] == 1
        assert comparison_manifest["images"]["a.png"]["status"] == "errored"

    def test_finalize_degrades_when_done_chunk_result_unreadable(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[0])
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        stored = {f"{prefix}/plan.json": orjson.dumps(self._single_chunk_plan(h, b).dict())}
        session = _dict_backed_session(stored)
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        comparison_manifest = orjson.loads(stored[f"{prefix}/comparison.json"])
        assert comparison_manifest["summary"]["errored"] == 1
        assert comparison_manifest["images"]["a.png"]["status"] == "errored"

    def test_finalize_fails_when_plan_unreadable(self):
        from sentry.preprod.snapshots.tasks import finalize_snapshot_comparison

        comparison, h, b = self._comparison(1, done_indices=[0])
        session = _dict_backed_session({})
        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            finalize_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.FAILED
        assert comparison.error_code == PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
        vcs.assert_called_once_with(preprod_artifact_id=h.id, caller="compare_failure")


@cell_silo_test
class CompareSnapshotsOrchestratorTest(TestCase):
    def _setup(self):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        head.extras = {"manifest_key": "head_manifest"}
        head.save()
        base = self.create_preprod_snapshot_metrics(base_artifact)
        base.extras = {"manifest_key": "base_manifest"}
        base.save()
        return head_artifact, base_artifact

    def test_orchestrator_dispatches_and_sets_total(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h1", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h0", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"
            ) as dispatch,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.chunks_total == 1
        assert (
            comparison.state == PreprodSnapshotComparison.State.PROCESSING
        )  # finalizer sets SUCCESS, not orchestrator
        assert dispatch.call_count == 1

    def test_orchestrator_finalizes_when_no_diff_chunks(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_manifest = SnapshotManifest(
            images={"unchanged.png": ImageMetadata(content_hash="same", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"unchanged.png": ImageMetadata(content_hash="same", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"
            ) as dispatch,
            patch(
                "sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"
            ) as finalize,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.chunks_total == 0
        assert not dispatch.called
        assert finalize.called

    def test_orchestrator_resumes_stuck_processing_row(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        assert comparison.chunks_total is None

        head_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h1", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h0", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"
            ) as dispatch,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        # Re-fetch rather than refresh_from_db: the earlier `is None` assert
        # narrows the type, which would make the count assertion look unreachable.
        comparison = PreprodSnapshotComparison.objects.get(id=comparison.id)
        assert comparison.chunks_total == 1
        assert dispatch.call_count == 1

    def test_orchestrator_finalizes_when_chunks_already_done(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        # Simulate the dispatched chunk finishing before chunks_total was persisted:
        # the row already covers the (single-chunk) plan when the orchestrator resumes.
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(chunks_done_indices=[0])

        head_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h1", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h0", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch(
                "sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"
            ) as finalize,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.chunks_total == 1
        assert finalize.called

    def test_resume_of_failed_row_preserves_completed_chunks(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.FAILED,
        )
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
            chunks_total=1, chunks_done_indices=[0]
        )

        head_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h1", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h0", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING
        assert comparison.chunks_total == 1
        assert comparison.chunks_done_indices == [0]

    def test_manifest_failure_does_not_clobber_advanced_row(self):
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )

        def _get(key):
            PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
                state=PreprodSnapshotComparison.State.SUCCESS
            )
            raise RequestError(f"Key not found: {key}", 404, "not found")

        session = MagicMock()
        session.get.side_effect = _get

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        failure_calls = [
            c for c in vcs.call_args_list if c.kwargs.get("caller") == "compare_failure"
        ]
        assert failure_calls == []

    def test_manifest_failure_on_processing_row_flips_to_failed(self):
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )

        def _get(key):
            raise RequestError(f"Key not found: {key}", 404, "not found")

        session = MagicMock()
        session.get.side_effect = _get

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.FAILED
        assert comparison.error_code == PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
        failure_calls = [
            c for c in vcs.call_args_list if c.kwargs.get("caller") == "compare_failure"
        ]
        assert len(failure_calls) == 1

    def test_orchestrator_skips_processing_row_with_chunks_total(self):
        from sentry.preprod.snapshots.models import (
            PreprodSnapshotComparison,
            PreprodSnapshotMetrics,
        )
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact = self._setup()
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        comparison.chunks_total = 2
        comparison.save()

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session") as session_factory,
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"
            ) as dispatch,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        assert not session_factory.called
        assert not dispatch.called
        comparison.refresh_from_db()
        assert comparison.chunks_total == 2

    def _setup_selective_chain(self):
        # main(full) -> PR1(selective, base=main); head (PR2) compares against PR1.
        from sentry.models.commitcomparison import CommitComparison

        cc_main = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name="o/r",
            head_sha="h_main",
            base_sha=None,
            provider="github",
        )
        cc_pr1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name="o/r",
            head_sha="h_pr1",
            base_sha="h_main",
            provider="github",
        )
        a_main = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc_main
        )
        a_pr1 = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc_pr1
        )
        m_main = self.create_preprod_snapshot_metrics(a_main, is_selective=False)
        m_main.extras = {"manifest_key": "k_main"}
        m_main.save()
        m_pr1 = self.create_preprod_snapshot_metrics(a_pr1, is_selective=True)
        m_pr1.extras = {"manifest_key": "k_pr1"}
        m_pr1.save()
        a_pr2 = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc_pr1
        )
        m_pr2 = self.create_preprod_snapshot_metrics(a_pr2)
        m_pr2.extras = {"manifest_key": "k_head"}
        m_pr2.save()
        return a_pr2, a_pr1, a_main

    def test_compare_against_selective_base_reconstructs_and_processes(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        manifests = {
            "k_main": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v0", width=10, height=10)}
                ).dict()
            ),
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING
        # Proves reconstruction occurred: "a" is matched-and-changed (v1 vs main's
        # inherited v0) requiring one diff chunk. Without reconstruction the raw selective
        # base lacks "a", so "a" would be an add with zero diff chunks.
        assert comparison.chunks_total == 1

    def test_reconstruction_gated_on_manifest_not_db_flag(self):
        import orjson

        from sentry.preprod.models import PreprodSnapshotMetrics
        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # Inverse drift: the DB is_selective flag has desynced to False while the base
        # manifest is genuinely selective. The reconstruction gate must trust the manifest
        # (the module's source of truth), not the stale DB flag — otherwise we'd silently
        # diff against the partial base.
        PreprodSnapshotMetrics.objects.filter(preprod_artifact=base_artifact).update(
            is_selective=False
        )
        manifests = {
            "k_main": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v0", width=10, height=10)}
                ).dict()
            ),
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING
        # Reconstruction ran despite is_selective=False: "a" is matched-and-changed against
        # main's inherited v0, yielding one diff chunk. The DB-flag gate would skip it and
        # treat "a" as an add (zero chunks).
        assert comparison.chunks_total == 1

    def _complete_chain_manifests(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest

        return {
            "k_main": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v0", width=10, height=10)}
                ).dict()
            ),
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }

    def test_resume_from_pending_skips_compare_start_vcs(self):
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # A self-parked comparison being resumed by the deferral loop. The start status was
        # already posted on the first attempt; resuming must not re-post IN_PROGRESS (each
        # 60s cycle would otherwise re-run the status recompute and hit GitHub rate limits).
        self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_artifact.preprodsnapshotmetrics,
            base_snapshot_metrics=base_artifact.preprodsnapshotmetrics,
            state=PreprodSnapshotComparison.State.PENDING,
        )
        session = _mock_session_with_manifests(self._complete_chain_manifests())
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PROCESSING
        start_calls = [c for c in vcs.call_args_list if c.kwargs.get("caller") == "compare_start"]
        assert start_calls == []

    def test_fresh_start_posts_compare_start_vcs(self):
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        session = _mock_session_with_manifests(self._complete_chain_manifests())
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        start_calls = [c for c in vcs.call_args_list if c.kwargs.get("caller") == "compare_start"]
        assert len(start_calls) == 1

    def test_incomplete_chain_within_window_defers_to_pending(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # main's manifest (k_main) intentionally absent -> reconstruction incomplete.
        manifests = {
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as reschedule,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PENDING
        assert reschedule.call_count == 1
        assert reschedule.call_args.kwargs["countdown"] == 60
        reschedule_kwargs = reschedule.call_args.kwargs["kwargs"]
        assert reschedule_kwargs["head_artifact_id"] == head_artifact.id
        assert reschedule_kwargs["base_artifact_id"] == base_artifact.id

    def test_old_head_with_fresh_comparison_within_window_defers(self):
        from datetime import timedelta

        import orjson
        from django.utils import timezone

        from sentry.preprod.models import PreprodArtifact
        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # Out-of-order fan-out / staff recompare: the head build is old, but THIS comparison
        # was just dispatched. The grace window must measure the comparison's age, not the
        # head's, so an incomplete chain still gets its retry budget instead of dying on the
        # first attempt.
        PreprodArtifact.objects.filter(id=head_artifact.id).update(
            date_added=timezone.now() - timedelta(seconds=601)
        )
        # main's manifest (k_main) intentionally absent -> reconstruction incomplete.
        manifests = {
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as reschedule,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PENDING
        assert reschedule.call_count == 1

    def test_incomplete_chain_past_window_fails(self):
        from datetime import timedelta

        import orjson
        from django.utils import timezone

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # A comparison that has been deferring since before the grace window: age the
        # comparison row (not the head), then let the task resume it. The window is anchored
        # to comparison.date_added, so deferral gives way to terminal failure.
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_artifact.preprodsnapshotmetrics,
            base_snapshot_metrics=base_artifact.preprodsnapshotmetrics,
            state=PreprodSnapshotComparison.State.PENDING,
        )
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
            date_added=timezone.now() - timedelta(seconds=601)
        )
        manifests = {
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as reschedule,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs") as vcs,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.FAILED
        assert comparison.error_code == PreprodSnapshotComparison.ErrorCode.TIMEOUT
        assert reschedule.call_count == 0  # no further deferral past the window
        failure_calls = [
            c for c in vcs.call_args_list if c.kwargs.get("caller") == "compare_failure"
        ]
        assert len(failure_calls) == 1  # failure posted

    def test_corrupt_ancestor_fails_immediately_not_deferred(self):
        import orjson

        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
        from sentry.preprod.snapshots.tasks import compare_snapshots

        head_artifact, base_artifact, main_artifact = self._setup_selective_chain()
        # main (the deepest ancestor) has a corrupt manifest -> reconstruction is
        # unresolvable, so the comparison must fail IMMEDIATELY (not defer for 600s).
        manifests = {
            "k_main": b"not-valid-json{{{",
            "k_pr1": orjson.dumps(
                SnapshotManifest(
                    images={"b": ImageMetadata(content_hash="b1", width=10, height=10)},
                    selective=True,
                ).dict()
            ),
            "k_head": orjson.dumps(
                SnapshotManifest(
                    images={"a": ImageMetadata(content_hash="v1", width=10, height=10)}
                ).dict()
            ),
        }
        session = _mock_session_with_manifests(manifests)
        session.put.side_effect = lambda *a, **k: None

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as reschedule,
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.FAILED
        # INTERNAL_ERROR (not TIMEOUT) and an accurate message — corrupt != "missing base".
        assert comparison.error_code == PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
        assert comparison.error_message is not None
        assert "corrupt" in comparison.error_message.lower()
        assert reschedule.call_count == 0  # terminal immediately, never deferred


@cell_silo_test
class EndToEndFanoutTest(TestCase):
    def _setup_artifacts(self):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        head.extras = {"manifest_key": "head_manifest"}
        head.save()
        base = self.create_preprod_snapshot_metrics(base_artifact)
        base.extras = {"manifest_key": "base_manifest"}
        base.save()
        return head_artifact, base_artifact

    def _build_manifests(self):
        from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest

        head_manifest = SnapshotManifest(
            images={
                "changed_a.png": ImageMetadata(content_hash="ha1", width=10, height=10),
                "changed_b.png": ImageMetadata(content_hash="hb1", width=10, height=10),
                "changed_c.png": ImageMetadata(content_hash="hc1", width=10, height=10),
                "added.png": ImageMetadata(content_hash="hadd", width=10, height=10),
                "unchanged.png": ImageMetadata(content_hash="hsame", width=10, height=10),
            },
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={
                "changed_a.png": ImageMetadata(content_hash="ha0", width=10, height=10),
                "changed_b.png": ImageMetadata(content_hash="hb0", width=10, height=10),
                "changed_c.png": ImageMetadata(content_hash="hc0", width=10, height=10),
                "unchanged.png": ImageMetadata(content_hash="hsame", width=10, height=10),
            },
            diff_threshold=None,
        )
        return head_manifest, base_manifest

    def _diff_result(self):
        from sentry.preprod.snapshots.image_diff.types import DiffResult

        return DiffResult(
            diff_mask_png=b"png",
            changed_pixels=50,
            total_pixels=100,
            aligned_height=10,
            before_width=10,
            before_height=10,
            after_width=10,
            after_height=10,
        )

    def _fake_fetch(self, session, key_prefix, hashes):
        return {h: b"img" for h in hashes}, set()

    def test_full_flow_reaches_success(self):
        from sentry.preprod.snapshots.tasks import (
            compare_snapshots,
            finalize_snapshot_comparison,
            process_snapshot_comparison_chunk,
        )

        head_artifact, base_artifact = self._setup_artifacts()
        head_manifest, base_manifest = self._build_manifests()
        stored = {
            "head_manifest": orjson.dumps(head_manifest.dict()),
            "base_manifest": orjson.dumps(base_manifest.dict()),
        }
        session = _dict_backed_session(stored)

        dispatched: list[dict] = []

        kwargs = dict(
            project_id=self.project.id,
            org_id=self.organization.id,
            head_artifact_id=head_artifact.id,
            base_artifact_id=base_artifact.id,
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.MAX_PIXELS_PER_BATCH", 1),
            patch(
                "sentry.preprod.snapshots.tasks._fetch_batch_images", side_effect=self._fake_fetch
            ),
            patch(
                "sentry.preprod.snapshots.tasks.compare_images_batch",
                side_effect=lambda pairs, server: [self._diff_result() for _ in pairs],
            ),
            patch("sentry.preprod.snapshots.tasks.OdiffServer"),
            patch("sentry.preprod.snapshots.tasks.update_preprod_snapshot_vcs"),
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async",
                side_effect=lambda kwargs, **_: dispatched.append(kwargs),
            ),
            patch("sentry.preprod.snapshots.tasks.finalize_snapshot_comparison.apply_async"),
        ):
            compare_snapshots(**kwargs)

            comparison = PreprodSnapshotComparison.objects.get(
                head_snapshot_metrics__preprod_artifact=head_artifact
            )
            assert comparison.chunks_total == 3
            assert len(dispatched) == 3

            for chunk_kwargs in dispatched:
                process_snapshot_comparison_chunk(**chunk_kwargs)
                idx = chunk_kwargs["chunk_index"]
                comparison.refresh_from_db()
                assert idx in comparison.chunks_done_indices
                prefix = (
                    f"{self.organization.id}/{self.project.id}/"
                    f"{head_artifact.id}/{base_artifact.id}"
                )
                assert f"{prefix}/chunks/{idx}.json" in stored

            finalize_snapshot_comparison(
                comparison_id=comparison.id,
                org_id=self.organization.id,
                project_id=self.project.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 3
        assert comparison.images_added == 1
        assert comparison.images_unchanged == 1
        prefix = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
        assert f"{prefix}/comparison.json" in stored
        manifest = orjson.loads(stored[f"{prefix}/comparison.json"])
        assert manifest["summary"]["changed"] == 3
        assert manifest["summary"]["added"] == 1
