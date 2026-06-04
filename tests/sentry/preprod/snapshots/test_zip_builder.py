from __future__ import annotations

import zipfile
from io import BytesIO
from unittest.mock import MagicMock

import pytest

from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.zip_builder import (
    SnapshotZipBuildError,
    build_snapshot_zip,
    get_zip_state,
    set_zip_state,
)
from sentry.testutils.cases import TestCase


def _meta(content_hash: str) -> ImageMetadata:
    return ImageMetadata(content_hash=content_hash, width=10, height=10)


def _session(data_by_key: dict[str, bytes]) -> MagicMock:
    def _get(key):
        result = MagicMock()
        if key in data_by_key:
            result.payload.read.return_value = data_by_key[key]
        else:
            raise Exception(f"missing key: {key}")
        return result

    session = MagicMock()
    session.get.side_effect = _get
    return session


def test_build_snapshot_zip_writes_all_images_and_dedupes() -> None:
    manifest = SnapshotManifest(
        images={
            "a.png": _meta("hash_a"),
            "b.png": _meta("hash_b"),
            "c.png": _meta("hash_a"),  # shares hash_a -> dedup fetch, two filenames
        }
    )
    key_prefix = "1/2"
    session = _session({"1/2/hash_a": b"AAA", "1/2/hash_b": b"BBB"})

    out = BytesIO()
    build_snapshot_zip(manifest, session, key_prefix, out, artifact_id=99)

    out.seek(0)
    with zipfile.ZipFile(out) as zf:
        assert sorted(zf.namelist()) == ["a.png", "b.png", "c.png"]
        assert zf.read("a.png") == b"AAA"
        assert zf.read("c.png") == b"AAA"
        assert zf.read("b.png") == b"BBB"
    # hash_a fetched once despite two filenames
    assert session.get.call_count == 2


def test_build_snapshot_zip_reports_monotonic_progress() -> None:
    images = {f"img_{i}.png": _meta(f"hash_{i}") for i in range(4)}
    manifest = SnapshotManifest(images=images)
    session = _session({f"1/2/hash_{i}": b"X" for i in range(4)})

    seen: list[int] = []
    build_snapshot_zip(
        manifest, session, "1/2", BytesIO(), artifact_id=99, progress_callback=seen.append
    )

    # one callback per unique image, advancing to 100, never decreasing
    assert seen == sorted(seen)
    assert seen[-1] == 100
    assert len(seen) == 4


def test_build_snapshot_zip_progress_dedupes_repeated_percent() -> None:
    # 200 unique images -> integer percent repeats; callback must fire only on change
    images = {f"img_{i}.png": _meta(f"hash_{i}") for i in range(200)}
    manifest = SnapshotManifest(images=images)
    session = _session({f"1/2/hash_{i}": b"X" for i in range(200)})

    seen: list[int] = []
    build_snapshot_zip(
        manifest, session, "1/2", BytesIO(), artifact_id=99, progress_callback=seen.append
    )

    assert seen == sorted(set(seen))
    assert seen[-1] == 100
    # deduped to one call per integer percent (0..100), not one per image
    assert len(seen) == 101


def test_build_snapshot_zip_empty_manifest() -> None:
    manifest = SnapshotManifest(images={})
    session = _session({})

    out = BytesIO()
    build_snapshot_zip(manifest, session, "1/2", out, artifact_id=99)

    out.seek(0)
    with zipfile.ZipFile(out) as zf:
        assert zf.namelist() == []
    assert session.get.call_count == 0


def test_build_snapshot_zip_raises_on_fetch_failure() -> None:
    manifest = SnapshotManifest(images={"a.png": _meta("hash_a")})
    session = _session({})  # every get raises

    with pytest.raises(SnapshotZipBuildError):
        build_snapshot_zip(manifest, session, "1/2", BytesIO(), artifact_id=99)


class ZipStateTest(TestCase):
    def _metrics(self, extras=None):
        from sentry.preprod.models import PreprodArtifact
        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics

        project = self.create_project()
        artifact = PreprodArtifact.objects.create(
            project=project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        return PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact, image_count=0, extras=extras
        )

    def test_get_zip_state_none_when_absent(self) -> None:
        assert get_zip_state(self._metrics()) is None
        assert get_zip_state(self._metrics(extras={"manifest_key": "k"})) is None

    def test_set_zip_state_merges_without_clobbering(self) -> None:
        metrics = self._metrics(extras={"manifest_key": "k"})
        set_zip_state(metrics, status="building", enqueued_at="2026-06-03T00:00:00Z")
        metrics.refresh_from_db()
        assert metrics.extras["manifest_key"] == "k"
        assert metrics.extras["images_zip"]["status"] == "building"
        state = get_zip_state(metrics)
        assert state is not None
        assert state["status"] == "building"


from unittest.mock import patch

import orjson

from sentry.models.files.file import File

