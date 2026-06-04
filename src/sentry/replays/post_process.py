from __future__ import annotations

import collections
from collections.abc import Generator, Iterable, Iterator, MutableMapping
from itertools import zip_longest
from typing import Any, NotRequired, TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema_serializer


class DeviceResponseType(TypedDict):
    name: NotRequired[str | None]
    brand: NotRequired[str | None]
    model: NotRequired[str | None]
    family: NotRequired[str | None]


class SDKResponseType(TypedDict):
    name: NotRequired[str | None]
    version: NotRequired[str | None]


class OSResponseType(TypedDict):
    name: NotRequired[str | None]
    version: NotRequired[str | None]


class BrowserResponseType(TypedDict):
    name: NotRequired[str | None]
    version: NotRequired[str | None]


class UserGeoResponseType(TypedDict):
    city: NotRequired[str | None]
    country_code: NotRequired[str | None]
    region: NotRequired[str | None]
    subdivision: NotRequired[str | None]


class UserResponseType(TypedDict):
    id: NotRequired[str | None]
    username: NotRequired[str | None]
    email: NotRequired[str | None]
    ip: NotRequired[str | None]
    display_name: NotRequired[str | None]
    geo: NotRequired[UserGeoResponseType]


class OTAUpdatesResponseType(TypedDict):
    channel: NotRequired[str | None]
    runtime_version: NotRequired[str | None]
    update_id: NotRequired[str | None]


@extend_schema_serializer(exclude_fields=["info_ids", "warning_ids"])
class ReplayDetailsResponse(TypedDict):
    id: NotRequired[str]
    project_id: NotRequired[str]
    trace_ids: NotRequired[list[str]]
    error_ids: NotRequired[list[str]]
    environment: NotRequired[str | None]
    tags: NotRequired[dict[str, list[str]] | list]
    user: NotRequired[UserResponseType]
    sdk: NotRequired[SDKResponseType]
    os: NotRequired[OSResponseType]
    browser: NotRequired[BrowserResponseType]
    device: NotRequired[DeviceResponseType]
    ota_updates: NotRequired[OTAUpdatesResponseType]
    is_archived: NotRequired[bool | None]
    urls: NotRequired[list[str] | None]
    clicks: NotRequired[list[dict[str, Any]]]
    count_dead_clicks: NotRequired[int | None]
    count_rage_clicks: NotRequired[int | None]
    count_errors: NotRequired[int | None]
    duration: NotRequired[int | None]
    finished_at: NotRequired[str | None]
    started_at: NotRequired[str | None]
    activity: NotRequired[int | None]
    count_urls: NotRequired[int | None]
    replay_type: NotRequired[str]
    count_segments: NotRequired[int | None]
    platform: NotRequired[str | None]
    releases: NotRequired[list[str]]
    dist: NotRequired[str | None]
    warning_ids: NotRequired[list[str] | None]
    info_ids: NotRequired[list[str] | None]
    count_warnings: NotRequired[int | None]
    count_infos: NotRequired[int | None]
    has_viewed: NotRequired[bool]


@sentry_sdk.trace
def process_raw_response(
    response: list[dict[str, Any]], fields: list[str]
) -> list[ReplayDetailsResponse]:
    """Process the response further into the expected output."""
    return list(generate_restricted_fieldset(fields, generate_normalized_output(response)))


def generate_restricted_fieldset(
    fields: list[str],
    response: Generator[ReplayDetailsResponse],
) -> Iterator[ReplayDetailsResponse]:
    """Return only the fields requested by the client."""
    if fields:
        for item in response:
            yield {field: item[field] for field in fields}  # type: ignore[literal-required, misc]
    else:
        yield from response


def _strip_dashes(field: str) -> str:
    if field:
        return field.replace("-", "")
    return field


