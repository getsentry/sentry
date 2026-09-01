from __future__ import annotations

import os
import re
from collections.abc import Mapping, MutableMapping
from typing import Any

import orjson
import sentry_sdk

from sentry import options
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils.safe import get_path
from sentry.utils.tracing import set_span_tag, start_span

# Obfuscated type values are either in the form of "xyz" or "xyz<abc>" where
# both "xyz" or "abc" need to be deobfuscated. It may also be possible for
# the values to be more complicated such as "_xyz", so the regex should capture
# any values other than "<" and ">".
# VIEW_HIERARCHY_TYPE_REGEX = re.compile(r"([^<>]+)(?:<([^<>]+)>)?")
INSTANCE_OF_VALUE_RE = re.compile(r"Instance of '([^']+)'")

# Matches one complete identifier, so a key can never match inside a longer one,
# e.g. "er" within "Error".
IDENTIFIER_RE = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")

# A map includes the Flutter framework, which exhausts the one and two character name
# space the obfuscator allocates from, so every short word is a key and "Error in aBc"
# would remap "in". Only the fallback is gated; a short complete type still resolves.
MIN_REMAPPABLE_TOKEN_LENGTH = 3


def remap_exception_type(exception_type: str, symbol_map: Mapping[str, str]) -> str:
    """
    Deobfuscates an exception type, falling back to remapping the identifiers inside it
    when the complete type has no mapping. Compound types such as "Bloc aBc" (from
    'Bloc ${bloc.runtimeType}') aren't in the symbol map, but their identifier is.
    """
    if not exception_type or not symbol_map:
        return exception_type

    # Complete-type keys win, and types below the token floor resolve only here.
    mapped_type = symbol_map.get(exception_type)
    if mapped_type:
        return mapped_type

    def remap_token(match: re.Match[str]) -> str:
        token = match.group(0)
        if len(token) < MIN_REMAPPABLE_TOKEN_LENGTH:
            return token
        return symbol_map.get(token) or token

    return IDENTIFIER_RE.sub(remap_token, exception_type)


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
    with start_span(
        op="dartsymbolmap.generate_dart_symbols_map", name="dartsymbolmap.generate_dart_symbols_map"
    ) as span:
        dif_paths = ProjectDebugFile.difcache.fetch_difs(project, debug_ids, features=["mapping"])
        if not dif_paths:
            return None

        debug_file_path = next(iter(dif_paths.values()))

        try:
            dart_symbols_file_size_in_mb = os.path.getsize(debug_file_path) / (1024 * 1024.0)
            set_span_tag(span, "dartsymbolmap_file_size_in_mb", dart_symbols_file_size_in_mb)

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

    - Exception type: symbol map lookup of the complete type, falling back to remapping
      the identifiers within it. The original is kept in "raw_type" when the type changes.
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

    with start_span(
        op="dartsymbolmap.deobfuscate_exception_type",
        name="dartsymbolmap.deobfuscate_exception_type",
    ):
        symbol_map = generate_dart_symbols_map(list(debug_ids), project)
        if symbol_map is None:
            return None

        remap_compound_types = options.get("dart.compound-type-deobfuscation.enabled")

        for exception in exceptions:
            exception_type = exception.get("type")
            if isinstance(exception_type, str):
                if remap_compound_types:
                    mapped_type = remap_exception_type(exception_type, symbol_map)
                else:
                    mapped_type = symbol_map.get(exception_type) or exception_type
                if mapped_type != exception_type:
                    exception["raw_type"] = exception_type
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


def has_native_frames_in_stacktraces(data) -> bool:
    for stacktrace_info in find_stacktraces_in_data(data):
        frames = stacktrace_info.get_frames()
        if frames and any(frame.get("platform") == "native" for frame in frames):
            return True
    return False
