from typing import Any, Dict, Generator, List, Optional, Tuple


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
        item["id"] = item.pop("replay_id")
        item["longestTransaction"] = 0
        item["environment"] = item.pop("agg_environment")
        item["tags"] = dict(zip(item.pop("tags.key") or [], item.pop("tags.value") or []))
        item["user"] = {
            "id": item.pop("user_id"),
            "name": item.pop("user_name"),
            "email": item.pop("user_email"),
            "ip_address": item.pop("user_ipAddress"),
        }
        item["user"]["displayName"] = (
            item["user"]["name"]
            or item["user"]["email"]
            or item["user"]["ip_address"]
            or item["user"]["id"]
        )
        item["sdk"] = {"name": item.pop("sdk_name"), "version": item.pop("sdk_version")}
        item["os"] = {"name": item.pop("os_name"), "version": item.pop("os_version")}
        item["browser"] = {"name": item.pop("browser_name"), "version": item.pop("browser_version")}
        item["device"] = {
            "name": item.pop("device_name"),
            "brand": item.pop("device_brand"),
            "model": item.pop("device_model"),
            "family": item.pop("device_family"),
        }

        item["urls"] = list(generate_sorted_urls(item.pop("agg_urls")))
        item["countUrls"] = len(item["urls"])

        yield item


def generate_sorted_urls(url_groups: List[Tuple[int, List[str]]]) -> Generator[None, None, str]:
    """Return a flat list of ordered urls."""
    for _, url_group in sorted(url_groups, key=lambda item: item[0]):
        yield from url_group
