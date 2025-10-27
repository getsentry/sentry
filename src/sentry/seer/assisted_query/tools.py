import logging
from typing import Any

from sentry.api import client
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)


def get_issue_attributes(*, org_id: int, project_ids: list[int]) -> dict[str, Any] | None:
    """
    Get available issue attributes (tags and flags).

    Calls the Sentry tags API endpoint with different datasets to get:
    - Event tags (dataset=events)
    - Issue tags (dataset=search_issues)
    - Feature flags (dataset=events with useFlagsBackend=1)

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query

    Returns:
        Dictionary containing three arrays:
        - event_tags: Tags from events dataset
        - issue_tags: Tags from search_issues dataset
        - flags: Feature flags from events dataset
        Returns None if organization doesn't exist.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    api_key = ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"])

    base_params: dict[str, Any] = {
        "statsPeriod": "24h",
        "project": project_ids,
        "referrer": Referrer.SEER_RPC,
    }

    # Get event tags
    event_params = {**base_params, "dataset": "events", "useCache": "1"}
    event_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=event_params,
    )
    event_tags = event_resp.data if event_resp.status_code == 200 else []

    # Get issue tags (search_issues dataset)
    issue_params = {**base_params, "dataset": "search_issues", "useCache": "1"}
    issue_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=issue_params,
    )
    issue_tags = issue_resp.data if issue_resp.status_code == 200 else []

    # Get feature flags
    flags_params = {**base_params, "dataset": "events", "useFlagsBackend": "1", "useCache": "1"}
    flags_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/",
        params=flags_params,
    )
    flags = flags_resp.data if flags_resp.status_code == 200 else []

    return {
        "event_tags": event_tags,
        "issue_tags": issue_tags,
        "flags": flags,
    }


def get_attribute_values(
    *,
    org_id: int,
    project_ids: list[int],
    attribute_key: str,
    substring: str | None = None,
) -> list[dict[str, Any]] | None:
    """
    Get values for a specific attribute key.

    Checks all three sources and merges results:
    - Events dataset (regular tags)
    - Search issues dataset (issue platform tags)
    - Events dataset with useFlagsBackend=1 (feature flags)

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        attribute_key: The attribute/tag key to get values for (e.g., "organization.slug", "feature.organizations:...")
        substring: Optional substring to filter values. Only values containing this substring will be returned.

    Returns:
        List of dicts containing:
        - key: The attribute key
        - name: Display name of the value
        - value: The actual value
        - count: Number of occurrences
        - lastSeen: ISO timestamp of last occurrence
        - firstSeen: ISO timestamp of first occurrence
        Returns None if organization doesn't exist, empty list if attribute not found in any source.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    api_key = ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"])

    base_params: dict[str, Any] = {
        "statsPeriod": "24h",
        "project": project_ids,
        "sort": "-count",
        "referrer": Referrer.SEER_RPC,
    }

    # Add query parameter for substring filtering if provided
    if substring:
        base_params["query"] = substring

    all_results: list[dict[str, Any]] = []

    # 1. Try events dataset (regular tags)
    events_params = {**base_params, "dataset": "events"}
    events_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{attribute_key}/values/",
        params=events_params,
    )
    if events_resp.status_code == 200 and events_resp.data:
        all_results.extend(events_resp.data)

    # 2. Try search_issues dataset
    issues_params = {**base_params, "dataset": "search_issues"}
    issues_resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/tags/{attribute_key}/values/",
        params=issues_params,
    )
    if issues_resp.status_code == 200 and issues_resp.data:
        all_results.extend(issues_resp.data)

    # 3. Try events dataset with flags backend (feature flags)
    flags_params = {**base_params, "dataset": "events", "useFlagsBackend": "1"}
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
    stats_period: str,
    sort: str | None = None,
    limit: int = 25,
) -> dict[str, Any] | None:
    """
    Execute an issues query by calling the issues endpoint.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        query: Search query string (e.g., "is:unresolved")
        stats_period: Time period for the query (e.g., "24h", "14d")
        sort: Optional sort field (e.g., "date", "new", "freq", "priority")
        limit: Number of results to return (default 25)

    Returns:
        Issue data from the API response, or None if organization doesn't exist
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    api_key = ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"])

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

    resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/issues/",
        params=params,
    )

    return resp.data
