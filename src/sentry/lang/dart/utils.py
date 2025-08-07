from __future__ import annotations

import os
from collections.abc import MutableMapping
from typing import Any

import orjson
import sentry_sdk

from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.utils.safe import get_path

# Obfuscated type values are either in the form of "xyz" or "xyz<abc>" where
# both "xyz" or "abc" need to be deobfuscated. It may also be possible for
# the values to be more complicated such as "_xyz", so the regex should capture
# any values other than "<" and ">".
# VIEW_HIERARCHY_TYPE_REGEX = re.compile(r"([^<>]+)(?:<([^<>]+)>)?")


def get_debug_meta_image_ids(event: dict[str, Any]) -> set[str]:
    images = get_path(event, "debug_meta", "images", default=())
    if not isinstance(images, (list, tuple)):
        return set()
    return {
        str(image["debug_id"]).lower()
        for image in images
        if isinstance(image, dict) and "debug_id" in image
    }


def generate_dart_symbols_map(debug_ids: list[str], project: Project):
    """
    Fetches and returns the dart symbols mapping for the first available debug_id.
    There should only be one mapping file per Flutter build, so we return the first mapping found.
    """
    with sentry_sdk.start_span(op="dartsymbolmap.generate_dart_symbols_map") as span:
        dif_paths = ProjectDebugFile.difcache.fetch_difs(project, debug_ids, features=["mapping"])
        if not dif_paths:
            return None

        debug_file_path = next(iter(dif_paths.values()))

        try:
            dart_symbols_file_size_in_mb = os.path.getsize(debug_file_path) / (1024 * 1024.0)
            span.set_tag("dartsymbolmap_file_size_in_mb", dart_symbols_file_size_in_mb)

            with open(debug_file_path, "rb") as f:
                data = orjson.loads(f.read())

            if isinstance(data, list):
                # Array format - transform it to map
                if len(data) % 2 != 0:
                    raise Exception("Debug array contains an odd number of elements")
                # Obfuscated names are the odd indices and deobfuscated names are the even indices
                return dict(zip(data[1::2], data[::2]))
            else:
                raise Exception(f"Unexpected dartsymbolmap format: {type(data)}")
        except Exception as err:
            sentry_sdk.capture_exception(err)
            return None


def deobfuscate_exception_type(data: MutableMapping[str, Any]):
    """
    Deobfuscates exception types in-place.

    If we're unable to fetch a dart symbols mapping file, then the exception types remain unmodified.
    """
    project = Project.objects.get_from_cache(id=data["project"])

    debug_ids = get_debug_meta_image_ids(dict(data))
    if len(debug_ids) == 0:
        return

    exceptions = data.get("exception", {}).get("values", [])
    if not exceptions:
        return

    with sentry_sdk.start_span(op="dartsymbolmap.deobfuscate_exception_type"):
        symbol_map = generate_dart_symbols_map(list(debug_ids), project)
        if symbol_map is None:
            return

        for exception in exceptions:
            exception_type = exception.get("type")
            if exception_type is None:
                continue

            deobfuscated_type = symbol_map.get(exception_type)
            if deobfuscated_type is not None:
                exception["type"] = deobfuscated_type

        # TODO(buenaflor): Future enhancement - deobfuscate exception values
        #
        # Exception values may contain obfuscated symbols in patterns like:
        # - "Instance of 'obfuscated_symbol'"
        # - General text containing obfuscated symbols
        # This could be implemented by extracting symbols from these patterns
        # and looking them up in the symbol map for replacement.


# TODO(buenaflor): Add this back in when we decide to deobfuscate view hierarchies
#
# def _deobfuscate_view_hierarchy(event_data: dict[str, Any], project: Project, view_hierarchy):
#     """
#     Deobfuscates a view hierarchy in-place.

#     If we're unable to fetch a dart symbols uuid, then the view hierarchy remains unmodified.
#     """
#     dart_symbols_uuids = get_debug_meta_image_ids(event_data)
#     if len(dart_symbols_uuids) == 0:
#         return

#     with sentry_sdk.start_span(op="dartsymbolmap.deobfuscate_view_hierarchy_data"):
#         for dart_symbols_uuid in dart_symbols_uuids:
#             map = generate_dart_symbols_map(dart_symbols_uuid, project)
#             if map is None:
#                 return

#             windows_to_deobfuscate = [*view_hierarchy.get("windows")]
#             while windows_to_deobfuscate:
#                 window = windows_to_deobfuscate.pop()

#                 if window.get("type") is None:
#                     # If there is no type, then skip this window
#                     continue

#                 matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, window.get("type"))
#                 if not matcher:
#                     continue
#                 obfuscated_values = matcher.groups()
#                 for obfuscated_value in obfuscated_values:
#                     if obfuscated_value is not None and obfuscated_value in map:
#                         window["type"] = window["type"].replace(
#                             obfuscated_value, map[obfuscated_value]
#                         )

#                 if children := window.get("children"):
#                     windows_to_deobfuscate.extend(children)

# def deobfuscate_view_hierarchy(data):
#     return deobfuscation_template(data, "dartsymbolmap", _deobfuscate_view_hierarchy)
