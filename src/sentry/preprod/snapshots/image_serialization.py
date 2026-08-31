from __future__ import annotations

from typing import Any, cast

from sentry.preprod.api.models.public.snapshots import SnapshotImageResponseDict
from sentry.preprod.snapshots.manifest import image_dict_extras


def build_base_image_dict(image_file_name: str, image: dict[str, Any]) -> SnapshotImageResponseDict:
    # cast(): the spread of arbitrary passthrough extras (Config.extra == "allow")
    # can't be expressed as a closed TypedDict literal; the declared keys still type.
    return cast(
        SnapshotImageResponseDict,
        {
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
        },
    )


def build_head_image_dict(
    image_file_name: str, image: dict[str, Any], global_diff_threshold: float | None
) -> SnapshotImageResponseDict:
    dt = image.get("diff_threshold")
    return cast(
        SnapshotImageResponseDict,
        {
            **build_base_image_dict(image_file_name, image),
            "diff_threshold": dt if dt is not None else global_diff_threshold,
        },
    )


def minimal_image_dict(
    key: str, display_name: str, image_file_name: str, width: int, height: int
) -> SnapshotImageResponseDict:
    return {
        "key": key,
        "display_name": display_name,
        "group": None,
        "image_file_name": image_file_name,
        "width": width,
        "height": height,
        "canvas_theme": None,
    }
