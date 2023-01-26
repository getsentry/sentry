from symbolic import ProguardMapper

from sentry.eventstore.models import Event
from sentry.models import Project, ProjectDebugFile
from sentry.utils.safe import get_path


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
    dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [uuid], features=["mapping"])
    debug_file_path = dif_paths.get(uuid)
    if debug_file_path is None:
        return

    mapper = ProguardMapper.open(debug_file_path)
    if not mapper.has_line_info:
        return

    return mapper


def deobfuscate_view_hierarchy(event_data: Event, project: Project, view_hierarchy):
    proguard_uuid = get_proguard_uuid(event_data)
    mapper = get_proguard_mapper(proguard_uuid, project)

    windows_to_deobfuscate = [*view_hierarchy.get("windows")]
    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        window["type"] = mapper.remap_class(window.get("type")) or window.get("type")
        if window.get("children"):
            windows_to_deobfuscate.extend(window.get("children"))

    return {
        "rendering_system": view_hierarchy.get("rendering_system"),
        "windows": view_hierarchy.get("windows"),
    }
