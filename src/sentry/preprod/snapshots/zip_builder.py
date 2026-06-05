from __future__ import annotations

import logging
import zipfile
from collections import defaultdict
from concurrent.futures import as_completed
from typing import IO

from objectstore_client import RequestError, Session

from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.zip import is_unsafe_path

logger = logging.getLogger(__name__)

FETCH_MAX_WORKERS = 16


def archive_object_key(artifact_id: int) -> str:
    return f"snapshot_archives/{artifact_id}.zip"


def archive_exists(session: Session, key: str) -> bool:
    try:
        session.get(key).payload.close()
    except RequestError as e:
        if e.status == 404:
            return False
        raise
    return True


class SnapshotZipBuildError(Exception):
    pass


def build_snapshot_zip(
    manifest: SnapshotManifest,
    session: Session,
    key_prefix: str,
    out: IO[bytes],
    artifact_id: int,
) -> None:
    """Build a ZIP_STORED archive of all snapshot images into ``out``.

    Images sharing a content hash are fetched once and written under each
    original filename. Raises SnapshotZipBuildError if any image fails to
    fetch, so callers never persist a silently-incomplete archive.
    """
    hash_to_filenames: dict[str, list[str]] = defaultdict(list)
    for filename, meta in manifest.images.items():
        if not is_unsafe_path(filename):
            hash_to_filenames[meta.content_hash].append(filename)
    unique_hashes = list(hash_to_filenames.keys())

    logger.info(
        "preprod_snapshot_zip.zip_build_started",
        extra={"preprod_artifact_id": artifact_id, "image_hash_count": len(unique_hashes)},
    )

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
        logger.info(
            "preprod_snapshot_zip.zip_build_completed",
            extra={"preprod_artifact_id": artifact_id, "image_hash_count": len(unique_hashes)},
        )
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
        zf.close()
