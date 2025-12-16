import logging
import re
from typing import Any

from sentry.api import client
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.seer.endpoints.utils import validate_date_params
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)


# Filter keys we think are useful to *always* return to the query agent.
# Some of these are custom tags while others translate to a different field on the event payload.
_ALWAYS_RETURN_EVENT_FIELDS = frozenset(
    {
        "id",
        "timestamp",
        "timestamp.to_hour",
        "timestamp.to_day",
        "message",
        "title",
        "level",
        "environment",
        "dist",
        "release",
        "release.version",
        "release.build",
        "release.package",
        "release.stage",
        "event.type",
        "error.type",
        "error.value",
        "error.mechanism",
        "error.handled",
        "error.unhandled",
        "error.received",
        "error.main_thread",
        "transaction",
        "trace",
        "trace.span",  # Root span ID
        "trace.parent_span",  # Parent span ID
        "project",  # Project slug
        "issue",  # Issue short ID
        "has",
    }
)

_SPECIAL_FIELD_VALUE_TYPES = {
    "id": "uuid",
    "issue": "issue_short_id",
    "timestamp": "datetime",
    "timestamp.to_hour": "datetime",
    "timestamp.to_day": "datetime",
    "message": "text",
    "title": "text",
    # Boolean values - non-exhaustive
    "error.handled": "boolean",
    "error.unhandled": "boolean",
    "error.main_thread": "boolean",
    "stack.in_app": "boolean",
    "symbolicated_in_app": "boolean",
    "app.in_foreground": "boolean",
    "device.charging": "boolean",
    "device.online": "boolean",
    "device.simulator": "boolean",
}


def _get_tag_and_feature_flag_keys(
    org_id: int,
    org_slug: str,
    project_ids: list[int],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    include_feature_flags: bool = True,
) -> tuple[set[str], set[str]]:
    api_key = ApiKey(organization_id=org_id, scope_list=["org:read", "project:read", "event:read"])

    base_params: dict[str, Any] = {
        "project": project_ids,
        "referrer": Referrer.SEER_RPC,
        "useCache": "1",
    }
    if stats_period:
        base_params["statsPeriod"] = stats_period
    else:
        base_params["start"] = start
        base_params["end"] = end

    # Get custom tags
    event_params = {**base_params, "dataset": Dataset.Events.value}
    event_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{org_slug}/tags/",
        params=event_params,
    )
    event_tags = event_resp.data or []
    event_tag_keys = {t["key"] for t in event_tags}

    # Discard tags that are explicitly excluded by the discover search bar.
    event_tag_keys.discard("total.count")

    # Get feature flags
    if include_feature_flags:
        flags_params = {
            **base_params,
            "dataset": Dataset.Events.value,
            "useFlagsBackend": "1",
        }
        flags_resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{org_slug}/tags/",
            params=flags_params,
        )
        flags = flags_resp.data or []
        flag_keys = {t["key"] for t in flags}
    else:
        flag_keys = set()

    return event_tag_keys, flag_keys


def _is_agg_function(key: str) -> bool:
    """
    Check if a key is an aggregate function (e.g., count(), avg(duration), p95(transaction.duration)).

    Aggregate functions follow the pattern: `function_name(optional_args)`.
    """
    match = re.match(r"^(\w+)\((.*?)?\)$", key)
    return bool(match and len(match.groups()) == 2)


def _get_static_values(key: str) -> list[dict[str, Any]] | None:
    """
    Get values for keys with a static set of values. Returns None if the key's
    values are dynamic and should be queried.
    """
    value_type = _SPECIAL_FIELD_VALUE_TYPES.get(key, "")

    if (
        value_type in ["uuid", "issue_short_id", "datetime"]
        or key.startswith("measurements.")
        or key == "device.class"
        or _is_agg_function(key)
    ):
        return []

    if value_type == "boolean":
        return [{"value": "true"}, {"value": "false"}]

    return None


