from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from sentry.preprod.api.models.public.snapshots import (
    SnapshotDiffPairResponseDict,
    SnapshotImageResponseDict,
)
from sentry.preprod.snapshots.image_serialization import build_base_image_dict, minimal_image_dict

logger = logging.getLogger(__name__)


@dataclass
class CategorizedComparison:
    changed: list[SnapshotDiffPairResponseDict] = field(default_factory=list)
    added: list[SnapshotImageResponseDict] = field(default_factory=list)
    removed: list[SnapshotImageResponseDict] = field(default_factory=list)
    unchanged: list[SnapshotImageResponseDict] = field(default_factory=list)
    renamed: list[SnapshotDiffPairResponseDict] = field(default_factory=list)
    errored: list[SnapshotDiffPairResponseDict] = field(default_factory=list)
    skipped: list[SnapshotImageResponseDict] = field(default_factory=list)


def _base_image_from_comparison(name: str, img: dict[str, Any]) -> SnapshotImageResponseDict:
    return minimal_image_dict(
        key=img.get("base_hash") or "",
        display_name=name,
        image_file_name=name,
        width=img.get("before_width") or 0,
        height=img.get("before_height") or 0,
    )


def _diff_pair(
    base_image: SnapshotImageResponseDict,
    head_image: SnapshotImageResponseDict,
    diff_image_key: str | None = None,
    diff: float | None = None,
) -> SnapshotDiffPairResponseDict:
    return {
        "base_image": base_image,
        "head_image": head_image,
        "diff_image_key": diff_image_key,
        "diff": diff,
    }


def categorize_comparison_images(
    comparison_images: dict[str, dict[str, Any]],
    head_images_by_file_name: dict[str, SnapshotImageResponseDict],
    base_images: dict[str, dict[str, Any]] | None,
) -> CategorizedComparison:
    result = CategorizedComparison()

    base_images = base_images or {}

    def get_base_image(key: str | None) -> SnapshotImageResponseDict | None:
        if key is None:
            return None
        meta = base_images.get(key)
        if meta is None:
            return None
        return build_base_image_dict(key, meta)

    for name, img in sorted(comparison_images.items()):
        head_img = head_images_by_file_name.get(name)
        status = img.get("status")

        if status == "changed":
            if head_img:
                changed_pixels = img.get("changed_pixels")
                total_pixels = img.get("total_pixels")
                result.changed.append(
                    _diff_pair(
                        base_image=get_base_image(name) or _base_image_from_comparison(name, img),
                        head_image=head_img,
                        diff_image_key=img.get("diff_mask_image_id"),
                        diff=changed_pixels / total_pixels
                        if changed_pixels is not None and total_pixels
                        else None,
                    )
                )
        elif status == "added":
            if head_img:
                result.added.append(head_img)
        elif status == "removed":
            result.removed.append(get_base_image(name) or _base_image_from_comparison(name, img))
        elif status == "renamed":
            if head_img:
                old_name = img.get("previous_image_file_name")
                result.renamed.append(
                    _diff_pair(
                        base_image=get_base_image(old_name)
                        or _base_image_from_comparison(old_name or name, img),
                        head_image=head_img,
                    )
                )
        elif status == "unchanged":
            if head_img:
                result.unchanged.append(head_img)
        elif status == "errored":
            head = head_img or minimal_image_dict(
                key=img.get("head_hash") or img.get("base_hash") or "",
                display_name=name,
                image_file_name=name,
                width=img.get("after_width") or img.get("before_width") or 0,
                height=img.get("after_height") or img.get("before_height") or 0,
            )
            result.errored.append(
                _diff_pair(
                    base_image=get_base_image(name) or _base_image_from_comparison(name, img),
                    head_image=head,
                )
            )
        elif status == "skipped":
            result.skipped.append(get_base_image(name) or _base_image_from_comparison(name, img))
        else:
            logger.warning(
                "preprod.snapshot.unexpected_comparison_status",
                extra={"status": status, "image_file_name": name},
            )

    result.changed.sort(key=lambda p: p["diff"] or 0, reverse=True)
    return result
