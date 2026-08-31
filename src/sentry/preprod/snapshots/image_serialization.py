from __future__ import annotations

from typing import Any

from sentry.preprod.snapshots.manifest import image_dict_extras

# Image payloads are plain dicts matching the shape the response previously
# produced via pydantic SnapshotImageResponse.dict().
ImageDict = dict[str, Any]


def build_base_image_dict(image_file_name: str, image: ImageDict) -> ImageDict:
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
    }


def build_head_image_dict(
    image_file_name: str, image: ImageDict, global_diff_threshold: float | None
) -> ImageDict:
    dt = image.get("diff_threshold")
    return {
        **build_base_image_dict(image_file_name, image),
        "diff_threshold": dt if dt is not None else global_diff_threshold,
    }


def bare_image_dict(
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
