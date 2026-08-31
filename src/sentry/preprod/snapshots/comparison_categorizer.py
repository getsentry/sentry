from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sentry.preprod.snapshots.manifest import image_dict_extras

# Image and diff-pair payloads are plain dicts matching the shape the response
# previously produced via pydantic .dict(); see image builders below.
ImageDict = dict[str, Any]


@dataclass
class CategorizedComparison:
    changed: list[ImageDict] = field(default_factory=list)
    added: list[ImageDict] = field(default_factory=list)
    removed: list[ImageDict] = field(default_factory=list)
    unchanged: list[ImageDict] = field(default_factory=list)
    renamed: list[ImageDict] = field(default_factory=list)
    errored: list[ImageDict] = field(default_factory=list)
    skipped: list[ImageDict] = field(default_factory=list)


def build_head_image_dict(
    image_file_name: str, image: ImageDict, global_diff_threshold: float | None
) -> ImageDict:
    dt = image.get("diff_threshold")
    return {
        **image_dict_extras(image),
        "key": image["content_hash"],
        "display_name": image.get("display_name"),
        "group": image.get("group"),
        "image_file_name": image_file_name,
        "width": image["width"],
        "height": image["height"],
        "canvas_theme": image.get("canvas_theme"),
        "tags": image.get("tags"),
        "description": image.get("description"),
        "diff_threshold": dt if dt is not None else global_diff_threshold,
    }


def _build_base_image(image_file_name: str, meta: ImageDict) -> ImageDict:
    return {
        **image_dict_extras(meta),
        "key": meta["content_hash"],
        "display_name": meta.get("display_name"),
        "group": meta.get("group"),
        "image_file_name": image_file_name,
        "width": meta["width"],
        "height": meta["height"],
        "canvas_theme": meta.get("canvas_theme"),
        "tags": meta.get("tags"),
        "description": meta.get("description"),
    }


def _bare_image(
    key: str, display_name: str, image_file_name: str, width: int, height: int
) -> ImageDict:
    return {
        "key": key,
        "display_name": display_name,
        "group": None,
        "image_file_name": image_file_name,
        "width": width,
        "height": height,
        "canvas_theme": None,
    }


def _base_image_from_comparison(name: str, img: ImageDict) -> ImageDict:
    return _bare_image(
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
        return _build_base_image(key, meta)

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
            head = head_img or _bare_image(
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
