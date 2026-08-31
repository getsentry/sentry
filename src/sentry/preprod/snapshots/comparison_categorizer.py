from __future__ import annotations

from dataclasses import dataclass, field

from sentry.preprod.snapshots.image_serialization import (
    ImageDict,
    bare_image_dict,
    build_base_image_dict,
)


@dataclass
class CategorizedComparison:
    changed: list[ImageDict] = field(default_factory=list)
    added: list[ImageDict] = field(default_factory=list)
    removed: list[ImageDict] = field(default_factory=list)
    unchanged: list[ImageDict] = field(default_factory=list)
    renamed: list[ImageDict] = field(default_factory=list)
    errored: list[ImageDict] = field(default_factory=list)
    skipped: list[ImageDict] = field(default_factory=list)


def _base_image_from_comparison(name: str, img: ImageDict) -> ImageDict:
    return bare_image_dict(
        key=img.get("base_hash") or "",
        display_name=name,
        image_file_name=name,
        width=img.get("before_width") or 0,
        height=img.get("before_height") or 0,
    )


def _diff_pair(
    base_image: ImageDict,
    head_image: ImageDict,
    diff_image_key: str | None = None,
    diff: float | None = None,
) -> ImageDict:
    return {
        "base_image": base_image,
        "head_image": head_image,
        "diff_image_key": diff_image_key,
        "diff": diff,
    }


def categorize_comparison_images(
    comparison_images: dict[str, ImageDict],
    head_images_by_file_name: dict[str, ImageDict],
    base_images: dict[str, ImageDict] | None,
) -> CategorizedComparison:
    result = CategorizedComparison()

    base_images = base_images or {}

    def get_base_image(key: str | None) -> ImageDict | None:
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
            head = head_img or bare_image_dict(
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

    result.changed.sort(key=lambda p: p["diff"] or 0, reverse=True)
    return result
