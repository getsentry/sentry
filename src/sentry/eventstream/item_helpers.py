import ipaddress
from collections.abc import Callable, Mapping
from typing import Any

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from sentry_protos.snuba.v1.trace_item_pb2 import (
    AnyValue,
    ArrayValue,
    KeyValue,
    KeyValueList,
    TraceItem,
)

from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import json
from sentry.utils.eap import hex_to_item_id
from sentry.utils.safe import get_path

# Max depth for recursive encoding to protobuf AnyValue.
_ENCODE_MAX_DEPTH = 6


def serialize_event_data_as_item(
    event: Event | GroupEvent,
    event_data: Mapping[str, Any],
    project: Project,
) -> TraceItem:
    """
    This is the top-level entrypoint for this module. Transforms an Event (with its
    associated event_data) into a TraceItem.
    """
    return TraceItem(
        item_id=hex_to_item_id(event_data["event_id"]),
        item_type=TRACE_ITEM_TYPE_OCCURRENCE,
        trace_id=event_data["contexts"]["trace"]["trace_id"],
        timestamp=Timestamp(seconds=int(event_data["timestamp"])),
        organization_id=project.organization_id,
        project_id=project.id,
        received=(
            Timestamp(seconds=int(event_data["received"])) if "received" in event_data else None
        ),
        retention_days=event_data.get("retention_days", 90),
        attributes=_encode_attributes(
            event,
            event_data,
        ),
    )


def _encode_attributes(
    event: Event | GroupEvent,
    event_data: Mapping[str, Any],
    ignore_fields: set[str] | None = None,
) -> Mapping[str, AnyValue]:
    """
    This function transforms an Event (with its associated event_data) into a mapping
    ready to be passed to a TraceItem.
    """
    preprocessed = _extract_from_event(event)
    attribute_data = _gather_attribute_data_from_event_data(event_data, ignore_fields, preprocessed)
    return _encode_attribute_data(attribute_data)


def _gather_attribute_data_from_event_data(
    event_data: Mapping[str, Any],
    ignore_fields: set[str] | None = None,
    preprocessed: Mapping[str, Any] | None = None,
) -> Mapping[str, Any]:
    """
    Workhorse function that extracts raw attribute data into a standardized mapping.
    Note that this function's output should NOT include any variant of AnyValue.
    """
    encoded_data: dict[str, Any] = {}

    # 1: ALLOWLIST OF DIRECT COPIES
    simple_allowlist = {
        "event_id",
        "type",
        "version",
        "platform",
        "location",
        "title",
        "subtitle",
        "culprit",
        "level",
        "resource_id",
        "message",
        "release",
        "transaction",
    }
    for key in simple_allowlist:
        if key in event_data:
            encoded_data[key] = event_data[key]

    # 2: SIMPLE RENAMES FROM EXISTING DATA
    renames: tuple[tuple[str, str], ...] = (  # tuple of old, new pairs
        ("main_exception_id", "exception_main_thread"),
        ("key_id", "key"),
        ("project", "project_id"),
    )
    for old_key, new_key in renames:
        if old_key in event_data:
            encoded_data[new_key] = event_data[old_key]

    # 3: LIST OF PROCESSORS THAT RETURN A DICT
    processors: tuple[Callable[[Mapping[str, Any]], Mapping[str, Any]], ...] = (
        # Tags & Contexts ==> Attrs
        _extract_tags_and_contexts,
        # IP Address, email, username
        _extract_from_user,
        # SDK name & version
        _extract_from_sdk,
        # timestamp_ms in addition to timestamp
        _extract_time_data,
        # primary_hash from hashes
        _extract_hashes,
        # fingerprint from fingerprint (possibly string or list)
        _extract_fingerprint,
        _extract_metadata,
        _extract_http,
        _extract_modules,
        _extract_exception,
    )
    for processor in processors:
        try:
            encoded_data.update(processor(event_data))
        except Exception as err:
            sentry_sdk.capture_exception(err)

    # 4: REMOVING EXPLICITLY IGNORED ATTRS
    for ignored_attr in ignore_fields or []:
        encoded_data.pop(ignored_attr, None)

    # 5: ADDING ALREADY-HANDLED CASES
    if preprocessed:
        encoded_data.update(preprocessed)

    return encoded_data


