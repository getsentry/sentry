from __future__ import annotations

import base64
import io
import logging
import tempfile
from collections.abc import Sequence
from pathlib import Path

from PIL import Image

from .odiff import OdiffServer
from .types import DiffResult

logger = logging.getLogger(__name__)

# Nonzero defaults are intentional: threshold=0 means exact pixel matching where
# font antialiasing, subpixel smoothing, and minor rendering engine variance all
# flag as changes, making diffs unusably noisy for visual regression.
#
# odiff pixel color distance threshold — ignores antialiasing artifacts
BASE_THRESHOLD = 0.15
# Lower threshold to catch subtle color shifts missed by base
COLOR_SENSITIVE_THRESHOLD = 0.0225
# Default scale factor for the public API threshold parameter
DEFAULT_THRESHOLD_SCALE = 25


# PIL (Pillow) Image — the standard Python image manipulation library.
# Used here to decode raw bytes into pixel data for saving as PNG files
# that odiff can compare.
def _as_image(source: bytes | Image.Image) -> Image.Image:
    if isinstance(source, bytes):
        img = Image.open(io.BytesIO(source))
        img.load()
        return img
    return source


def _mask_from_diff_output(output_path: Path) -> Image.Image:
    with Image.open(output_path) as img:
        rgba = img.convert("RGBA")
    try:
        bands = rgba.split()
        alpha = bands[3]
        mask = alpha.point(lambda px: 255 if px > 0 else 0)
        return mask
    finally:
        rgba.close()


def _encode_mask_png_base64(mask: Image.Image) -> str:
    buf = io.BytesIO()
    mask.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def compare_images(
    before: bytes | Image.Image,
    after: bytes | Image.Image,
    threshold: int = DEFAULT_THRESHOLD_SCALE,
) -> DiffResult | None:
    return compare_images_batch([(before, after)], threshold)[0]


def compare_images_batch(
    pairs: Sequence[tuple[bytes | Image.Image, bytes | Image.Image]],
    threshold: int = DEFAULT_THRESHOLD_SCALE,
    server: OdiffServer | None = None,
) -> list[DiffResult | None]:
    scale = threshold / DEFAULT_THRESHOLD_SCALE
    base_thresh = BASE_THRESHOLD * scale
    color_thresh = COLOR_SENSITIVE_THRESHOLD * scale

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        if server is not None:
            return _compare_pairs(pairs, server, tmpdir_path, base_thresh, color_thresh)
        with OdiffServer() as new_server:
            return _compare_pairs(pairs, new_server, tmpdir_path, base_thresh, color_thresh)


def _compare_pairs(
    pairs: Sequence[tuple[bytes | Image.Image, bytes | Image.Image]],
    server: OdiffServer,
    tmpdir_path: Path,
    base_thresh: float,
    color_thresh: float,
) -> list[DiffResult | None]:
    return [
        _compare_single_pair(idx, before, after, server, tmpdir_path, base_thresh, color_thresh)
        for idx, (before, after) in enumerate(pairs)
    ]


def _compare_single_pair(
    idx: int,
    before: bytes | Image.Image,
    after: bytes | Image.Image,
    server: OdiffServer,
    tmpdir_path: Path,
    base_thresh: float,
    color_thresh: float,
) -> DiffResult | None:
    before_img: Image.Image | None = None
    after_img: Image.Image | None = None
    diff_mask: Image.Image | None = None
    try:
        before_img = _as_image(before)
        after_img = _as_image(after)
        bw, bh = before_img.size
        aw, ah = after_img.size
        max_w = max(bw, aw)
        max_h = max(bh, ah)

        before_path = tmpdir_path / f"before_{idx}.png"
        after_path = tmpdir_path / f"after_{idx}.png"
        before_img.save(before_path, "PNG")
        after_img.save(after_path, "PNG")

        base_output = tmpdir_path / f"diff_base_{idx}.png"
        color_output = tmpdir_path / f"diff_color_{idx}.png"

        # Two-pass comparison strategy:
        # Pass 1 uses a higher threshold to ignore antialiasing, subpixel
        # smoothing, and font rendering noise — only real layout/content
        # changes survive. Pass 2 uses a lower threshold to catch subtle
        # color shifts that pass 1 misses. We take whichever pass reports
        # a higher diff percentage, avoiding both false positives (noisy
        # antialiasing diffs) and false negatives (missed color changes).
        base_resp = server.compare(
            before_path,
            after_path,
            base_output,
            threshold=base_thresh,
            antialiasing=True,
            outputDiffMask=True,
            failOnLayoutDiff=False,
        )
        color_resp = server.compare(
            before_path,
            after_path,
            color_output,
            threshold=color_thresh,
            antialiasing=True,
            outputDiffMask=True,
            failOnLayoutDiff=False,
        )

        base_count = base_resp.get("diffCount", 0)
        color_count = color_resp.get("diffCount", 0)
        base_pct = base_resp.get("diffPercentage", 0.0)
        color_pct = color_resp.get("diffPercentage", 0.0)

        if color_pct > base_pct:
            chosen_output = color_output
            changed_pixels = color_count
            diff_pct = color_pct
        else:
            chosen_output = base_output
            changed_pixels = base_count
            diff_pct = base_pct

        total_pixels = max_w * max_h
        diff_score = diff_pct / 100.0

        if changed_pixels == 0:
            diff_mask = Image.new("L", (max_w, max_h), 0)
        elif not chosen_output.exists():
            raise RuntimeError(f"odiff did not produce output file: {chosen_output}")
        else:
            diff_mask = _mask_from_diff_output(chosen_output)
            if diff_mask.size != (max_w, max_h):
                old_mask = diff_mask
                diff_mask = diff_mask.resize((max_w, max_h), Image.NEAREST)
                old_mask.close()

        diff_mask_png = _encode_mask_png_base64(diff_mask)

        return DiffResult(
            diff_mask_png=diff_mask_png,
            diff_score=diff_score,
            changed_pixels=changed_pixels,
            total_pixels=total_pixels,
            aligned_height=max_h,
            width=max_w,
            before_width=bw,
            before_height=bh,
            after_width=aw,
            after_height=ah,
        )
    except Exception:
        logger.exception("Failed to compare image pair %d", idx)
        return None
    finally:
        if before_img is not None and isinstance(before, bytes):
            before_img.close()
        if after_img is not None and isinstance(after, bytes):
            after_img.close()
        if diff_mask is not None:
            diff_mask.close()