BUILD_TASK_SESSION = "sentry.preprod.snapshots.zip_tasks.get_preprod_session"


class BuildSnapshotImagesZipTaskTest(TestCase):
    def _setup(self, images):
        from sentry.preprod.models import PreprodArtifact
        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics

        org = self.organization
        project = self.create_project(organization=org)
        artifact = PreprodArtifact.objects.create(
            project=project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        manifest_key = f"{org.id}/{project.id}/{artifact.id}/manifest.json"
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=len(images),
            extras={"manifest_key": manifest_key, "images_zip": {"status": "building"}},
        )
        manifest_json = orjson.dumps({"images": images})
        return org, project, artifact, manifest_key, manifest_json

    def _session(self, data_by_key):
        from unittest.mock import MagicMock

        def _get(key):
            result = MagicMock()
            result.payload.read.return_value = data_by_key[key]
            return result

        session = MagicMock()
        session.get.side_effect = _get
        return session

    @patch(BUILD_TASK_SESSION)
    def test_builds_zip_and_marks_ready(self, mock_get_session):
        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
        from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip

        images = {"a.png": {"content_hash": "h1", "width": 1, "height": 1}}
        org, project, artifact, manifest_key, manifest_json = self._setup(images)
        mock_get_session.return_value = self._session(
            {manifest_key: manifest_json, f"{org.id}/{project.id}/h1": b"AAA"}
        )

        build_snapshot_images_zip(org_id=org.id, project_id=project.id, artifact_id=artifact.id)

        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)
        state = get_zip_state(metrics)
        assert state is not None
        assert state["status"] == "ready"
        assert state["file_id"] is not None
        assert state["progress"] == 100
        file_obj = File.objects.get(id=state["file_id"])
        import zipfile

        with file_obj.getfile() as fp, zipfile.ZipFile(fp) as zf:
            assert zf.read("a.png") == b"AAA"
        assert state["size"] == file_obj.size

    @patch(BUILD_TASK_SESSION)
    def test_marks_failed_on_fetch_error(self, mock_get_session):
        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
        from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip

        images = {"a.png": {"content_hash": "h1", "width": 1, "height": 1}}
        org, project, artifact, manifest_key, manifest_json = self._setup(images)
        # manifest present but image missing -> builder raises
        mock_get_session.return_value = self._session({manifest_key: manifest_json})

        build_snapshot_images_zip(org_id=org.id, project_id=project.id, artifact_id=artifact.id)

        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)
        state = get_zip_state(metrics)
        assert state is not None
        assert state["status"] == "failed"

    @patch(BUILD_TASK_SESSION)
    def test_cleans_up_file_when_putfile_fails(self, mock_get_session):
        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
        from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip

        images = {"a.png": {"content_hash": "h1", "width": 1, "height": 1}}
        org, project, artifact, manifest_key, manifest_json = self._setup(images)
        mock_get_session.return_value = self._session(
            {manifest_key: manifest_json, f"{org.id}/{project.id}/h1": b"AAA"}
        )

        with patch.object(File, "putfile", side_effect=Exception("boom")):
            build_snapshot_images_zip(org_id=org.id, project_id=project.id, artifact_id=artifact.id)

        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)
        state = get_zip_state(metrics)
        assert state is not None
        assert state["status"] == "failed"
        assert not File.objects.filter(name=f"snapshot_images_{artifact.id}.zip").exists()

    @patch(BUILD_TASK_SESSION)
    def test_rebuild_schedules_blob_cleanup_for_old_file(self, mock_get_session):
        from io import BytesIO

        from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
        from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip

        old_file = File.objects.create(name="old.zip", type="preprod_snapshot_images.zip")
        old_file.putfile(BytesIO(b"OLD-ZIP-CONTENT"))
        old_blob_ids = list(old_file.blobs.values_list("id", flat=True))
        assert old_blob_ids

        images = {"a.png": {"content_hash": "h1", "width": 1, "height": 1}}
        org, project, artifact, manifest_key, manifest_json = self._setup(images)
        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)
        set_zip_state(metrics, status="ready", file_id=old_file.id)

        mock_get_session.return_value = self._session(
            {manifest_key: manifest_json, f"{org.id}/{project.id}/h1": b"AAA"}
        )

        with (
            patch(
                "sentry.tasks.files.delete_unreferenced_blobs_region.apply_async"
            ) as mock_blob_cleanup,
            self.captureOnCommitCallbacks(execute=True),
        ):
            build_snapshot_images_zip(org_id=org.id, project_id=project.id, artifact_id=artifact.id)

        assert not File.objects.filter(id=old_file.id).exists()
        state = get_zip_state(PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact))
        assert state is not None
        assert state["status"] == "ready"
        assert state["file_id"] != old_file.id
        mock_blob_cleanup.assert_called_once()
        assert mock_blob_cleanup.call_args.kwargs["kwargs"]["blob_ids"] == old_blob_ids
