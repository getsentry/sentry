import collections
from typing import Any, Dict, Generator, List, Optional, Sequence, Tuple


def process_raw_response(response: List[Dict[str, Any]], fields: List[str]) -> List[Dict[str, Any]]:
    """Process the response further into the expected output."""
    return list(generate_restricted_fieldset(fields, generate_normalized_output(response)))


def generate_restricted_fieldset(
    fields: Optional[List[str]],
    response: List[Dict[str, Any]],
) -> Generator[None, None, Dict[str, Any]]:
    """Return only the fields requested by the client."""
    if fields:
        for item in response:
            yield {field: item[field] for field in fields}
    else:
        yield from response


def generate_normalized_output(
    response: List[Dict[str, Any]]
) -> Generator[None, None, Dict[str, Any]]:
    """For each payload in the response strip "agg_" prefixes."""
    for item in response:
        item["id"] = item.pop("replay_id", None)
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
            "name": item.pop("user_name", None),
            "email": item.pop("user_email", None),
            "ip": item.pop("user_ip", None),
        }
        item["user"]["display_name"] = (
            item["user"]["name"]
            or item["user"]["email"]
            or item["user"]["ip"]
            or item["user"]["id"]
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

        item.pop("isArchived")

        yield item


def generate_sorted_urls(url_groups: List[Tuple[int, List[str]]]) -> Generator[None, None, str]:
    """Return a flat list of ordered urls."""
    for _, url_group in sorted(url_groups, key=lambda item: item[0]):
        yield from url_group


def dict_unique_list(items: Sequence[Tuple[str, str]]) -> Dict[str, List[str]]:
    """Populate a dictionary with the first key, value pair seen.

    There is a potential for duplicate keys to exist in the result set.  When we filter these keys
    in Clickhouse we will filter by the first value so we ignore subsequent updates to the key.
    This function ensures what is displayed matches what was filtered.
    """
    result = collections.defaultdict(set)
    for key, value in items:
        result[key].add(value)

    for key, value in result.items():
        result[key] = list(value)
    return result