def _encode_attribute_data(attr_data: Mapping[str, Any]) -> Mapping[str, AnyValue]:
    """
    Prepares a mapping of attribute data into a form ready to be passed to TraceItem.
    """
    return {k: _encode_value(v) for k, v in attr_data.items() if v is not None}


def _extract_from_event(event: Event | GroupEvent) -> Mapping[str, float | int]:
    out: dict[str, float | int] = {}
    if event.group_id:
        out["group_id"] = event.group_id
    if isinstance(event, GroupEvent):
        out["group_first_seen"] = event.group.first_seen.timestamp()
    return out


def _extract_tags_and_contexts(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool | None]:
    # These may be overwritten by promoted tags.
    out = {
        "release": event_data.get("release"),
        "environment": event_data.get("environment"),
        "dist": event_data.get("dist"),
    }

    # From a user's perspective, "attributes" are tags + contexts.
    # Yes, it's confusing with the general EAP attributes.
    format_attr_key = lambda key: f"attr[{key}]"

    attr_keys = set()
    tags = event_data.get("tags")
    if tags is not None:
        for tag in tags:
            if tag is None:
                continue
            key, value = tag
            if value is None:
                continue
            formatted_key = format_attr_key(key)
            out[formatted_key] = value
            attr_keys.add(formatted_key)

    contexts = event_data.get("contexts")
    if isinstance(contexts, dict):
        context_values = _flatten_attrs(None, contexts)
        for key, value in context_values.items():
            formatted_key = format_attr_key(key)
            out[formatted_key] = value
            attr_keys.add(formatted_key)

    # Promoted tags
    promotions = {
        "sentry:release": "release",
        "environment": "environment",
        "sentry:user": "user",
        "sentry:dist": "dist",
        "profile.profile_id": "profile_id",
        "replay.replay_id": "replay_id",
    }
    for promo_from, promo_to in promotions.items():
        promo_key = format_attr_key(promo_from)
        if promo_key in out:
            out[promo_to] = out[promo_key]

    out["attr_keys"] = sorted(attr_keys)

    return out


def _extract_from_user(event_data: Mapping[str, Any]) -> Mapping[str, str | float | int | bool]:
    out = {}
    user_data = event_data.get("user")

    if user_data:
        ip_address = str(user_data.get("ip_address"))
        if ip_address:
            try:
                parsed_ip_address = ipaddress.ip_address(ip_address)
                if isinstance(parsed_ip_address, ipaddress.IPv4Address):
                    out["ip_address_v4"] = ip_address
                elif isinstance(parsed_ip_address, ipaddress.IPv6Address):
                    out["ip_address_v6"] = ip_address
            except ValueError:
                # Might not be valid IP address due to PII stripping
                pass

        user_email = user_data.get("email")
        if user_email is not None:
            out["user_email"] = user_email

        user_id = user_data.get("user_id", user_data.get("id"))
        if user_id is not None:
            out["user_id"] = user_id

        user_name = user_data.get("username")
        if user_name is not None:
            out["user_name"] = user_name

    return out


def _extract_from_sdk(event_data: Mapping[str, Any]) -> Mapping[str, str | float | int | bool]:
    out = {}
    sdk = event_data.get("sdk")

    if sdk:
        out["sdk_name"] = sdk.get("name")
        out["sdk_version"] = sdk.get("version")
        out["sdk_integrations"] = sdk.get("integrations")
    return out


def _extract_time_data(event_data: Mapping[str, Any]) -> Mapping[str, str | float | int | bool]:
    if "timestamp" not in event_data:
        return {}
    return {"timestamp_ms": event_data["timestamp"] * 1000}


def _extract_hashes(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool]:
    hashes = event_data.get("hashes", [])
    if hashes:
        return {"primary_hash": hashes[0]}
    return {}


def _extract_fingerprint(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool]:
    out = {}

    fingerprint = event_data.get("fingerprint", [])
    if isinstance(fingerprint, str):
        out["fingerprint"] = fingerprint
    elif fingerprint:
        out["fingerprint"] = fingerprint[0]

    grouping_config = event_data.get("grouping_config")
    if grouping_config:
        out.update(_flatten_attrs("grouping_config", grouping_config))

    return out


def _extract_metadata(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool]:
    out = {}

    metadata = event_data.get("metadata", {})
    if metadata:
        out.update(_flatten_attrs("metadata", metadata))

    return out


