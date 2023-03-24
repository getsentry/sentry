import os
import re

import sentry_sdk

from sentry.eventstore.models import Event
from sentry.lang.java.utils import deobfuscation_template
from sentry.models import Project, ProjectDebugFile
from sentry.utils import json
from sentry.utils.safe import get_path


def is_valid_image(image):
    return bool(image) and image.get("type") == "dart-symbols" and image.get("uuid") is not None


def has_dart_symbols_file(data):
    """
    Checks whether an event contains a dart symbols file
    """
    images = get_path(data, "debug_meta", "images", filter=True)
    return get_path(images, 0, "type") == "dart-symbols"


def get_dart_symbols_images(event: Event):
    images = set()
    for image in get_path(event, "debug_meta", "images", filter=is_valid_image, default=()):
        images.add(str(image["uuid"]).lower())
    return images


def generate_dart_symbols_map(uuid: str, project: Project):
    """
    NOTE: This function makes assumptions about the structure of the debug file
    since we are not currently storing the file. This may need to be updated if we
    decide to do some pre-processing on the debug file before storing it.

    In its current state, the debug file is expected to be a json file with a list
    of strings. The strings alternate between deobfuscated and obfuscated names.

    If we preprocess it into a map, we can remove this code and just fetch the file.
    """
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
        obfuscated_to_deobfuscated_name_map = {}
        try:
            if len(debug_array) % 2 != 0:
                raise Exception("Debug array contains an odd number of elements")

            # Iterate by 2 since the array is a list of string pairs
            for i in range(0, len(debug_array), 2):
                deobfuscated_name = debug_array[i]
                obfuscated_name = debug_array[i + 1]
                obfuscated_to_deobfuscated_name_map[obfuscated_name] = deobfuscated_name
        except Exception as err:
            # The expectation is that the debug array is a list of strings
            sentry_sdk.capture_exception(err)
            return

    return obfuscated_to_deobfuscated_name_map


def _deobfuscate_view_hierarchy(event_data: Event, project: Project, view_hierarchy):
    """
    Deobfuscates a view hierarchy in-place.

    If we're unable to fetch a dart symbols uuid, then the view hierarchy remains unmodified.
    """
    dart_symbols_uuids = get_dart_symbols_images(event_data)
    if len(dart_symbols_uuids) == 0:
        return

    with sentry_sdk.start_span(op="dart_symbols.deobfuscate_view_hierarchy_data"):
        # Obfuscated type values are either in the form of "xyz" or "xyz<abc>" where
        # both "xyz" or "abc" need to be deobfuscated. It may also be possible for
        # the values to be more complicated such as "_xyz", so the regex should capture
        # values other than "<" and ">".
        TYPE_REGEX = r"([^<>]+)(?:<([^<>]+)>)?"
        for dart_symbols_uuid in dart_symbols_uuids:
            map = generate_dart_symbols_map(dart_symbols_uuid, project)
            if map is None:
                return

            windows_to_deobfuscate = [*view_hierarchy.get("windows")]
            while windows_to_deobfuscate:
                window = windows_to_deobfuscate.pop()

                obfuscated_values = re.findall(TYPE_REGEX, window.get("type"))
                for obfuscated_value in obfuscated_values:
                    if obfuscated_value is not None and obfuscated_value in map:
                        window["type"] = window["type"].replace(
                            obfuscated_value, map[obfuscated_value]
                        )

                if children := window.get("children"):
                    windows_to_deobfuscate.extend(children)


def deobfuscate_view_hierarchy(data):
    return deobfuscation_template(data, "dart_symbols", _deobfuscate_view_hierarchy)
