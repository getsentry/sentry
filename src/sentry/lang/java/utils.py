import os

import sentry_sdk
from symbolic import ProguardMapper

from sentry.attachments import CachedAttachment, attachment_cache
from sentry.eventstore.models import Event
from sentry.models import Project, ProjectDebugFile
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.options import sample_modulo
from sentry.utils.safe import get_path

CACHE_TIMEOUT = 3600


def is_valid_image(image):
    return bool(image) and image.get("type") == "proguard" and image.get("uuid") is not None


def has_proguard_file(data):
    """
    Checks whether an event contains a proguard file
    """
    images = get_path(data, "debug_meta", "images", filter=True)
    return get_path(images, 0, "type") == "proguard"


def get_proguard_images(event: Event):
    images = set()
    for image in get_path(event, "debug_meta", "images", filter=is_valid_image, default=()):
        images.add(str(image["uuid"]).lower())
    return images


def get_proguard_mapper(uuid: str, project: Project):
    with sentry_sdk.start_span(op="proguard.get_proguard_mapper") as span:
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

        mapper = ProguardMapper.open(debug_file_path)
    if not mapper.has_line_info:
        return

    return mapper


def _deobfuscate_view_hierarchy(event_data: Event, project: Project, view_hierarchy):
    """
    Deobfuscates a view hierarchy in-place.

    If we're unable to fetch a ProGuard uuid or unable to init the mapper,
    then the view hierarchy remains unmodified.
    """
    proguard_uuids = get_proguard_images(event_data)
    if len(proguard_uuids) == 0:
        return

    with sentry_sdk.start_span(op="proguard.deobfuscate_view_hierarchy_data"):
        for proguard_uuid in proguard_uuids:
            mapper = get_proguard_mapper(proguard_uuid, project)
            if mapper is None:
                return

            windows_to_deobfuscate = [*view_hierarchy.get("windows")]
            while windows_to_deobfuscate:
                window = windows_to_deobfuscate.pop()
                window["type"] = mapper.remap_class(window.get("type")) or window.get("type")
                if children := window.get("children"):
                    windows_to_deobfuscate.extend(children)


def deobfuscate_view_hierarchy(data):
    project = Project.objects.get_from_cache(id=data["project"])

    if not sample_modulo(
        "processing.view-hierarchies-deobfuscation-general-availability", project.organization.id
    ):
        return

    cache_key = cache_key_for_event(data)
    attachments = [*attachment_cache.get(cache_key)]

    if not any(attachment.type == "event.view_hierarchy" for attachment in attachments):
        return

    with sentry_sdk.start_transaction(name="proguard.deobfuscate_view_hierarchy", sampled=True):
        new_attachments = []
        for attachment in attachments:
            if attachment.type == "event.view_hierarchy":
                view_hierarchy = json.loads(attachment_cache.get_data(attachment))
                _deobfuscate_view_hierarchy(data, project, view_hierarchy)

                # Reupload to cache as a unchunked data
                new_attachments.append(
                    CachedAttachment(
                        type=attachment.type,
                        id=attachment.id,
                        name=attachment.name,
                        content_type=attachment.content_type,
                        data=json.dumps_htmlsafe(view_hierarchy).encode(),
                        chunks=None,
                    )
                )
            else:
                new_attachments.append(attachment)

        attachment_cache.set(cache_key, attachments=new_attachments, timeout=CACHE_TIMEOUT)
