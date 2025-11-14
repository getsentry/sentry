from __future__ import annotations

import os
import re
from collections.abc import MutableMapping
from typing import int, Any

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
INSTANCE_OF_VALUE_RE = re.compile(r"Instance of '([^']+)'")


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


def deobfuscate_exception_type(data: MutableMapping[str, Any]) -> None:
    """
    Deobfuscates exception types and certain values in-place.

    - Exception type: replaced directly via symbol map lookup
    - Exception value: deobfuscate the quoted symbol for all occurrences of the
      pattern "Instance of 'obfuscated_symbol'" in the value.

    If we're unable to fetch a dart symbols mapping file, then the exception data remains unmodified.
    """
    project = Project.objects.get_from_cache(id=data["project"])

    debug_ids = get_debug_meta_image_ids(dict(data))
    if len(debug_ids) == 0:
        return None

    exceptions = data.get("exception", {}).get("values", [])
    if not exceptions:
        return None

    with sentry_sdk.start_span(op="dartsymbolmap.deobfuscate_exception_type"):
        symbol_map = generate_dart_symbols_map(list(debug_ids), project)
        if symbol_map is None:
            return None

        for exception in exceptions:
            exception_type = exception.get("type")
            if isinstance(exception_type, str):
                mapped_type = symbol_map.get(exception_type)
                if mapped_type is not None:
                    exception["type"] = mapped_type

            # Deobfuscate occurrences of "Instance of 'xYz'" in the exception value
            exception_value = exception.get("value")
            if isinstance(exception_value, str):

                def replace_symbol(match: re.Match[str]) -> str:
                    symbol = match.group(1)
                    deobfuscated_symbol = symbol_map.get(symbol)
                    if deobfuscated_symbol is None:
                        return match.group(0)
                    return f"Instance of '{deobfuscated_symbol}'"

                new_value = re.sub(INSTANCE_OF_VALUE_RE, replace_symbol, exception_value)
                if new_value != exception_value:
                    exception["value"] = new_value
