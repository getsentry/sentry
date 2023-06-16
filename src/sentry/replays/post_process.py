from __future__ import annotations

import collections
from itertools import zip_longest
from typing import Any, Generator, Iterable, Iterator, MutableMapping


def process_raw_response(response: list[dict[str, Any]], fields: list[str]) -> list[dict[str, Any]]:
    """Process the response further into the expected output."""
    return list(generate_restricted_fieldset(fields, generate_normalized_output(response)))


def generate_restricted_fieldset(
    fields: list[str] | None,
    response: Generator[dict[str, Any], None, None],
) -> Iterator[dict[str, Any]]:

    """Return only the fields requested by the client."""
    if fields:
        for item in response:
            yield {field: item[field] for field in fields}
    else:
        yield from response


def _strip_dashes(field: str) -> str:
    if field:
        return field.replace("-", "")
    return field


def generate_normalized_output(
    response: list[dict[str, Any]]
) -> Generator[dict[str, Any], None, None]:
    """For each payload in the response strip "agg_" prefixes."""
    for item in response:
        if item["isArchived"]:
            yield _archived_row(item["replay_id"], item["project_id"])
            continue

        item["id"] = _strip_dashes(item.pop("replay_id", None))
        item["project_id"] = str(item["project_id"])
        item["trace_ids"] = item.pop("traceIds", [])
        item["error_ids"] = item.pop("errorIds", [])
        item["environment"] = item.pop("agg_environment", None)
        item["tags"] = dict_unique_list(
            zip(
                item.pop("tk", None) or [],
                item.pop("tv", None) or [],
            )
        )
        item["user"] = {
            "id": item.pop("user_id", None),
            "username": item.pop("user_username", None),
            "email": item.pop("user_email", None),
            "ip": item.pop("user_ip", None),
        }
        item["user"]["display_name"] = (
            item["user"]["username"]
            or item["user"]["email"]
            or item["user"]["id"]
            or item["user"]["ip"]
        )
        item["sdk"] = {
            "name": item.pop("sdk_name", None),
            "version": item.pop("sdk_version", None),
        }
        item["os"] = {
            "name": item.pop("os_name", None),
            "version": item.pop("os_version", None),
        }
        item["browser"] = {
            "name": item.pop("browser_name", None),
            "version": item.pop("browser_version", None),
        }
        item["device"] = {
            "name": item.pop("device_name", None),
            "brand": item.pop("device_brand", None),
            "model": item.pop("device_model", None),
            "family": item.pop("device_family", None),
        }

        item.pop("agg_urls", None)
        item["urls"] = item.pop("urls_sorted", None)

        item["is_archived"] = bool(item.pop("isArchived", 0))

        item.pop("clickClass", None)
        item.pop("click_selector", None)
        # don't need clickClass or click_selector
        #  for the click field, as they are only used for searching.
        # (click.classes contains the full list of classes for a click)
        item["clicks"] = extract_click_fields(item)

        yield item


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
    return {
        "id": _strip_dashes(replay_id),
        "project_id": str(project_id),
        "trace_ids": [],
        "error_ids": [],
        "environment": None,
        "tags": [],
        "user": {"id": "Archived Replay", "display_name": "Archived Replay"},
        "sdk": {"name": None, "version": None},
        "os": {"name": None, "version": None},
        "browser": {"name": None, "version": None},
        "device": {"name": None, "brand": None, "model": None, "family": None},
        "urls": None,
        "activity": None,
        "count_errors": None,
        "duration": None,
        "finished_at": None,
        "started_at": None,
        "is_archived": True,
    }


CLICK_FIELD_MAP = {
    "click_alt": "click.alt",
    "click_aria_label": "click.label",
    "click_classes": "click.classes",
    "click_id": "click.id",
    "click_role": "click.role",
    "click_tag": "click.tag",
    "click_testid": "click.testid",
    "click_text": "click.text",
    "click_title": "click.title",
}


def extract_click_fields(item: MutableMapping[str, Any]) -> list[dict[str, Any]]:
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
