import sentry_sdk
from symbolic import ProguardMapper

from sentry import features
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.eventstore.models import Event
from sentry.models import Project, ProjectDebugFile
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.safe import get_path

CACHE_TIMEOUT = 3600


def has_proguard_file(data):
    """
    Checks whether an event contains a proguard file
    """
    images = get_path(data, "debug_meta", "images", filter=True)
    return get_path(images, 0, "type") == "proguard"


def get_proguard_uuid(event: Event):
    uuid = None
    if "debug_meta" in event:
        images = event["debug_meta"].get("images", [])
        if not isinstance(images, list):
            return
        if event.get("project") is None:
            return

        for image in images:
            if image.get("type") == "proguard":
                uuid = image.get("uuid")

    return uuid


def get_proguard_mapper(uuid: str, project: Project):
    with sentry_sdk.start_span(op="proguard.get_proguard_mapper"):
        dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [uuid], features=["mapping"])
        debug_file_path = dif_paths.get(uuid)
        if debug_file_path is None:
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
    proguard_uuid = get_proguard_uuid(event_data)
    if proguard_uuid is None:
        return

    mapper = get_proguard_mapper(proguard_uuid, project)
    if mapper is None:
        return

    windows_to_deobfuscate = [*view_hierarchy.get("windows")]
    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        window["type"] = mapper.remap_class(window.get("type")) or window.get("type")
        if window.get("children"):
            windows_to_deobfuscate.extend(window.get("children"))


def deobfuscate_view_hierarchy(data):
    project = Project.objects.get_from_cache(id=data["project"])

    if not features.has(
        "organizations:view-hierarchy-deobfuscation", project.organization, actor=None
    ):
        return

    with sentry_sdk.start_span(op="proguard.deobfuscate_view_hierarchy"):
        cache_key = cache_key_for_event(data)
        attachments = [*attachment_cache.get(cache_key)]

        if not any(attachment.type == "event.view_hierarchy" for attachment in attachments):
            return

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
