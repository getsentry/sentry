from __future__ import annotations

import io
import logging
import tempfile
from collections.abc import Sequence
from pathlib import Path

from PIL import Image

from sentry.utils import metrics

from .odiff import OdiffServer
from .types import DiffResult, ImageSize

logger = logging.getLogger(__name__)

# odiff color-distance sensitivity: pixels within this threshold are treated
# as identical. 0.01 tolerates sub-pixel rendering variance (anti-aliasing,
# font smoothing) while still catching meaningful visual changes.
#
# This is NOT a minimum % changed value, but
# rather adjusts the sensitivity of pixel change detection.
ODIFF_SENSITIVITY_DIFF_THRESHOLD = 0.01
DIFF_ALGORITHM_VERSION = 1

# Maximum pixels in the aligned canvas for a single image comparison.
MAX_DIFF_PIXELS = 40_000_000


def _open_image(source: bytes | Image.Image) -> Image.Image:
    if isinstance(source, bytes):
        return Image.open(io.BytesIO(source))
    return source


def read_image_size(source: bytes) -> ImageSize:
    with Image.open(io.BytesIO(source)) as img:
        return ImageSize(width=img.width, height=img.height)


def get_comparison_size(first: ImageSize, second: ImageSize) -> ImageSize:
    return ImageSize(
        width=max(first.width, second.width),
        height=max(first.height, second.height),
    )


def _pad_to(img: Image.Image, width: int, height: int) -> Image.Image:
    if img.size == (width, height):
        return img
    padded = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    padded.paste(img, (0, 0))
    return padded


def _mask_from_diff_output(output_path: Path) -> Image.Image:
    with Image.open(output_path) as img:
        rgba = img.convert("RGBA")
    bands: tuple[Image.Image, ...] = ()
    try:
        bands = rgba.split()
        alpha = bands[3]
        mask = alpha.point(lambda px: 255 if px > 0 else 0)
        return mask
    finally:
        for band in bands:
            band.close()
        rgba.close()


def _encode_mask_png(mask: Image.Image) -> bytes:
    buf = io.BytesIO()
    mask.save(buf, format="PNG")
    return buf.getvalue()


def compare_images(
    before: bytes | Image.Image,
    after: bytes | Image.Image,
) -> DiffResult | None:
    return compare_images_batch([(before, after)])[0]


def compare_images_batch(
    pairs: Sequence[tuple[bytes | Image.Image, bytes | Image.Image]],
    server: OdiffServer | None = None,
) -> list[DiffResult | None]:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        if server is not None:
            return _compare_pairs(pairs, server, tmpdir_path)
        with OdiffServer() as new_server:
            return _compare_pairs(pairs, new_server, tmpdir_path)


def _compare_pairs(
    pairs: Sequence[tuple[bytes | Image.Image, bytes | Image.Image]],
    server: OdiffServer,
    tmpdir_path: Path,
) -> list[DiffResult | None]:
    return [
        _compare_single_pair(idx, before, after, server, tmpdir_path)
        for idx, (before, after) in enumerate(pairs)
    ]


def _compare_single_pair(
    idx: int,
    before: bytes | Image.Image,
    after: bytes | Image.Image,
    server: OdiffServer,
    tmpdir_path: Path,
) -> DiffResult | None:
    before_img: Image.Image | None = None
    after_img: Image.Image | None = None
    before_padded: Image.Image | None = None
    after_padded: Image.Image | None = None
    diff_mask: Image.Image | None = None
    try:
        before_img = _open_image(before)
        after_img = _open_image(after)
        before_size = ImageSize(width=before_img.width, height=before_img.height)
        after_size = ImageSize(width=after_img.width, height=after_img.height)
        comparison_size = get_comparison_size(before_size, after_size)

        # Check the dimensions from the image files before decoding or padding them.
        if comparison_size.pixel_count > MAX_DIFF_PIXELS:
            metrics.incr("preprod.snapshots.image_diff.exceeds_pixel_limit")
            logger.warning(
                "preprod.snapshots.image_diff.exceeds_pixel_limit",
                extra={
                    "pair_index": idx,
                    "width": comparison_size.width,
                    "height": comparison_size.height,
                },
            )
            return None

        before_img.load()
        after_img.load()

        before_padded = _pad_to(before_img, comparison_size.width, comparison_size.height)
        after_padded = _pad_to(after_img, comparison_size.width, comparison_size.height)

        before_path = tmpdir_path / f"before_{idx}.png"
        after_path = tmpdir_path / f"after_{idx}.png"
        before_padded.save(before_path, "PNG")
        after_padded.save(after_path, "PNG")

        output_path = tmpdir_path / f"diff_{idx}.png"
        resp = server.compare(
            before_path,
            after_path,
            output_path,
            threshold=ODIFF_SENSITIVITY_DIFF_THRESHOLD,
            antialiasing=True,
            outputDiffMask=True,
        )
        if resp.match:
            changed_pixels = 0
            diff_mask = Image.new("L", comparison_size, 0)
        elif not output_path.exists():
            raise RuntimeError(f"odiff did not produce output file: {output_path}")
        else:
            diff_mask = _mask_from_diff_output(output_path)
            changed_pixels = sum(diff_mask.histogram()[1:])

        diff_mask_png = _encode_mask_png(diff_mask)

        return DiffResult(
            diff_mask_png=diff_mask_png,
            changed_pixels=changed_pixels,
            total_pixels=comparison_size.pixel_count,
            aligned_height=comparison_size.height,
            before_width=before_size.width,
            before_height=before_size.height,
            after_width=after_size.width,
            after_height=after_size.height,
        )
    except Exception:
        logger.exception("Failed to compare image pair %d", idx)
        return None
    finally:
        if before_padded is not None and before_padded is not before_img:
            before_padded.close()
        if after_padded is not None and after_padded is not after_img:
            after_padded.close()
        if before_img is not None and isinstance(before, bytes):
            before_img.close()
        if after_img is not None and isinstance(after, bytes):
            after_img.close()
        if diff_mask is not None:
            diff_mask.close()
