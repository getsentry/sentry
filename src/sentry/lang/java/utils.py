from __future__ import annotations

from typing import int, Any

from sentry.stacktraces.processing import StacktraceInfo
from sentry.utils.safe import get_path

# Platform values that should mark an event
# or frame as being Java for the purposes
# of symbolication.
#
# Strictly speaking, this should probably include
# "android" too—at least we use it in profiling.
JAVA_PLATFORMS = ("java",)


def is_valid_proguard_image(image):
    return bool(image) and image.get("type") == "proguard" and image.get("uuid") is not None


def is_valid_jvm_image(image):
    return bool(image) and image.get("type") == "jvm" and image.get("debug_id") is not None


def has_proguard_file(data):
    """
    Checks whether an event contains a proguard file
    """
    images = get_path(data, "debug_meta", "images", filter=True, default=())
    return any(map(is_valid_proguard_image, images))


def get_proguard_images(event: dict[str, Any]) -> set[str]:
    images = set()
    for image in get_path(
        event, "debug_meta", "images", filter=is_valid_proguard_image, default=()
    ):
        images.add(str(image["uuid"]).lower())
    return images


def get_jvm_images(event: dict[str, Any]) -> set[str]:
    images = set()
    for image in get_path(event, "debug_meta", "images", filter=is_valid_jvm_image, default=()):
        images.add(str(image["debug_id"]).lower())
    return images


def is_jvm_event(data: Any, stacktraces: list[StacktraceInfo]) -> bool:
    """Returns whether `data` is a JVM event, based on its platform,
    the supplied stacktraces, and its images."""

    platform = data.get("platform")

    if platform in JAVA_PLATFORMS:
        return True

    for stacktrace in stacktraces:
        # The platforms of a stacktrace are exactly the platforms of its frames
        # so this is tantamount to checking if any frame has a Java platform.
        if any(x in JAVA_PLATFORMS for x in stacktrace.platforms):
            return True

    # check if there are any JVM or Proguard images
    # we *do* hit this code path, likely for events that don't have platform
    # `"java"` but contain Java view hierarchies.
    images = get_path(
        data,
        "debug_meta",
        "images",
        filter=lambda x: is_valid_jvm_image(x) or is_valid_proguard_image(x),
        default=(),
    )

    if images:
        return True

    return False
