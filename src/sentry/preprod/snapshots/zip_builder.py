from __future__ import annotations

import logging
import zipfile
from collections import defaultdict
from collections.abc import Callable
from concurrent.futures import as_completed
from typing import IO, NotRequired, TypedDict, Unpack, cast

from objectstore_client import Session

from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.zip import is_unsafe_path

logger = logging.getLogger(__name__)

FETCH_MAX_WORKERS = 16

ZIP_EXTRAS_KEY = "images_zip"


class ZipState(TypedDict):
    status: NotRequired[str]
    enqueued_at: NotRequired[str]
    file_id: NotRequired[int | None]
    size: NotRequired[int]
    built_at: NotRequired[str]
    progress: NotRequired[int]


class SnapshotZipBuildError(Exception):
    pass


def build_snapshot_zip(
    manifest: SnapshotManifest,
    session: Session,
    key_prefix: str,
    out: IO[bytes],
    artifact_id: int,
    progress_callback: Callable[[int], None] | None = None,
) -> None:
    """Build a ZIP_STORED archive of all snapshot images into ``out``.

    Images sharing a content hash are fetched once and written under each
    original filename. Raises SnapshotZipBuildError if any image fails to
    fetch, so callers never persist a silently-incomplete archive.

    If ``progress_callback`` is given it is invoked from the main thread with
    an integer percent (0-100), only when that percent advances, so a caller
    can persist build progress without one write per image.
    """
    hash_to_filenames: dict[str, list[str]] = defaultdict(list)
    for filename, meta in manifest.images.items():
        if not is_unsafe_path(filename):
            hash_to_filenames[meta.content_hash].append(filename)
    unique_hashes = list(hash_to_filenames.keys())
    total = len(unique_hashes)
    completed = 0
    last_pct = -1

    def fetch_image(image_hash: str) -> tuple[str, bytes | None]:
        try:
            data = session.get(f"{key_prefix}/{image_hash}").payload.read()
            return (image_hash, data)
        except Exception:
            logger.exception(
                "preprod_snapshot_zip.image_fetch_failed",
                extra={"preprod_artifact_id": artifact_id, "image_hash": image_hash},
            )
            return (image_hash, None)

    zf = zipfile.ZipFile(out, "w", zipfile.ZIP_STORED)
    executor = ContextPropagatingThreadPoolExecutor(max_workers=FETCH_MAX_WORKERS)
    try:
        futures = [executor.submit(fetch_image, h) for h in unique_hashes]
        for future in as_completed(futures):
            image_hash, data = future.result()
            if data is None:
                raise SnapshotZipBuildError(
                    f"failed to fetch image {image_hash} for artifact {artifact_id}"
                )
            for filename in hash_to_filenames[image_hash]:
                zf.writestr(filename, data)
            completed += 1
            if progress_callback is not None:
                pct = completed * 100 // total
                if pct != last_pct:
                    last_pct = pct
                    progress_callback(pct)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
        zf.close()


def get_zip_state(metrics: PreprodSnapshotMetrics) -> ZipState | None:
    return (metrics.extras or {}).get(ZIP_EXTRAS_KEY)


def set_zip_state(metrics: PreprodSnapshotMetrics, **fields: Unpack[ZipState]) -> ZipState:
    extras = dict(metrics.extras or {})
    state = dict(extras.get(ZIP_EXTRAS_KEY) or {})
    state.update(fields)
    extras[ZIP_EXTRAS_KEY] = state
    metrics.update(extras=extras)
    return cast(ZipState, state)
