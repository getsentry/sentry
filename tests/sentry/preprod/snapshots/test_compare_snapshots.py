from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.db import IntegrityError, router, transaction
from objectstore_client.client import RequestError

from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotComparisonChunk,
)
from sentry.preprod.snapshots.tasks import _retry_objectstore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class PreprodSnapshotComparisonChunkModelTest(TestCase):
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

    def test_chunk_defaults(self):
        comparison = self._comparison()
        chunk = PreprodSnapshotComparisonChunk.objects.create(comparison=comparison, chunk_index=0)
        assert chunk.state == PreprodSnapshotComparisonChunk.State.PENDING
        assert chunk.attempts == 0
        assert chunk.image_count == 0

    def test_chunk_uniqueness(self):
        comparison = self._comparison()
        PreprodSnapshotComparisonChunk.objects.create(comparison=comparison, chunk_index=0)
        with pytest.raises(IntegrityError):
            with transaction.atomic(using=router.db_for_write(PreprodSnapshotComparisonChunk)):
                PreprodSnapshotComparisonChunk.objects.create(comparison=comparison, chunk_index=0)

    def test_chunks_total_nullable_default(self):
        comparison = self._comparison()
        assert comparison.chunks_total is None


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
        result = MagicMock()
        if key in manifests_by_key:
            result.payload.read.return_value = manifests_by_key[key]
        else:
            raise Exception(f"Key not found: {key}")
        return result

    session.get.side_effect = _get
    return session


@cell_silo_test
class ProcessChunkTest(TestCase):
    def test_chunk_processes_slice_and_marks_done(self):
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
        chunk = PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison, chunk_index=0, image_count=1
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

        chunk.refresh_from_db()
        assert chunk.state == PreprodSnapshotComparisonChunk.State.DONE
        assert f"{prefix}/chunks/0.json" in stored


@cell_silo_test
class PollSnapshotComparisonTest(TestCase):
    def _comparison(self, chunks_total, state=PreprodSnapshotComparison.State.PROCESSING):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head, base_snapshot_metrics=base, state=state
        )
        comparison.chunks_total = chunks_total
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

    def test_terminal_state_stops(self):
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1, state=PreprodSnapshotComparison.State.SUCCESS)
        with patch(
            "sentry.preprod.snapshots.tasks.poll_snapshot_comparison.apply_async"
        ) as reschedule:
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert not reschedule.called

    def test_all_done_finalizes(self):
        from sentry.preprod.snapshots.manifest import (
            ChunkResult,
            ComparisonImageResult,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison,
            chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.DONE,
            image_count=1,
        )
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        plan = ComparisonPlan(
            head_artifact_id=h.id, base_artifact_id=b.id, chunks=[], non_diff_images={}
        )
        chunk_result = ChunkResult(
            chunk_index=0, images={"a.png": ComparisonImageResult(status="changed")}
        )
        stored = {
            f"{prefix}/plan.json": orjson.dumps(plan.dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(chunk_result.dict()),
        }
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 1
        assert f"{prefix}/comparison.json" in stored

    def test_finalize_invokes_auto_approve(self):
        from sentry.preprod.snapshots.manifest import (
            ChunkResult,
            ComparisonImageResult,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison,
            chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.DONE,
            image_count=1,
        )
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        plan = ComparisonPlan(
            head_artifact_id=h.id, base_artifact_id=b.id, chunks=[], non_diff_images={}
        )
        chunk_result = ChunkResult(
            chunk_index=0, images={"a.png": ComparisonImageResult(status="changed")}
        )
        stored = {
            f"{prefix}/plan.json": orjson.dumps(plan.dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(chunk_result.dict()),
        }
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )
        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks._try_auto_approve_snapshot") as mock_auto_approve,
        ):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert mock_auto_approve.call_count == 1
        called_head_artifact, called_manifest, called_session = mock_auto_approve.call_args.args
        assert called_head_artifact.id == h.id
        assert called_manifest.head_artifact_id == h.id
        assert called_session is session

    def test_finalize_is_exactly_once(self):
        from sentry.preprod.snapshots.manifest import (
            ChunkResult,
            ComparisonImageResult,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison,
            chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.DONE,
            image_count=1,
        )
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        plan = ComparisonPlan(
            head_artifact_id=h.id, base_artifact_id=b.id, chunks=[], non_diff_images={}
        )
        chunk_result = ChunkResult(
            chunk_index=0, images={"a.png": ComparisonImageResult(status="changed")}
        )
        stored = {
            f"{prefix}/plan.json": orjson.dumps(plan.dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(chunk_result.dict()),
        }
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )
        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks._try_auto_approve_snapshot") as mock_auto_approve,
        ):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert mock_auto_approve.call_count == 1

    def test_dead_orchestrator_redispatched(self):
        from datetime import timedelta

        from django.utils import timezone

        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(None)
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
            date_updated=timezone.now() - timedelta(seconds=10_000)
        )
        with (
            patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as orch,
            patch("sentry.preprod.snapshots.tasks.poll_snapshot_comparison.apply_async"),
        ):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert orch.called

    def test_stale_chunk_redispatched(self):
        from datetime import timedelta

        from django.utils import timezone

        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        chunk = PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison,
            chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.PROCESSING,
            attempts=0,
        )
        PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
            date_updated=timezone.now() - timedelta(seconds=10_000)
        )
        with (
            patch(
                "sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async"
            ) as redispatch,
            patch("sentry.preprod.snapshots.tasks.poll_snapshot_comparison.apply_async"),
        ):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert redispatch.called
        chunk.refresh_from_db()
        assert chunk.attempts == 1

    def test_partial_success_marks_failed_chunk_images_errored(self):
        from datetime import timedelta

        from django.utils import timezone

        from sentry.preprod.snapshots.manifest import (
            ChunkAssignment,
            ChunkCandidate,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
            date_added=timezone.now() - timedelta(seconds=100_000)
        )
        PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison,
            chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.PROCESSING,
            image_count=1,
        )
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        plan = ComparisonPlan(
            head_artifact_id=h.id,
            base_artifact_id=b.id,
            chunks=[
                ChunkAssignment(
                    chunk_index=0,
                    candidates=[
                        ChunkCandidate(
                            name="a.png",
                            head_hash="h",
                            base_hash="bb",
                            pixel_count=10,
                            diff_threshold=0.0,
                        )
                    ],
                )
            ],
            non_diff_images={},
        )
        stored = {f"{prefix}/plan.json": orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(
            key, contents
        )
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        comparison_manifest = orjson.loads(stored[f"{prefix}/comparison.json"])
        assert comparison_manifest["summary"]["errored"] == 1
