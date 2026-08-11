from __future__ import annotations

import logging
import zipfile
from collections import defaultdict
from concurrent.futures import as_completed
from typing import IO

from objectstore_client import Session

from sentry.preprod.snapshots.constants import SNAPSHOT_ARCHIVE_MANIFEST_FILENAME
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.zip import is_unsafe_path

logger = logging.getLogger(__name__)

FETCH_MAX_WORKERS = 16


def archive_object_key(artifact_id: int) -> str:
    return f"snapshot_archives/{artifact_id}.zip"


def archive_exists(session: Session, key: str) -> bool:
    archive = session.get(key)
    if archive is None:
        return False
    archive.payload.close()
    return True


class SnapshotZipBuildError(Exception):
    pass


def build_snapshot_zip(
    manifest: SnapshotManifest,
    session: Session,
    key_prefix: str,
    out: IO[bytes],
    artifact_id: int,
    manifest_bytes: bytes | None = None,
) -> None:
    """Build an archive of snapshot images and an optional manifest into ``out``.

    Images sharing a content hash are fetched once and written under each
    original filename. Raises SnapshotZipBuildError if any image fails to
    fetch, so callers never persist a silently-incomplete archive.
    """
    hash_to_filenames: dict[str, list[str]] = defaultdict(list)
    for filename, meta in manifest.images.items():
        if manifest_bytes is not None and filename == SNAPSHOT_ARCHIVE_MANIFEST_FILENAME:
            raise SnapshotZipBuildError(
                f"snapshot image filename conflicts with {SNAPSHOT_ARCHIVE_MANIFEST_FILENAME}"
            )
        if not is_unsafe_path(filename):
            hash_to_filenames[meta.content_hash].append(filename)
    unique_hashes = list(hash_to_filenames.keys())

    logger.info(
        "preprod_snapshot_zip.zip_build_started",
        extra={"preprod_artifact_id": artifact_id, "image_hash_count": len(unique_hashes)},
    )

    def fetch_image(image_hash: str) -> tuple[str, bytes | None]:
        try:
            response = session.get(f"{key_prefix}/{image_hash}")
            if response is None:
                raise FileNotFoundError("Image does not exist in objectstore")
            data = response.payload.read()
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
        if manifest_bytes is not None:
            zf.writestr(
                SNAPSHOT_ARCHIVE_MANIFEST_FILENAME,
                manifest_bytes,
                compress_type=zipfile.ZIP_DEFLATED,
            )
        logger.info(
            "preprod_snapshot_zip.zip_build_completed",
            extra={"preprod_artifact_id": artifact_id, "image_hash_count": len(unique_hashes)},
        )
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
        zf.close()
