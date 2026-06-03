from __future__ import annotations

import pytest
from django.db import IntegrityError, router, transaction

from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotComparisonChunk,
)
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
