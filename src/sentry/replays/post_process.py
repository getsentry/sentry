from __future__ import annotations

import collections
from collections.abc import Generator, Iterable, Iterator, MutableMapping
from itertools import zip_longest
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema_serializer

from sentry.replays.validators import VALID_FIELD_SET


class DeviceResponseType(TypedDict, total=False):
    brand: str | None
    family: str | None
    model: str | None
    name: str | None


class SDKResponseType(TypedDict, total=False):
    name: str | None
    version: str | None


class OSResponseType(TypedDict, total=False):
    name: str | None
    version: str | None


class BrowserResponseType(TypedDict, total=False):
    name: str | None
    version: str | None


class UserResponseType(TypedDict, total=False):
    display_name: str | None
    email: str | None
    id: str | None
    ip: str | None
    username: str | None


@extend_schema_serializer(exclude_fields=["info_ids", "warning_ids"])
class ReplayDetailsResponse(TypedDict, total=False):
    activity: int | None
    browser: BrowserResponseType
    clicks: list[dict[str, Any]]
    count_dead_clicks: int | None
    count_errors: int | None
    count_infos: int | None
    count_rage_clicks: int | None
    count_segments: int | None
    count_urls: int | None
    count_warnings: int | None
    device: DeviceResponseType
    dist: str | None
    duration: int | None
    environment: str | None
    error_ids: list[str]
    finished_at: str | None
    has_viewed: bool
    id: str
    info_ids: list[str] | None
    is_archived: bool | None
    os: OSResponseType
    platform: str | None
    project_id: str
    releases: list[str]
    replay_type: str
    sdk: SDKResponseType
    started_at: str | None
    tags: dict[str, list[str]] | list
    trace_ids: list[str]
    urls: list[str] | None
    user: UserResponseType
    warning_ids: list[str] | None


def process_raw_response(
    response: list[dict[str, Any]], fields: list[str]
) -> list[ReplayDetailsResponse]:
    """Process the response further into the expected output."""
    return list(generate_restricted_fieldset(fields, generate_normalized_output(response)))


def generate_restricted_fieldset(
    fields: list[str],
    response: Generator[ReplayDetailsResponse, None, None],
) -> Iterator[ReplayDetailsResponse]:
    """Return only the fields requested by the client."""
    if fields:
        for item in response:
            yield {field: item[field] for field in fields}  # type: ignore[literal-required, misc]
    else:
        yield from response


def _strip_dashes(field: str | None) -> str:
    if field:
        return field.replace("-", "")
    return ""


def generate_normalized_output(
    response: list[dict[str, Any]]
) -> Generator[ReplayDetailsResponse, None, None]:
    """Skip archives, strip "agg_" prefixes, coerce correct types, and compute/nest new fields"""

    for item in response:

        ret_item: ReplayDetailsResponse = {}
        if item.get("isArchived"):
            yield _archived_row(item["replay_id"], item["project_id"])  # type: ignore[misc]
            continue

        # required fields
        ret_item["project_id"] = str(item["project_id"])

        # modified + renamed fields
        ret_item["environment"] = item.get("agg_environment", None)
        # Returns a UInt8 of either 0 or 1. We coerce to a bool.
        ret_item["has_viewed"] = bool(item.get("has_viewed", 0))
        ret_item["id"] = _strip_dashes(item.get("replay_id", None))
        ret_item["releases"] = list(filter(bool, item.get("releases", [])))

        # computed fields
        ret_item["browser"] = {
            "name": item.get("browser_name", None),
            "version": item.get("browser_version", None),
        }
        ret_item["clicks"] = extract_click_fields(item)
        ret_item["device"] = {
            "name": item.get("device_name", None),
            "brand": item.get("device_brand", None),
            "model": item.get("device_model", None),
            "family": item.get("device_family", None),
        }
        ret_item["os"] = {
            "name": item.get("os_name", None),
            "version": item.get("os_version", None),
        }
        ret_item["sdk"] = {
            "name": item.get("sdk_name", None),
            "version": item.get("sdk_version", None),
        }
        ret_item["tags"] = dict_unique_list(
            zip(
                item.get("tk", None) or [],
                item.get("tv", None) or [],
            )
        )
        ret_item["user"] = {
            "id": item.get("user_id", None),
            "username": item.get("user_username", None),
            "email": item.get("user_email", None),
            "ip": item.get("user_ip", None),
        }
        ret_item["user"]["display_name"] = (
            ret_item["user"]["username"]
            or ret_item["user"]["email"]
            or ret_item["user"]["id"]
            or ret_item["user"]["ip"]
        )

        # optional fields
        ret_item["activity"] = item.get("activity", None)
        ret_item["count_dead_clicks"] = item.get("count_dead_clicks", None)
        ret_item["count_errors"] = item.get("count_errors", None)
        ret_item["count_infos"] = item.get("count_infos", None)
        ret_item["count_rage_clicks"] = item.get("count_rage_clicks", None)
        ret_item["count_segments"] = item.get("count_segments", None)
        ret_item["count_urls"] = item.get("count_urls", None)
        ret_item["count_warnings"] = item.get("count_warnings", None)
        ret_item["dist"] = item.get("dist", None)
        ret_item["duration"] = item.get("duration", None)
        ret_item["error_ids"] = item.get("errorIds", [])
        ret_item["finished_at"] = item.get("finished_at", None)
        ret_item["info_ids"] = item.get("info_ids", None)
        ret_item["is_archived"] = item.get("isArchived", None)
        ret_item["platform"] = item.get("platform", None)
        ret_item["replay_type"] = item.get("replay_type", "session")
        ret_item["started_at"] = item.get("started_at", None)
        ret_item["trace_ids"] = item.get("traceIds", [])
        ret_item["urls"] = item.get("urls_sorted", None)
        ret_item["warning_ids"] = item.get("warning_ids", None)

        # excluded fields: agg_urls, clickClass, click_selector
        # Don't need clickClass and click_selector for the click field, as they are only used for searching.
        # (click.classes contains the full list of classes for a click)
        yield ret_item


