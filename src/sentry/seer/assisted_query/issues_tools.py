import logging
from typing import Any

from sentry.api import client
from sentry.issues.grouptype import registry as group_type_registry
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.types.group import PriorityLevel

logger = logging.getLogger(__name__)

IS_VALUES = [
    "resolved",
    "unresolved",
    "archived",
    "escalating",
    "new",
    "ongoing",
    "regressed",
    "assigned",
    "unassigned",
    "for_review",
    "linked",
    "unlinked",
]

ISSUE_CATEGORY_VALUES = [
    "error",
    "outage",
    "metric",
    "db_query",
    "http_client",
    "frontend",
    "mobile",
]

PRIORITY_VALUES = [
    PriorityLevel.HIGH.to_str(),
    PriorityLevel.MEDIUM.to_str(),
    PriorityLevel.LOW.to_str(),
]

FIXABILITY_VALUES = [
    FixabilityScoreThresholds.SUPER_HIGH.to_str(),
    FixabilityScoreThresholds.HIGH.to_str(),
    FixabilityScoreThresholds.MEDIUM.to_str(),
    FixabilityScoreThresholds.LOW.to_str(),
    FixabilityScoreThresholds.SUPER_LOW.to_str(),
]

FIELDS_WITHOUT_PREDEFINED_VALUES = (
    "assigned",
    "assigned_or_suggested",
    "bookmarks",
    "lastSeen",
    "firstSeen",
    "firstRelease",
    "event.timestamp",
    "timesSeen",
    "issue.seer_last_run",
)

# API key scopes required for issue queries
API_KEY_SCOPES = ["org:read", "project:read", "event:read"]


def _get_built_in_field_values(
    attribute_key: str, organization: Organization, tag_keys: list[str] | None = None
) -> list[dict[str, Any]] | None:
    """
    Get values for a built-in issue field.

    Args:
        attribute_key: The built-in field key (e.g., "is", "issue.priority", "assigned_or_suggested")
        organization: Organization instance
        tag_keys: Optional list of tag keys (used for 'has' field)

    Returns:
        List of value dicts in the format expected by the API, or None if not a built-in field
    """
    if attribute_key == "is":
        return [{"value": val} for val in IS_VALUES]

    # HAS field values - return tag keys
    if attribute_key == "has":
        if tag_keys is None:
            return []
        return [{"value": tag_key} for tag_key in sorted(tag_keys)]

    # ISSUE_PRIORITY field values
    if attribute_key == "issue.priority":
        return [{"value": val} for val in PRIORITY_VALUES]

    # ISSUE_SEER_ACTIONABILITY field values
    if attribute_key == "issue.seer_actionability":
        return [{"value": val} for val in FIXABILITY_VALUES]

    # ISSUE_CATEGORY field values
    if attribute_key == "issue.category":
        return [{"value": val} for val in ISSUE_CATEGORY_VALUES]

    # ISSUE_TYPE field values
    if attribute_key == "issue.type":
        visible_group_types = group_type_registry.get_visible(organization)
        issue_type_values = [gt.slug for gt in visible_group_types]
        return [{"value": val} for val in issue_type_values]

    if attribute_key in FIELDS_WITHOUT_PREDEFINED_VALUES:
        # These fields don't have predefined values
        # Return empty list to indicate no suggested values available
        return []

    return None


def _get_built_in_issue_fields(
    organization: Organization, tag_keys: list[str]
) -> list[dict[str, Any]]:
    """
    Generate built-in issue search fields similar to the frontend's builtInIssuesFields.

    Args:
        organization: Organization instance
        tag_keys: List of tag keys from the tags API (used for 'has' field values)

    Returns:
        List of built-in field definitions in Tag format
    """
    built_in_fields: list[dict[str, Any]] = []

    # IS field - Status field with exact values from IsFieldValues enum
    built_in_fields.append(
        {
            "key": "is",
            "values": IS_VALUES,
        }
    )

    # HAS field - Has Tag field with tag keys as values
    has_field_values = sorted(tag_keys)
    built_in_fields.append(
        {
            "key": "has",
            "values": has_field_values,
        }
    )

    # ASSIGNED field - Assigned To field
    built_in_fields.append(
        {
            "key": "assigned",
            "values": [],  # Values would come from user/team data
        }
    )

    # ASSIGNED_OR_SUGGESTED field
    built_in_fields.append(
        {
            "key": "assigned_or_suggested",
            "isInput": True,
            "values": [],  # Values would come from user/team data
        }
    )

    # BOOKMARKS field
    built_in_fields.append(
        {
            "key": "bookmarks",
            "values": [],  # Values would come from user data
        }
    )

    # ISSUE_CATEGORY field
    built_in_fields.append(
        {
            "key": "issue.category",
            "values": ISSUE_CATEGORY_VALUES,
        }
    )

    # ISSUE_TYPE field - Get visible issue types
    visible_group_types = group_type_registry.get_visible(organization)
    issue_type_values = [gt.slug for gt in visible_group_types]
    built_in_fields.append(
        {
            "key": "issue.type",
            "values": issue_type_values,
        }
    )

    # LAST_SEEN field
    built_in_fields.append(
        {
            "key": "lastSeen",
            "values": [],
        }
    )

    # FIRST_SEEN field
    built_in_fields.append(
        {
            "key": "firstSeen",
            "values": [],
        }
    )

    # TIMES_SEEN field
    built_in_fields.append(
        {
            "key": "timesSeen",
            "isInput": True,
            "values": [],
        }
    )

    # ISSUE_PRIORITY field
    built_in_fields.append(
        {
            "key": "issue.priority",
            "values": PRIORITY_VALUES,
        }
    )

    # ISSUE_SEER_ACTIONABILITY field
    built_in_fields.append(
        {
            "key": "issue.seer_actionability",
            "values": FIXABILITY_VALUES,
        }
    )

    # ISSUE_SEER_LAST_RUN field
    built_in_fields.append(
        {
            "key": "issue.seer_last_run",
            "values": [],
        }
    )

    return built_in_fields


