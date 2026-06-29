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
    image_metadata_extras,
)


class CategorizedComparison(BaseModel):
    changed: list[SnapshotDiffPair] = []
    added: list[SnapshotImageResponse] = []
    removed: list[SnapshotImageResponse] = []
    unchanged: list[SnapshotImageResponse] = []
    renamed: list[SnapshotDiffPair] = []
    errored: list[SnapshotDiffPair] = []
    skipped: list[SnapshotImageResponse] = []


def _base_image_from_comparison(name: str, img: ComparisonImageResult) -> SnapshotImageResponse:
    return SnapshotImageResponse(
        key=img.base_hash or "",
        display_name=name,
        image_file_name=name,
        width=img.before_width or 0,
        height=img.before_height or 0,
    )


def _build_base_image(key: str, meta: ImageMetadata) -> SnapshotImageResponse:
    return SnapshotImageResponse(
        **image_metadata_extras(meta, exclude={"key", "image_file_name"}),
        key=meta.content_hash,
        display_name=meta.display_name,
        image_file_name=key,
        group=meta.group,
        width=meta.width,
        height=meta.height,
        description=meta.description,
        tags=meta.tags,
    )


def categorize_comparison_images(
    comparison_data: ComparisonManifest,
    head_images_by_file_name: dict[str, SnapshotImageResponse],
    base_manifest: SnapshotManifest | None,
) -> CategorizedComparison:
    result = CategorizedComparison()

    base_images = base_manifest.images if base_manifest else {}

    def get_base_image(key: str | None) -> SnapshotImageResponse | None:
        if key is None:
            return None
        meta = base_images.get(key)
        if meta is None:
            return None
        return _build_base_image(key, meta)

    for name, img in sorted(comparison_data.images.items()):
        head_img = head_images_by_file_name.get(name)

        if img.status == "changed":
            if head_img:
                result.changed.append(
                    SnapshotDiffPair(
                        base_image=get_base_image(name) or _base_image_from_comparison(name, img),
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
            result.removed.append(get_base_image(name) or _base_image_from_comparison(name, img))
        elif img.status == "renamed":
            if head_img:
                old_name = img.previous_image_file_name
                result.renamed.append(
                    SnapshotDiffPair(
                        base_image=get_base_image(old_name)
                        or _base_image_from_comparison(old_name or name, img),
                        head_image=head_img,
                    )
                )
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
                    base_image=get_base_image(name) or _base_image_from_comparison(name, img),
                    head_image=head,
                )
            )
        elif img.status == "skipped":
            result.skipped.append(get_base_image(name) or _base_image_from_comparison(name, img))

    result.changed.sort(key=lambda p: p.diff or 0, reverse=True)
    return result