def generate_normalized_output(response: list[dict[str, Any]]) -> Generator[ReplayDetailsResponse]:
    """For each payload in the response strip "agg_" prefixes."""
    for item in response:
        ret_item: ReplayDetailsResponse = {}
        if item["isArchived"]:
            yield _archived_row(item["replay_id"], item["agg_project_id"])
            continue

        ret_item["id"] = _strip_dashes(item.pop("replay_id", None))
        ret_item["project_id"] = str(item["agg_project_id"])
        ret_item["trace_ids"] = item.pop("traceIds", [])
        ret_item["error_ids"] = item.pop("errorIds", [])
        ret_item["environment"] = item.pop("agg_environment", None)
        ret_item["tags"] = dict_unique_list(
            zip(
                item.pop("tk", None) or [],
                item.pop("tv", None) or [],
            )
        )
        ret_item["user"] = {
            "id": item.pop("user_id", None),
            "username": item.pop("user_username", None),
            "email": item.pop("user_email", None),
            "ip": item.pop("user_ip", None),
            "geo": {
                "city": item.pop("user_geo_city", None),
                "country_code": item.pop("user_geo_country_code", None),
                "region": item.pop("user_geo_region", None),
                "subdivision": item.pop("user_geo_subdivision", None),
            },
        }
        ret_item["user"]["display_name"] = (
            ret_item["user"]["username"]
            or ret_item["user"]["email"]
            or ret_item["user"]["id"]
            or ret_item["user"]["ip"]
        )
        ret_item["sdk"] = {
            "name": item.pop("sdk_name", None),
            "version": item.pop("sdk_version", None),
        }
        ret_item["os"] = {
            "name": item.pop("os_name", None),
            "version": item.pop("os_version", None),
        }
        ret_item["browser"] = {
            "name": item.pop("browser_name", None),
            "version": item.pop("browser_version", None),
        }
        ret_item["device"] = {
            "name": item.pop("device_name", None),
            "brand": item.pop("device_brand", None),
            "model": item.pop("device_model", None),
            "family": item.pop("device_family", None),
        }
        ret_item["ota_updates"] = {
            "channel": item.pop("ota_updates_channel", None),
            "runtime_version": item.pop("ota_updates_runtime_version", None),
            "update_id": item.pop("ota_updates_update_id", None),
        }

        item.pop("agg_urls", None)
        ret_item["urls"] = item.pop("urls_sorted", None)

        ret_item["is_archived"] = bool(item.pop("isArchived", 0))

        item.pop("clickClass", None)
        item.pop("click_selector", None)
        ret_item["activity"] = item.pop("activity", None)
        # don't need clickClass or click_selector
        #  for the click field, as they are only used for searching.
        # (click.classes contains the full list of classes for a click)
        ret_item["clicks"] = extract_click_fields(item)
        ret_item["count_dead_clicks"] = item.pop("count_dead_clicks", None)
        ret_item["count_errors"] = item.pop("count_errors", None)
        ret_item["count_rage_clicks"] = item.pop("count_rage_clicks", None)
        ret_item["count_segments"] = item.pop("count_segments", None)
        ret_item["count_urls"] = item.pop("count_urls", None)
        ret_item["dist"] = item.pop("dist", None)
        ret_item["duration"] = item.pop("duration", None)
        ret_item["finished_at"] = item.pop("finished_at", None)
        ret_item["platform"] = item.pop("platform", None)
        ret_item["releases"] = list(filter(bool, item.pop("releases", [])))
        ret_item["replay_type"] = item.pop("replay_type", "session")
        ret_item["started_at"] = item.pop("started_at", None)

        ret_item["warning_ids"] = item.pop("warning_ids", None)
        ret_item["info_ids"] = item.pop("info_ids", None)
        ret_item["count_infos"] = item.pop("count_infos", None)
        ret_item["count_warnings"] = item.pop("count_warnings", None)
        # Returns a UInt8 of either 0 or 1. We coerce to a bool.
        ret_item["has_viewed"] = bool(item.get("has_viewed", 0))
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


def _archived_row(replay_id: str, project_id: int) -> ReplayDetailsResponse:
    return {
        "id": _strip_dashes(replay_id),
        "project_id": str(project_id),
        "trace_ids": [],
        "error_ids": [],
        "info_ids": [],
        "warning_ids": [],
        "environment": None,
        "tags": [],
        "user": {
            "id": "Archived Replay",
            "display_name": "Archived Replay",
            "username": None,
            "email": None,
            "ip": None,
            "geo": {
                "city": None,
                "country_code": None,
                "region": None,
                "subdivision": None,
            },
        },
        "sdk": {"name": None, "version": None},
        "os": {"name": None, "version": None},
        "browser": {"name": None, "version": None},
        "device": {"name": None, "brand": None, "model": None, "family": None},
        "ota_updates": {"channel": None, "runtime_version": None, "update_id": None},
        "urls": None,
        "activity": None,
        "count_dead_clicks": None,
        "count_rage_clicks": None,
        "count_errors": None,
        "count_warnings": None,
        "count_infos": None,
        "duration": None,
        "finished_at": None,
        "started_at": None,
        "is_archived": True,
        "count_segments": None,
        "count_urls": None,
        "dist": None,
        "platform": None,
        "releases": [],
        "clicks": [],
        "has_viewed": False,
    }


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