def get_event_filter_keys(
    *,
    org_id: int,
    project_ids: list[int] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    include_feature_flags: bool = False,
) -> dict[str, dict[str, Any]] | None:
    """
    Get available event filter keys for the "errors" dataset (tags, feature flags, and static fields). This mirrors the
    behavior of Discover search bar suggestions in the frontend.

    Returns a dictionary where the keys are the filter keys and the values are metadata dictionaries, with the
    following keys:

    - type: A descriptor for the filter value, e.g. "uuid", "issue_short_id", "datetime". The agent uses this to make
      decisions on how to / whether to query the values for this key.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    stats_period, start, end = validate_date_params(stats_period, start, end)

    # Treat empty projects as a query for all projects.
    if not project_ids:
        project_ids = [ALL_ACCESS_PROJECT_ID]

    always_fields = {*_ALWAYS_RETURN_EVENT_FIELDS}
    tag_keys, flag_keys = _get_tag_and_feature_flag_keys(
        organization.id,
        organization.slug,
        project_ids,
        stats_period=stats_period,
        start=start,
        end=end,
        include_feature_flags=include_feature_flags,
    )

    result = {}
    for k in tag_keys | always_fields:  # deduplicate
        result[k] = {"type": _SPECIAL_FIELD_VALUE_TYPES.get(k, "tag")}

    for k in flag_keys:
        result[k] = {"type": "feature_flag"}

    return result


def get_event_filter_key_values(
    *,
    org_id,
    filter_key: str,
    substring: str | None = None,
    project_ids: list[int] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> list[dict[str, Any]] | None:
    """
    Get values for a specific filter key.

    - `has` key returns all available tag keys.
    - `device.class`, `measurements.*` and aggregate functions are not supported (return empty list)..
    - Boolean and datetime fields return hard-coded suggestions, e.g. `error.handled`, `timestamp`.
    - For feature flags, queries the events dataset with `useFlagsBackend=1`.
    - All other keys are queried as regular tags in the events dataset.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        filter_key: The filter key to get values for
        substring: Optional substring to filter values. Only values containing this substring will be returned
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.

    Returns:
        List of dicts containing:
        - value: The actual value
        - count: Number of occurrences (optional)
        - lastSeen: ISO timestamp of last occurrence (optional)
        - firstSeen: ISO timestamp of first occurrence (optional)
        Returns None if organization doesn't exist, empty list if key was not found in any data source.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    stats_period, start, end = validate_date_params(stats_period, start, end)

    # Treat empty projects as a query for all projects.
    if not project_ids:
        project_ids = [ALL_ACCESS_PROJECT_ID]

    predefined_values = _get_static_values(filter_key)
    if predefined_values is not None:
        return predefined_values

    if filter_key == "has":
        tag_keys, _ = _get_tag_and_feature_flag_keys(
            organization.id,
            organization.slug,
            project_ids,
            stats_period=stats_period,
            start=start,
            end=end,
            include_feature_flags=False,
        )
        return [{"value": t} for t in tag_keys]

    api_key = ApiKey(
        organization_id=organization.id, scope_list=["org:read", "project:read", "event:read"]
    )

    base_params: dict[str, Any] = {
        "project": project_ids,
        "sort": "-count",
        "referrer": Referrer.SEER_RPC,
    }
    if stats_period:
        base_params["statsPeriod"] = stats_period
    else:
        base_params["start"] = start
        base_params["end"] = end
    if substring:
        base_params["query"] = substring

    # Try tags query
    resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{filter_key}/values/",
        params={**base_params, "dataset": Dataset.Events.value},
    )

    # Try ff query. In the case of collisions we use tag values as we deem them more important.
    # TODO: Pass in an explicit is_feature_flag param if the agent can produce it.
    if not resp.data:
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/tags/{filter_key}/values/",
            params={**base_params, "dataset": Dataset.Events.value, "useFlagsBackend": "1"},
        )

    data = resp.data or []

    return [
        {k: item[k] for k in item if k in ["value", "count", "lastSeen", "firstSeen"]}
        for item in data
    ]
