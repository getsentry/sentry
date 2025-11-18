import logging
import re
from typing import Any

from sentry.api import client
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)


def _get_static_fields() -> set[str]:
    static_fields_without_txn_fields = {
        "id",
        "timestamp",
        "timestamp.to_hour",
        "timestamp.to_day",
        "culprit",
        "location",
        "message",
        "platform",
        "platform.name",
        "environment",
        "release",
        "dist",
        "title",
        "event.type",
        "transaction",
        "unreal.crash_type",
        "user",
        "user.id",
        "user.email",
        "user.username",
        "user.ip",
        "sdk.name",
        "sdk.version",
        "http.method",
        "http.referer",
        "http.status_code",
        "http.url",
        "os.build",
        "os.kernel_version",
        "os.distribution_name",
        "os.distribution_version",
        "device.name",
        "device.brand",
        "device.locale",
        "device.uuid",
        "device.arch",
        "device.family",
        "device.battery_level",
        "device.orientation",
        "device.screen_density",
        "device.screen_dpi",
        "device.screen_height_pixels",
        "device.screen_width_pixels",
        "device.simulator",
        "device.online",
        "device.charging",
        "device.class",
        "geo.country_code",
        "geo.region",
        "geo.city",
        "geo.subdivision",
        "error.type",
        "error.value",
        "error.mechanism",
        "error.handled",
        "error.unhandled",
        "error.received",
        "error.main_thread",
        "level",
        "stack.abs_path",
        "stack.filename",
        "stack.package",
        "stack.module",
        "stack.function",
        "stack.in_app",
        "stack.colno",
        "stack.lineno",
        "stack.stack_level",
        "symbolicated_in_app",
        "app.in_foreground",
        "trace",
        "trace.span",
        "trace.parent_span",
        "trace.client_sample_rate",
        "total.count",
        "project",
        "issue",
        "user.display",
        "ota_updates.channel",
        "ota_updates.runtime_version",
        "ota_updates.update_id",
        "has",
    }

    semver_tags = {
        "release.version",
        "release.build",
        "release.package",
        "release.stage",
    }

    return static_fields_without_txn_fields | semver_tags


def _is_agg_function(key: str) -> bool:
    match = re.match(r"^(\w+)\((.*?)?\)$", key)
    return bool(match and len(match.groups()) == 2)


def _get_tag_and_feature_flag_keys(
    org_id: int, org_slug: str, project_ids: list[int], stats_period: str
) -> tuple[set[str], set[str]]:
    """
      const filteredTags = useMemo(() => {
      return omitTags && omitTags.length > 0
        ? omit(tags, omitTags, EXCLUDED_FILTER_KEYS)
        : omit(tags, EXCLUDED_FILTER_KEYS);
    }, [tags, omitTags]);
    """

    api_key = ApiKey(organization_id=org_id, scope_list=["org:read", "project:read", "event:read"])

    base_params: dict[str, Any] = {
        "statsPeriod": stats_period,
        "project": project_ids,
        "referrer": Referrer.SEER_RPC,
        "useCache": "1",
    }

    # Get event tags
    event_params = {**base_params, "dataset": Dataset.Events.value}
    event_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{org_slug}/tags/",
        params=event_params,
    )
    event_tags = event_resp.data or []
    event_tag_keys = {t["key"] for t in event_tags}

    # Discard explicitly excluded tags by discover search bar.
    event_tag_keys.discard("total.count")

    # Get feature flags
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

    return event_tag_keys, flag_keys


def _get_predefined_field_values(key: str) -> list[dict[str, Any]] | None:
    """Returns None if the key does not have predefined values."""
    if key.startswith("measurements.") or key == "device.class" or _is_agg_function(key):
        return []

    # Boolean fields
    if key in [
        "error.handled",
        "error.unhandled",
        "error.main_thread",
        "stack.in_app",
        "symbolicated_in_app",
        "app.in_foreground",
        "device.charging",
        "device.online",
        "device.simulator",
    ]:
        return [{"value": "true"}, {"value": "false"}]

    # For datetime fields, only return suggestions for `-${stats_period_format}`, e.g. `-1h`, `-14d`
    # which mean "after 1h ago" and "after 14 days ago" respectively.
    # We defer to the query agent for more complex datetime queries with ISO timestamps.
    if key in [
        "timestamp",
        "timestamp.to_hour",
        "timestamp.to_day",
    ]:
        return [{"value": f"-{period}"} for period in ["1h", "24h", "7d", "14d", "30d"]]

    # Look up as a tag or feature flag.
    return None


def get_event_filter_keys(
    *,
    org_id: int,
    project_ids: list[int] | None = None,
    stats_period: str = "7d",
) -> dict[str, list[str]] | None:
    """
    Get available event filter keys for the "errors" dataset (tags, feature flags, and static fields).
    This mirrors the behavior of Discover search bar suggestions in the frontend.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Treat empty projects as a query for all projects.
    if not project_ids:
        project_ids = [ALL_ACCESS_PROJECT_ID]

    static_fields = _get_static_fields()
    tag_keys, flag_keys = _get_tag_and_feature_flag_keys(
        organization.id, organization.slug, project_ids, stats_period
    )

    # Return duplicated keys as tags. They could be returned as static_fields
    # too, since we don't treat these differently when fetching values. We just
    # want to keep the sets disjoint.
    static_fields -= tag_keys

    return {
        "tags": list(tag_keys),
        "feature_flags": list(flag_keys),
        "static_fields": list(static_fields),
    }


def get_event_filter_key_values(
    *,
    org_id,
    filter_key: str,
    is_feature_flag: bool,
    substring: str | None = None,
    project_ids: list[int] | None = None,
    stats_period: str = "7d",
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
        is_feature_flag: Whether the filter key is a feature flag
        substring: Optional substring to filter values. Only values containing this substring will be returned
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Defaults to "7d"

    Returns:
        List of dicts containing:
        - value: The actual value
        - count: Number of occurrences (excluded for `has` key)
        - lastSeen: ISO timestamp of last occurrence (excluded for `has` key)
        - firstSeen: ISO timestamp of first occurrence (excluded for `has` key)
        Returns None if organization doesn't exist, empty list if key was not found in any data source.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Treat empty projects as a query for all projects.
    if not project_ids:
        project_ids = [ALL_ACCESS_PROJECT_ID]

    predefined_values = _get_predefined_field_values(filter_key)
    if predefined_values is not None:
        return predefined_values

    if filter_key == "has":
        keys_response = (
            get_event_filter_keys(org_id=org_id, project_ids=project_ids, stats_period=stats_period)
            or {}
        )
        return [{"value": tag} for tag in keys_response.get("tags", [])]

    api_key = ApiKey(
        organization_id=organization.id, scope_list=["org:read", "project:read", "event:read"]
    )

    base_params: dict[str, Any] = {
        "statsPeriod": stats_period,
        "project": project_ids,
        "sort": "-count",
        "referrer": Referrer.SEER_RPC,
    }
    if substring:
        base_params["query"] = substring

    if is_feature_flag:
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/tags/{filter_key}/values/",
            params={**base_params, "dataset": Dataset.Events.value, "useFlagsBackend": "1"},
        )
    else:
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/tags/{filter_key}/values/",
            params={**base_params, "dataset": Dataset.Events.value},
        )

    data = resp.data or []
    return [
        {k: item[k] for k in item if k in ["value", "count", "lastSeen", "firstSeen"]}
        for item in data
    ]