def _extract_http(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool]:
    out = {}

    request = event_data.get("request", {})
    if request:
        url = request.get("url")
        if url:
            out["http_url"] = url

        method = request.get("method")
        if method:
            out["http_method"] = method

        headers = request.get("headers", [])
        for header_name, header_value in headers:
            if header_name == "Referer" or header_name == "Referrer":
                out["http_referrer"] = header_value

    return out


def _extract_modules(
    event_data: Mapping[str, Any],
) -> Mapping[str, str | float | int | bool]:
    out = {}

    modules = event_data.get("modules", {})
    if modules:
        out.update(_flatten_attrs("modules", modules))

    return out


def _extract_exception(
    event_data: Mapping[str, Any],
) -> Mapping[str, int | list[str | int | bool | None]]:
    out: dict[str, int | list[Any]] = {}

    exceptions = event_data.get("exception", {}).get("values", [])
    # So, logically, each exception here is basically a mapping of data.
    # Most notable in that mapping is frames, which is itself a mapping of frame data.
    # NOW! EAP currently doesn't support mappings. So what we do here is instead build
    # consistently-ordered lists.
    if not exceptions:
        return out

    out["exception_count"] = len(exceptions)

    stack_types = []
    stack_values = []
    stack_mechanism_types = []
    stack_mechanism_handled = []
    frame_abs_paths = []
    frame_filenames = []
    frame_packages = []
    frame_modules = []
    frame_functions = []
    frame_in_app = []
    frame_colnos = []
    frame_linenos = []
    frame_stack_levels = []
    for stack_level, stack in enumerate(exceptions):
        stack_types.append(stack.get("type"))
        stack_values.append(stack.get("value"))
        stack_mechanism_types.append(get_path(stack, "mechanism", "type"))
        stack_mechanism_handled.append(get_path(stack, "mechanism", "handled"))
        for frame in get_path(stack, "stacktrace", "frames", default=[]):
            frame_abs_paths.append(frame.get("abs_path"))
            frame_filenames.append(frame.get("filename"))
            frame_packages.append(frame.get("package"))
            frame_modules.append(frame.get("module"))
            frame_functions.append(frame.get("function"))
            frame_in_app.append(frame.get("in_app"))
            frame_colnos.append(frame.get("colno"))
            frame_linenos.append(frame.get("lineno"))
            frame_stack_levels.append(stack_level)

    out["stack_types"] = stack_types
    out["stack_values"] = stack_values
    out["stack_mechanism_types"] = stack_mechanism_types
    out["stack_mechanism_handled"] = stack_mechanism_handled
    out["frame_abs_paths"] = frame_abs_paths
    out["frame_filenames"] = frame_filenames
    out["frame_packages"] = frame_packages
    out["frame_modules"] = frame_modules
    out["frame_functions"] = frame_functions
    out["frame_in_app"] = frame_in_app
    out["frame_colnos"] = frame_colnos
    out["frame_linenos"] = frame_linenos
    out["frame_stack_levels"] = frame_stack_levels

    return out


def _encode_value(value: Any, _depth: int = 0) -> AnyValue:
    if _depth > _ENCODE_MAX_DEPTH:
        # Beyond max depth, stringify to prevent protobuf nesting limit errors.
        return AnyValue(string_value=json.dumps(value))

    if isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bool):
        # Note: bool check must come before int check since bool is a subclass of int
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        # int_value is a signed int64, so it has a range of valid values.
        # if value doesn't fit into an int64, cast it to string.
        if abs(value) >= (2**63):
            return AnyValue(string_value=str(value))
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    elif isinstance(value, list) or isinstance(value, tuple):
        # Not yet processed on EAP side
        return AnyValue(
            array_value=ArrayValue(values=[_encode_value(v, _depth + 1) for v in value])
        )
    elif isinstance(value, dict):
        # Not yet processed on EAP side
        return AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key=str(kv[0]), value=_encode_value(kv[1], _depth + 1))
                    for kv in value.items()
                    if kv[1] is not None
                ]
            )
        )
    elif value is None:
        return AnyValue(string_value="(No Value)")
    else:
        raise NotImplementedError(f"encode not supported for {type(value)}")


def _flatten_attrs(key: str | None, value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        out: dict[str, Any] = {}
        for subkey, subvalue in value.items():
            new_key = subkey if key is None else ".".join([key, subkey])
            out.update(_flatten_attrs(new_key, subvalue))
        return out

    else:
        assert key is not None
        return {key: value}
