from __future__ import annotations

import os
import re
from typing import Any

import orjson
import sentry_sdk

from sentry.lang.java.utils import deobfuscation_template
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.utils.safe import get_path

# Obfuscated type values are either in the form of "xyz" or "xyz<abc>" where
# both "xyz" or "abc" need to be deobfuscated. It may also be possible for
# the values to be more complicated such as "_xyz", so the regex should capture
# any values other than "<" and ">".
VIEW_HIERARCHY_TYPE_REGEX = re.compile(r"([^<>]+)(?:<([^<>]+)>)?")


def get_dart_symbols_images(event: dict[str, Any]) -> set[str]:
    return {
        str(image["debug_id"]).lower()
        for image in get_path(event, "debug_meta", "images", default=())
    }


def generate_dart_symbols_map(debug_id: str, project: Project):
    """
    Fetches and returns the dart symbols mapping for the given debug_id.

    The file is stored as a JSON object mapping obfuscated names to deobfuscated names.
    For backward compatibility, this function also handles the legacy array format.
    """
    with sentry_sdk.start_span(op="dartsymbolmap.generate_dart_symbols_map") as span:
        try:
            dif_paths = ProjectDebugFile.difcache.fetch_difs(
                project, [debug_id], features=["mapping"]
            )
            debug_file_path = dif_paths.get(debug_id)
            if debug_file_path is None:
                return

            dart_symbols_file_size_in_mb = os.path.getsize(debug_file_path) / (1024 * 1024.0)
            span.set_tag("dartsymbolmap_file_size_in_mb", dart_symbols_file_size_in_mb)

            with open(debug_file_path, "rb") as f:
                data = orjson.loads(f.read())

            if isinstance(data, dict):
                # Already in map format (preprocessed)
                return data
            elif isinstance(data, list):
                # Legacy array format - transform it
                if len(data) % 2 != 0:
                    raise Exception("Debug array contains an odd number of elements")
                # Obfuscated names are the odd indices and deobfuscated names are the even indices
                return dict(zip(data[1::2], data[::2]))
            else:
                raise Exception(f"Unexpected dartsymbolmap format: {type(data)}")
        except Exception as err:
            sentry_sdk.capture_exception(err)
            return


def _deobfuscate_view_hierarchy(event_data: dict[str, Any], project: Project, view_hierarchy):
    """
    Deobfuscates a view hierarchy in-place.

    If we're unable to fetch a dart symbols uuid, then the view hierarchy remains unmodified.
    """
    dart_symbols_uuids = get_dart_symbols_images(event_data)
    if len(dart_symbols_uuids) == 0:
        return

    with sentry_sdk.start_span(op="dartsymbolmap.deobfuscate_view_hierarchy_data"):
        for dart_symbols_uuid in dart_symbols_uuids:
            map = generate_dart_symbols_map(dart_symbols_uuid, project)
            if map is None:
                return

            windows_to_deobfuscate = [*view_hierarchy.get("windows")]
            while windows_to_deobfuscate:
                window = windows_to_deobfuscate.pop()

                if window.get("type") is None:
                    # If there is no type, then skip this window
                    continue

                matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, window.get("type"))
                if not matcher:
                    continue
                obfuscated_values = matcher.groups()
                for obfuscated_value in obfuscated_values:
                    if obfuscated_value is not None and obfuscated_value in map:
                        window["type"] = window["type"].replace(
                            obfuscated_value, map[obfuscated_value]
                        )

                if children := window.get("children"):
                    windows_to_deobfuscate.extend(children)


def deobfuscate_exception_type(data: dict[str, Any]):
    project = Project.objects.get_from_cache(id=data["project"])

    exception_values = data.get("exception", {}).get("values", [])

    debug_ids = get_dart_symbols_images(data)
    if len(debug_ids) == 0:
        return

    with sentry_sdk.start_span(op="dartsymbolmap.deobfuscate_exception_type"):
        if len(debug_ids) == 0:
            return

        if not exception_values:
            return

        # There should only be one mapping file per Flutter build so we can break out of the loop once we find it
        found_mapping_file = False
        for dart_symbols_debug_id in debug_ids:
            if found_mapping_file:
                break

            map = generate_dart_symbols_map(dart_symbols_debug_id, project)
            if map is None:
                return

            found_mapping_file = True

            exception_values = data.get("exception", {}).get("values", [])
            if not exception_values:
                return

            for exception_value in exception_values:
                exception_type = exception_value.get("type")
                if exception_type is None:
                    continue

                before_obfuscation = exception_value["type"]
                exception_value["type"] = map[before_obfuscation]


def deobfuscate_view_hierarchy(data):
    return deobfuscation_template(data, "dartsymbolmap", _deobfuscate_view_hierarchy)