def generate_sorted_urls(url_groups: list[tuple[int, list[str]]]) -> Iterator[str]:
    """Return a flat list of ordered urls."""
    for _, url_group in sorted(url_groups, key=lambda item: item[0]):
        yield from url_group


def dict_unique_list(items: Iterable[tuple[str, str]]) -> dict[str, list[str]]:
    """Populate a dictionary with the first key, value pair seen.

    There is a potential for duplicate keys to exist in the result set.  When we filter these keys
    in Clickhouse we will filter by the first value so we ignore subsequent updates to the key.
    This function ensures what is displayed matches what was filtered.
    """
    unique = collections.defaultdict(set)
    for key, value in items:
        unique[key].add(value)

    return {key: list(value_set) for key, value_set in unique.items()}


def _archived_row(replay_id: str, project_id: int) -> dict[str, Any]:
    archived_replay_response = {
        "browser": {"name": None, "version": None},
        "device": {"name": None, "brand": None, "model": None, "family": None},
        "error_ids": [],
        "id": _strip_dashes(replay_id),
        "os": {"name": None, "version": None},
        "project_id": str(project_id),
        "sdk": {"name": None, "version": None},
        "tags": [],
        "trace_ids": [],
        "user": {"id": "Archived Replay", "display_name": "Archived Replay"},
    }
    for field in VALID_FIELD_SET:
        if field not in archived_replay_response:
            archived_replay_response[field] = None

    return archived_replay_response


CLICK_FIELD_MAP = {
    "click_alt": "click.alt",
    "click_aria_label": "click.label",
    "click_classes": "click.classes",
    "click_component_name": "click.component_name",
    "click_id": "click.id",
    "click_role": "click.role",
    "click_tag": "click.tag",
    "click_testid": "click.testid",
    "click_text": "click.text",
    "click_title": "click.title",
}


def extract_click_fields(
    item: MutableMapping[str, Any],
) -> list[dict[str, Any]]:
    """
    pops all of the click fields from the item and returns a list of the individual clicks as objects
    """
    click_dict = {}
    for click_field in CLICK_FIELD_MAP.keys():
        click_val = item.pop(click_field, [])
        # if there is at least one one element, the list will be filled empty strings for the non-click segments
        # so if there is at least one value, return a list of the truthy values.
        # if not, return a list with a single None value
        # also map the clickhouse field values to their query names
        if click_val:
            click_dict[CLICK_FIELD_MAP[click_field]] = [element for element in click_val if element]
        else:
            click_dict[CLICK_FIELD_MAP[click_field]] = click_val

    list_of_dicts = [dict(zip(click_dict.keys(), row)) for row in zip_longest(*click_dict.values())]
    return list_of_dicts
