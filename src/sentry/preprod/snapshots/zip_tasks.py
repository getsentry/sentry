from __future__ import annotations

import logging
from datetime import datetime, timezone
from tempfile import NamedTemporaryFile

import orjson
from taskbroker_client.retry import Retry

from sentry.models.files.file import File
from sentry.objectstore import get_preprod_session
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.zip_builder import build_snapshot_zip, get_zip_state, set_zip_state
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)

ZIP_FILE_TYPE = "preprod_snapshot_images.zip"


@instrumented_task(
    name="sentry.preprod.tasks.build_snapshot_images_zip",
    namespace=preprod_tasks,
    retry=Retry(times=2),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=900,
)
def build_snapshot_images_zip(
    org_id: int, project_id: int, artifact_id: int, build_token: str
) -> None:
    try:
        snapshot_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact_id=artifact_id)
    except PreprodSnapshotMetrics.DoesNotExist:
        return

    def _superseded() -> bool:
        # Each enqueue stamps a fresh ``enqueued_at`` token. After the staleness
        # re-enqueue an older worker can still finish; if the stored token no
        # longer matches ours, a newer build owns the state and we must not touch
        # it (otherwise we'd clobber its progress/result or delete its File). A
        # deleted metrics row (artifact removed mid-build) also counts as superseded.
        try:
            snapshot_metrics.refresh_from_db()
        except PreprodSnapshotMetrics.DoesNotExist:
            return True
        return (get_zip_state(snapshot_metrics) or {}).get("enqueued_at") != build_token

    manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
    if not manifest_key:
        if not _superseded():
            set_zip_state(snapshot_metrics, status="failed")
        return

    session = get_preprod_session(org_id, project_id)

    file_obj: File | None = None
    try:
        manifest_data = orjson.loads(session.get(manifest_key).payload.read())
        manifest = SnapshotManifest(**manifest_data)
        key_prefix = f"{org_id}/{project_id}"

        def _on_progress(pct: int) -> None:
            # Refresh so progress merges into the latest extras blob rather than
            # clobbering concurrent writes to other keys with a stale copy.
            snapshot_metrics.refresh_from_db()
            if (get_zip_state(snapshot_metrics) or {}).get("enqueued_at") != build_token:
                return
            set_zip_state(snapshot_metrics, progress=pct)

        with NamedTemporaryFile() as tmp:
            build_snapshot_zip(
                manifest,
                session,
                key_prefix,
                tmp,
                artifact_id=artifact_id,
                progress_callback=_on_progress,
            )
            tmp.flush()
            tmp.seek(0)
            file_obj = File.objects.create(
                name=f"snapshot_images_{artifact_id}.zip",
                type=ZIP_FILE_TYPE,
                headers={"Content-Type": "application/zip"},
            )
            file_obj.putfile(tmp)
    except Exception:
        logger.exception(
            "preprod_snapshot_zip.build_failed",
            extra={"preprod_artifact_id": artifact_id},
        )
        if file_obj is not None:
            file_obj.delete()
        if not _superseded():
            set_zip_state(snapshot_metrics, status="failed")
        return

    assert file_obj is not None
    try:
        snapshot_metrics.refresh_from_db()
    except PreprodSnapshotMetrics.DoesNotExist:
        # The artifact (and its metrics row) was deleted while the ZIP was
        # building; discard the now-orphaned archive.
        file_obj.delete()
        return
    old = get_zip_state(snapshot_metrics) or {}
    if old.get("enqueued_at") != build_token:
        # A newer build superseded us; discard our archive and leave its state intact.
        file_obj.delete()
        return
    set_zip_state(
        snapshot_metrics,
        status="ready",
        file_id=file_obj.id,
        size=file_obj.size,
        built_at=datetime.now(timezone.utc).isoformat(),
    )
    old_file_id = old.get("file_id")
    if old_file_id and old_file_id != file_obj.id:
        old_file = File.objects.filter(id=old_file_id).first()
        if old_file is not None:
            old_file.delete()
