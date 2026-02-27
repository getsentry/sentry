from __future__ import annotations

from pydantic import BaseModel

from sentry.preprod.api.models.snapshots.project_preprod_snapshot_models import (
    SnapshotDiffPair,
    SnapshotImageResponse,
)
from sentry.preprod.snapshots.manifest import (
    ComparisonImageResult,
    ComparisonManifest,
    ImageMetadata,
    SnapshotManifest,
)


class CategorizedComparison(BaseModel):
    changed: list[SnapshotDiffPair] = []
    added: list[SnapshotImageResponse] = []
    removed: list[SnapshotImageResponse] = []
    unchanged: list[SnapshotImageResponse] = []
    errored: list[SnapshotDiffPair] = []


def _base_image_from_comparison(name: str, img: ComparisonImageResult) -> SnapshotImageResponse:
    return SnapshotImageResponse(
        key=img.base_hash or "",
        display_name=name,
        image_file_name=name,
        width=img.before_width or 0,
        height=img.before_height or 0,
    )


def _build_base_images(
    base_images: dict[str, ImageMetadata],
) -> dict[str, SnapshotImageResponse]:
    result: dict[str, SnapshotImageResponse] = {}
    for key, meta in base_images.items():
        result[meta.image_file_name] = SnapshotImageResponse(
            key=key,
            display_name=meta.display_name,
            image_file_name=meta.image_file_name,
            width=meta.width,
            height=meta.height,
        )
    return result


def categorize_comparison_images(
    comparison_data: ComparisonManifest,
    head_images_by_file_name: dict[str, SnapshotImageResponse],
    base_manifest: SnapshotManifest | None,
) -> CategorizedComparison:
    result = CategorizedComparison()

    base_images_by_file_name = _build_base_images(base_manifest.images) if base_manifest else {}

    for name, img in sorted(comparison_data.images.items()):
        head_img = head_images_by_file_name.get(name)
        base_img = base_images_by_file_name.get(name)

        if img.status == "changed":
            if head_img:
                result.changed.append(
                    SnapshotDiffPair(
                        base_image=base_img or _base_image_from_comparison(name, img),
                        head_image=head_img,
                        diff_image_key=img.diff_mask_image_id,
                        diff=img.changed_pixels / img.total_pixels
                        if img.changed_pixels is not None and img.total_pixels
                        else None,
                    )
                )
        elif img.status == "added":
            if head_img:
                result.added.append(head_img)
        elif img.status == "removed":
            result.removed.append(base_img or _base_image_from_comparison(name, img))
        elif img.status == "unchanged":
            if head_img:
                result.unchanged.append(head_img)
        elif img.status == "errored":
            head = head_img or SnapshotImageResponse(
                key=img.head_hash or img.base_hash or "",
                display_name=name,
                image_file_name=name,
                width=img.after_width or img.before_width or 0,
                height=img.after_height or img.before_height or 0,
            )
            result.errored.append(
                SnapshotDiffPair(
                    base_image=base_img or _base_image_from_comparison(name, img),
                    head_image=head,
                )
            )

    result.changed.sort(key=lambda p: p.diff or 0, reverse=True)
    return result