def get_issue_filter_keys(
    *, org_id: int, project_ids: list[int], stats_period: str = "7d"
) -> dict[str, Any] | None:
    """
    Get available issue filter keys (tags, feature flags, and built-in fields).

    Calls the Sentry tags API endpoint with different datasets to get:
    - Tags (dataset=events and dataset=search_issues merged)
    - Feature flags (dataset=events with useFlagsBackend=1)
    - Built-in fields (e.g., is, assigned_or_suggested, issue.priority, etc.)

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Defaults to "7d".

    Returns:
        Dictionary containing three arrays:
        - tags: Merged tags from events and search_issues datasets
        - feature_flags: Feature flags from events dataset
        - built_in_fields: Built-in issue search fields (e.g., is, assigned_or_suggested, issue.priority)
        Returns None if organization doesn't exist.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    base_params: dict[str, Any] = {
        "statsPeriod": stats_period,
        "project": project_ids,
        "referrer": Referrer.SEER_RPC,
    }

    # Get event tags
    event_params = {**base_params, "dataset": Dataset.Events.value, "useCache": "1"}
    event_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=event_params,
    )
    event_tags = event_resp.data if event_resp.status_code == 200 else []

    # Get issue tags (search_issues dataset)
    issue_params = {**base_params, "dataset": Dataset.IssuePlatform.value, "useCache": "1"}
    issue_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=issue_params,
    )
    issue_tags = issue_resp.data if issue_resp.status_code == 200 else []

    # Merge event_tags and issue_tags
    # Use a dict to deduplicate by key
    tags_dict = {}
    for tag in event_tags:
        tags_dict[tag.get("key")] = tag
    for tag in issue_tags:
        # If key already exists, we keep the first one (from events)
        # Otherwise add the issue tag
        if tag.get("key") not in tags_dict:
            tags_dict[tag.get("key")] = tag
    tags = list(tags_dict.values())

    # Get feature flags
    flags_params = {
        **base_params,
        "dataset": Dataset.Events.value,
        "useFlagsBackend": "1",
        "useCache": "1",
    }
    flags_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=flags_params,
    )
    feature_flags = flags_resp.data if flags_resp.status_code == 200 else []

    # Get built-in issue fields
    tag_keys = [tag.get("key") for tag in tags if tag.get("key")]
    built_in_fields = _get_built_in_issue_fields(organization, tag_keys)

    return {
        "tags": tags,
        "feature_flags": feature_flags,
        "built_in_fields": built_in_fields,
    }


def get_filter_key_values(
    *,
    org_id: int,
    project_ids: list[int],
    attribute_key: str,
    substring: str | None = None,
    stats_period: str = "7d",
) -> list[dict[str, Any]] | None:
    """
    Get values for a specific filter key.

    For built-in fields, returns predefined values directly.
    For tags/feature flags, checks all three sources and merges results:
    - Events dataset (regular tags)
    - Search issues dataset (issue platform tags)
    - Events dataset with useFlagsBackend=1 (feature flags)

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        attribute_key: The attribute/tag key to get values for (e.g., "is", "issue.priority", "organization.slug")
        substring: Optional substring to filter values. Only values containing this substring will be returned.
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Defaults to "7d".

    Returns:
        List of dicts containing:
        - value: The actual value
        - count: Number of occurrences (optional for built-in fields)
        - lastSeen: ISO timestamp of last occurrence (optional)
        - firstSeen: ISO timestamp of first occurrence (optional)
        Returns None if organization doesn't exist, empty list if attribute not found in any source.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Check if this is a built-in field first
    # For 'has' field, we need to get tag keys first
    tag_keys: list[str] | None = None
    if attribute_key == "has":
        # Get tag keys for the 'has' field
        filter_keys_result = get_issue_filter_keys(
            org_id=org_id, project_ids=project_ids, stats_period=stats_period
        )
        if filter_keys_result:
            tag_keys = [
                tag.get("key") for tag in filter_keys_result.get("tags", []) if tag.get("key")
            ]

    built_in_values = _get_built_in_field_values(attribute_key, organization, tag_keys)
    if built_in_values is not None:
        # Apply substring filtering if provided
        if substring:
            built_in_values = [
                val for val in built_in_values if substring.lower() in val.get("value", "").lower()
            ]
        return built_in_values

    # Not a built-in field, query tags endpoint
    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    base_params: dict[str, Any] = {
        "statsPeriod": stats_period,
        "project": project_ids,
        "sort": "-count",
        "referrer": Referrer.SEER_RPC,
    }

    # Add query parameter for substring filtering if provided
    if substring:
        base_params["query"] = substring

    all_results: list[dict[str, Any]] = []

    # 1. Try events dataset (regular tags)
    events_params = {**base_params, "dataset": Dataset.Events.value}
    events_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{attribute_key}/values/",
        params=events_params,
    )
    if events_resp.status_code == 200 and events_resp.data:
        all_results.extend(events_resp.data)

    # 2. Try search_issues dataset
    issues_params = {**base_params, "dataset": Dataset.IssuePlatform.value}
    issues_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{attribute_key}/values/",
        params=issues_params,
    )
    if issues_resp.status_code == 200 and issues_resp.data:
        all_results.extend(issues_resp.data)

    # 3. Try events dataset with flags backend (feature flags)
    flags_params = {**base_params, "dataset": Dataset.Events.value, "useFlagsBackend": "1"}
    flags_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{attribute_key}/values/",
        params=flags_params,
    )
    if flags_resp.status_code == 200 and flags_resp.data:
        all_results.extend(flags_resp.data)

    if not all_results:
        return []

    # Merge results by value, summing counts and keeping most recent timestamps
    merged: dict[str, dict[str, Any]] = {}
    for item in all_results:
        value = item["value"]
        if value not in merged:
            merged[value] = item.copy()
        else:
            merged[value]["count"] = merged[value].get("count", 0) + item.get("count", 0)
            if "lastSeen" in item and "lastSeen" in merged[value]:
                if item["lastSeen"] > merged[value]["lastSeen"]:
                    merged[value]["lastSeen"] = item["lastSeen"]
            if "firstSeen" in item and "firstSeen" in merged[value]:
                if item["firstSeen"] < merged[value]["firstSeen"]:
                    merged[value]["firstSeen"] = item["firstSeen"]

    result = list(merged.values())
    result.sort(key=lambda x: x.get("count", 0), reverse=True)

    return result


