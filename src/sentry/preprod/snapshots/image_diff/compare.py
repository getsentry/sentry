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

BASE_THRESHOLD = 0.15
COLOR_SENSITIVE_THRESHOLD = 0.0225
DEFAULT_THRESHOLD_SCALE = 25


def _to_pil_image(source: bytes | Image.Image) -> Image.Image:
    if isinstance(source, bytes):
        return Image.open(io.BytesIO(source))
    return source


def _mask_from_diff_output(output_path: Path) -> Image.Image:
    with Image.open(output_path) as img:
        alpha = img.convert("RGBA").split()[3]
    return alpha.point(lambda px: 255 if px > 0 else 0)


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
    results: list[DiffResult | None] = []

    for idx, (before, after) in enumerate(pairs):
        try:
            results.append(
                _compare_single_pair(
                    idx, before, after, server, tmpdir_path, base_thresh, color_thresh
                )
            )
        except Exception:
            logger.exception("Failed to compare image pair %d", idx)
            results.append(None)

    return results


def _compare_single_pair(
    idx: int,
    before: bytes | Image.Image,
    after: bytes | Image.Image,
    server: OdiffServer,
    tmpdir_path: Path,
    base_thresh: float,
    color_thresh: float,
) -> DiffResult:
    before_img = _to_pil_image(before)
    after_img = _to_pil_image(after)

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

    base_resp = server.compare(
        before_path,
        after_path,
        base_output,
        threshold=base_thresh,
        antialiasing=True,
        outputDiffMask=True,
    )
    color_resp = server.compare(
        before_path,
        after_path,
        color_output,
        threshold=color_thresh,
        antialiasing=True,
        outputDiffMask=True,
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
            diff_mask = diff_mask.resize((max_w, max_h), Image.NEAREST)

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
