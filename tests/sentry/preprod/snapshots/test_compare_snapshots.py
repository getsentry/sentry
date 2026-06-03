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
