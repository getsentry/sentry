from __future__ import annotations

import os
from typing import Any

import orjson
import sentry_sdk

from sentry.attachments import CachedAttachment, attachment_cache
from sentry.ingest.consumer.processors import CACHE_TIMEOUT
from sentry.lang.java.proguard import open_proguard_mapper
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.stacktraces.processing import StacktraceInfo
from sentry.utils import metrics
from sentry.utils.cache import cache_key_for_event
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


def get_proguard_mapper(uuid: str, project: Project):
    with sentry_sdk.start_span(op="proguard.fetch_debug_files") as span:
        dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [uuid], features=["mapping"])
        debug_file_path = dif_paths.get(uuid)
        if debug_file_path is None:
            return

        try:
            proguard_file_size_in_mb = os.path.getsize(debug_file_path) / (1024 * 1024.0)
            span.set_tag("proguard_file_size_in_mb", proguard_file_size_in_mb)
        except OSError as exc:
            sentry_sdk.capture_exception(exc)
            return

    mapper = open_proguard_mapper(debug_file_path)

    if not mapper.has_line_info:
        return

    return mapper


@sentry_sdk.trace
def deobfuscation_template(data, map_type, deobfuscation_fn):
    """
    Template for operations involved in deobfuscating view hierarchies.

    The provided deobfuscation function is expected to modify the view hierarchy dict in-place.
    """
    project = Project.objects.get_from_cache(id=data["project"])

    cache_key = cache_key_for_event(data)
    attachments = [*attachment_cache.get(cache_key)]

    if not any(attachment.type == "event.view_hierarchy" for attachment in attachments):
        return

    new_attachments = []
    for attachment in attachments:
        if attachment.type == "event.view_hierarchy":
            view_hierarchy = orjson.loads(attachment_cache.get_data(attachment))
            deobfuscation_fn(data, project, view_hierarchy)

            # Reupload to cache as a unchunked data
            new_attachments.append(
                CachedAttachment(
                    type=attachment.type,
                    id=attachment.id,
                    name=attachment.name,
                    content_type=attachment.content_type,
                    data=orjson.dumps(view_hierarchy),
                    chunks=None,
                )
            )
        else:
            new_attachments.append(attachment)

    attachment_cache.set(cache_key, attachments=new_attachments, timeout=CACHE_TIMEOUT)


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
    # TODO: Can this actually happen if the event platform
    # is not "java"?
    images = get_path(
        data,
        "debug_meta",
        "images",
        filter=lambda x: is_valid_jvm_image(x) or is_valid_proguard_image(x),
        default=(),
    )

    if images:
        metrics.incr("process.java.symbolicate.missing_platform", tags={platform: platform})

        return True

    return False