def execute_issues_query(
    *,
    org_id: int,
    project_ids: list[int],
    query: str,
    stats_period: str = "7d",
    sort: str | None = None,
    limit: int = 25,
) -> list[dict[str, Any]] | dict[str, Any] | None:
    """
    Execute an issues query by calling the issues endpoint.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        query: Search query string (e.g., "is:unresolved")
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Defaults to "7d".
        sort: Optional sort field (e.g., "date", "new", "freq", "priority")
        limit: Number of results to return (default 25)

    Returns:
        List of issues, dict with error key if 400 error occurred, or None if organization doesn't exist
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    params: dict[str, Any] = {
        "query": query,
        "statsPeriod": stats_period,
        "project": project_ids,
        "limit": limit,
        "collapse": ["stats", "unhandled"],
        "shortIdLookup": 1,
        "referrer": Referrer.SEER_RPC,
    }

    if sort:
        params["sort"] = sort

    try:
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/issues/",
            params=params,
        )
        return resp.data
    except client.ApiError as e:
        if e.status_code == 400:
            error_detail = e.body.get("detail") if isinstance(e.body, dict) else None
            return {"error": str(error_detail) if error_detail is not None else str(e.body)}
        raise


def get_issues_stats(
    *,
    org_id: int,
    issue_ids: list[str],
    project_ids: list[int],
    query: str,
    stats_period: str = "7d",
) -> list[dict[str, Any]] | None:
    """
    Get stats for specific issues by calling the issues-stats endpoint.

    This endpoint provides count, userCount, firstSeen, lastSeen, and
    timeseries data for each issue.

    Args:
        org_id: Organization ID
        issue_ids: List of issue IDs to get stats for
        project_ids: List of project IDs
        query: Search query string (e.g., "is:unresolved")
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Defaults to "7d".

    Returns:
        List of issue stats, or None if organization doesn't exist.
        Each item contains: id, count, userCount, firstSeen, lastSeen, stats, lifetime
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    if not issue_ids:
        return []

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    params: dict[str, Any] = {
        "project": project_ids,
        "groups": issue_ids,
        "query": query,
        "statsPeriod": stats_period,
        "referrer": Referrer.SEER_RPC,
    }

    resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/issues-stats/",
        params=params,
    )

    return resp.data
