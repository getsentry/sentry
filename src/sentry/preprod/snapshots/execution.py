from __future__ import annotations

import logging
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from objectstore_client import Session

from sentry.preprod.snapshots.constants import MAX_PIXELS_PER_BATCH
from sentry.preprod.snapshots.image_diff.compare import (
    MAX_DIFF_PIXELS,
    compare_images_batch,
    get_comparison_size,
    read_image_size,
)
from sentry.preprod.snapshots.image_diff.odiff import OdiffServer
from sentry.preprod.snapshots.image_diff.types import DiffResult, ImageSize
from sentry.preprod.snapshots.storage import _retry_objectstore
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImagePair:
    before_hash: str
    after_hash: str
    include_mask: bool = True


@dataclass(frozen=True)
class ImageDiffFailure:
    reason: str


def _fetch_batch_images(
    session: Session, key_prefix: str, hashes: set[str], *, directory: Path
) -> tuple[dict[str, Path], set[str]]:
    def fetch(item: tuple[int, str]) -> tuple[str, Path | None]:
        index, image_hash = item
        destination = directory / str(index)

        def download() -> None:
            response = session.get(f"{key_prefix}/{image_hash}")
            if response is None:
                raise FileNotFoundError("Image does not exist in objectstore")
            try:
                with destination.open("wb") as output:
                    shutil.copyfileobj(response.payload, output, length=1024 * 1024)
            finally:
                response.payload.close()

        try:
            _retry_objectstore(download)
            return image_hash, destination
        except Exception:
            return image_hash, None

    images: dict[str, Path] = {}
    failed: set[str] = set()
    with ContextPropagatingThreadPoolExecutor(max_workers=8) as executor:
        for image_hash, path in executor.map(fetch, enumerate(sorted(hashes))):
            if path is None:
                failed.add(image_hash)
            else:
                images[image_hash] = path
    return images, failed


def measure_image_pairs(
    session: Session, pairs: Sequence[ImagePair], org_id: int, project_id: int
) -> list[DiffResult | ImageDiffFailure]:
    if not pairs:
        return []
    with TemporaryDirectory() as directory, OdiffServer() as server:
        hashes = {
            image_hash for pair in pairs for image_hash in (pair.before_hash, pair.after_hash)
        }
        fetched, failed = _fetch_batch_images(
            session, f"{org_id}/{project_id}", hashes, directory=Path(directory)
        )
        sizes: dict[str, ImageSize | None] = {}
        for image_hash, path in fetched.items():
            try:
                sizes[image_hash] = read_image_size(path)
            except Exception as error:
                sizes[image_hash] = None
                metrics.incr("preprod.snapshots.image_diff.header_read_failed")
                logger.warning(
                    "preprod.snapshots.image_diff.header_read_failed",
                    extra={
                        "org_id": org_id,
                        "project_id": project_id,
                        "image_hash": image_hash,
                        "error_type": type(error).__name__,
                    },
                )

        outcomes: dict[int, DiffResult | ImageDiffFailure] = {}
        eligible: list[int] = []
        batch_pixels = 0
        for index, pair in enumerate(pairs):
            if pair.before_hash in failed or pair.after_hash in failed:
                outcomes[index] = ImageDiffFailure("image_fetch_failed")
                continue
            before_size = sizes[pair.before_hash]
            after_size = sizes[pair.after_hash]
            if before_size is None or after_size is None:
                outcomes[index] = ImageDiffFailure("image_processing_failed")
                continue
            size = get_comparison_size(before_size, after_size)
            if size.pixel_count > MAX_DIFF_PIXELS:
                outcomes[index] = ImageDiffFailure("exceeds_pixel_limit")
                metrics.incr("preprod.snapshots.image_diff.exceeds_pixel_limit")
                logger.warning(
                    "preprod.snapshots.image_diff.exceeds_pixel_limit",
                    extra={
                        "org_id": org_id,
                        "project_id": project_id,
                        "head_hash": pair.after_hash,
                        "base_hash": pair.before_hash,
                        "width": size.width,
                        "height": size.height,
                    },
                )
                continue
            if batch_pixels + size.pixel_count > MAX_PIXELS_PER_BATCH:
                outcomes[index] = ImageDiffFailure("exceeds_batch_pixel_limit")
                metrics.incr("preprod.snapshots.image_diff.exceeds_batch_pixel_limit")
                logger.warning(
                    "preprod.snapshots.image_diff.exceeds_batch_pixel_limit",
                    extra={
                        "org_id": org_id,
                        "project_id": project_id,
                        "head_hash": pair.after_hash,
                        "base_hash": pair.before_hash,
                        "current_batch_pixels": batch_pixels,
                        "comparison_pixels": size.pixel_count,
                    },
                )
                continue
            batch_pixels += size.pixel_count
            eligible.append(index)

        measurements = compare_images_batch(
            [
                (fetched[pairs[index].before_hash], fetched[pairs[index].after_hash])
                for index in eligible
            ],
            server=server,
            include_masks=[pairs[index].include_mask for index in eligible],
        )
        for index, measurement in zip(eligible, measurements, strict=True):
            outcomes[index] = (
                measurement
                if measurement is not None
                else ImageDiffFailure("image_processing_failed")
            )
        return [outcomes[index] for index in range(len(pairs))]
