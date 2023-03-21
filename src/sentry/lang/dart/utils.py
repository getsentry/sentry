import os

import sentry_sdk

from sentry.eventstore.models import Event
from sentry.lang.java.utils import deobfuscation_template
from sentry.models import Project, ProjectDebugFile
from sentry.utils import json
from sentry.utils.safe import get_path


def has_dart_symbols_file(data):
    """
    Checks whether an event contains a dart symbols file
    """
    images = get_path(data, "debug_meta", "images", filter=True)
    return get_path(images, 0, "type") == "dart-symbols"


def get_dart_symbols_images(event: Event):
    images = set()
    for image in get_path(event, "debug_meta", "images", default=()):
        images.add(str(image["uuid"]).lower())
    return images


def generate_dart_symbols_map(uuid: str, project: Project):
    with sentry_sdk.start_span(op="dart_symbols.generate_dart_symbols_map") as span:
        dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [uuid], features=["mapping"])
        debug_file_path = dif_paths.get(uuid)
        if debug_file_path is None:
            return

        try:
            dart_symbols_file_size_in_mb = os.path.getsize(debug_file_path) / (1024 * 1024.0)
            span.set_tag("dart_symbols_file_size_in_mb", dart_symbols_file_size_in_mb)
        except OSError as exc:
            sentry_sdk.capture_exception(exc)
            return

        with open(debug_file_path) as f:
            debug_array = json.loads(f.read())

        # The expectation is that the debug array is a list of strings
        if not isinstance(debug_array, list):
            # TODO(nar): Capture some kind of exception here
            return {}

        map = {}
        for i in range(0, len(debug_array)):
            deobfuscated_name = debug_array[i]
            obfuscated_name = debug_array[i + 1]
            map[obfuscated_name] = deobfuscated_name

    return map


def _deobfuscate_view_hierarchy(event_data: Event, project: Project, view_hierarchy):
    """
    Deobfuscates a view hierarchy in-place.

    If we're unable to fetch a dart symbols uuid, then the view hierarchy remains unmodified.
    """
    dart_symbols_uuids = get_dart_symbols_images(event_data)
    if len(dart_symbols_uuids) == 0:
        return

    with sentry_sdk.start_span(op="dart_symbols.deobfuscate_view_hierarchy_data"):
        for dart_symbols_uuid in dart_symbols_uuids:
            map = generate_dart_symbols_map(dart_symbols_uuid, project)
            if len(map) == 0:
                return

            windows_to_deobfuscate = [*view_hierarchy.get("windows")]
            while windows_to_deobfuscate:
                window = windows_to_deobfuscate.pop()
                # TODO(nar): this needs to do a regex and replace the groups
                window["type"] = map.get(window.get("type"), window.get("type"))
                if children := window.get("children"):
                    windows_to_deobfuscate.extend(children)


def deobfuscate_view_hierarchy(data):
    return deobfuscation_template(data, "dart_symbols", _deobfuscate_view_hierarchy)
