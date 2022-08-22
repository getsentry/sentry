"""
Eventstore compressor is responsible for pulling out repeating data across
events such that they can be stored only once. For example SDK modules list, or
debug_meta.

This is not used in production yet, we are still collecting metrics there.
"""

import hashlib

from sentry.utils import json

_INTERFACES = {}


def _deduplicate_interface(*keys):
    def inner(f):
        for k in keys:
            _INTERFACES[k] = f

        return f

    return inner


@_deduplicate_interface("debug_meta")
class DebugMeta:
    _DEDUP_FIELDS = ("debug_id", "code_id", "code_file", "debug_file")

    @staticmethod
    def encode(data):
        dedup = {}

        if data:
            for image in data.get("images") or []:
                image = image or {}
                for name in DebugMeta._DEDUP_FIELDS:
                    dedup.setdefault(name, []).append(image.pop(name, None))

        return dedup, data

    @staticmethod
    def decode(dedup, data):
        if data:
            for i, image in enumerate(data.get("images") or []):
                for name, arr in dedup.items():
                    value = arr[i]
                    if value is not None:
                        image[name] = value

        return data


def deduplicate(data):
    patchsets = []
    extra_keys = {}

    for key, interface in _INTERFACES.items():
        if key not in data:
            continue

        to_deduplicate, to_inline = interface.encode(data.pop(key))
        to_deduplicate_serialized = json.dumps(to_deduplicate, sort_keys=True).encode("utf8")
        checksum = hashlib.md5(to_deduplicate_serialized).hexdigest()
        extra_keys[checksum] = to_deduplicate
        patchsets.append([key, checksum, to_inline])

    if patchsets:
        data["__nodestore_patchsets"] = patchsets

    return data, extra_keys


def assemble(data, get_extra_keys):
    if not data.get("__nodestore_patchsets"):
        return data

    checksums = []
    for key, checksum, inlined in data["__nodestore_patchsets"]:
        checksums.append(checksum)

    deduplicated_interfaces = get_extra_keys(checksums)

    for key, checksum, inlined in data["__nodestore_patchsets"]:
        deduplicated = deduplicated_interfaces[checksum]
        data[key] = _INTERFACES[key].decode(deduplicated, inlined)

    del data["__nodestore_patchsets"]
    return data
