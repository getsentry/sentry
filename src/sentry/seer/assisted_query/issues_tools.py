import logging
import re
from typing import Any

from sentry.api import client
from sentry.issues.grouptype import registry as group_type_registry
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.release import Release
from sentry.models.team import Team, TeamStatus
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.seer.endpoints.utils import validate_date_params
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.types.group import PriorityLevel
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

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

# Field value types mapping - used by _get_static_values() to determine how to handle field value queries
_FIELD_VALUE_TYPES: dict[str, str] = {
    "error.handled": "boolean",
    "error.unhandled": "boolean",
    "error.main_thread": "boolean",
    "symbolicated_in_app": "boolean",
    "app.in_foreground": "boolean",
    "lastSeen": "datetime",
    "firstSeen": "datetime",
    "event.timestamp": "datetime",
    "timestamp": "datetime",
    "issue.seer_last_run": "datetime",
    "id": "uuid",
    "issue": "issue_short_id",
    "device.class": "device_class",
    "timesSeen": "integer",
    "detector": "dynamic_id",
}

# Event context fields available for issue search (from frontend's ISSUE_EVENT_PROPERTY_FIELDS)
# These are fields that filter on event-level data within issues
_EVENT_CONTEXT_FIELDS = [
    # Device fields
    "device.arch",
    "device.brand",
    "device.class",
    "device.family",
    "device.locale",
    "device.model_id",
    "device.name",
    "device.orientation",
    "device.uuid",
    # Error fields
    "error.handled",
    "error.main_thread",
    "error.mechanism",
    "error.type",
    "error.unhandled",
    "error.value",
    # Event metadata
    "event.timestamp",
    "event.type",
    "id",
    "timestamp",
    "title",
    "message",
    "location",
    # Geographic
    "geo.city",
    "geo.country_code",
    "geo.region",
    "geo.subdivision",
    # HTTP
    "http.method",
    "http.referer",
    "http.status_code",
    "http.url",
    # OS
    "os.build",
    "os.kernel_version",
    "os.distribution_name",
    "os.distribution_version",
    # Platform
    "platform.name",
    # Release
    "release",
    "release.build",
    "release.package",
    "release.version",
    # SDK
    "sdk.name",
    "sdk.version",
    # Stack
    "stack.abs_path",
    "stack.filename",
    "stack.function",
    "stack.module",
    "stack.package",
    "stack.stack_level",
    # Other
    "dist",
    "trace",
    "transaction",
    "symbolicated_in_app",
    "unreal.crash_type",
    "app.in_foreground",
    # User
    "user.email",
    "user.id",
    "user.ip",
    "user.username",
    # OTA Updates
    "ota_updates.channel",
    "ota_updates.runtime_version",
    "ota_updates.update_id",
]

DEVICE_CLASS_VALUES = ["high", "medium", "low"]
SPECIAL_ASSIGNEE_VALUES = ["me", "my_teams", "none"]
API_KEY_SCOPES = ["org:read", "project:read", "event:read"]
RELEASE_STAGE_VALUES = ["adopted", "low_adoption", "replaced"]


def _format_username(user: RpcUser) -> str | None:
    """
    Format username to match frontend search values.
    - If username is a UUID (32 hex chars), use email instead
    - Otherwise use username if available, fallback to email
    Returns the formatted username/email, or None if neither is available.
    """
    uuid_pattern = re.compile(r"[0-9a-f]{32}$")
    if user.username and uuid_pattern.match(user.username):
        return user.email
    elif user.username:
        return user.username
    else:
        return user.email


def _get_assignee_values(organization: Organization) -> list[dict[str, Any]]:
    """
    Get assignee values for the assigned and assigned_or_suggested fields.

    Returns a list of suggested assignee values including:
    - Special values: "me", "my_teams", "none"
    - Team slugs prefixed with "#" (e.g., "#backend-team")
    - Member usernames/emails

    This mirrors the frontend's useAssignedSearchValues hook behavior.
    """
    values: list[dict[str, Any]] = []

    # Add special values first (suggested values)
    for val in SPECIAL_ASSIGNEE_VALUES:
        values.append({"value": val})

    # Get all active teams in the organization
    teams = Team.objects.filter(organization=organization, status=TeamStatus.ACTIVE).values_list(
        "slug", flat=True
    )
    for team_slug in teams:
        values.append({"value": f"#{team_slug}"})

    # Get all approved organization members and their usernames
    member_user_ids = OrganizationMember.objects.filter(
        organization=organization,
        invite_status=InviteStatus.APPROVED.value,
        user_id__isnull=False,
    ).values_list("user_id", flat=True)

    if member_user_ids:
        # Fetch user details to get usernames
        users = user_service.get_many(filter={"user_ids": list(member_user_ids)})
        for user in users:
            username = _format_username(user)
            if username:
                values.append({"value": username})

    return values


def _get_username_values(organization: Organization) -> list[dict[str, Any]]:
    """
    Get username values for the bookmarks and subscribed fields.

    Returns a list of member usernames/emails in the organization.
    """
    values: list[dict[str, Any]] = []

    # Get all approved organization members
    member_user_ids = OrganizationMember.objects.filter(
        organization=organization,
        invite_status=InviteStatus.APPROVED.value,
        user_id__isnull=False,
    ).values_list("user_id", flat=True)

    if member_user_ids:
        users = user_service.get_many(filter={"user_ids": list(member_user_ids)})
        for user in users:
            username = _format_username(user)
            if username:
                values.append({"value": username})

    return values


def _get_release_values(organization: Organization, project_ids: list[int]) -> list[dict[str, Any]]:
    """
    Get release version values for release-related fields.

    Returns a list of recent release versions for the organization/projects.
    """
    queryset = Release.objects.filter(organization=organization)

    if project_ids:
        queryset = queryset.filter(projects__id__in=project_ids)

    # Get most recent releases
    versions = queryset.order_by("-date_added").values_list("version", flat=True).distinct()[:50]

    return [{"value": version} for version in versions]


def _get_static_values(key: str) -> list[dict[str, Any]] | None:
    """
    Get values for keys with a static set of values based on their field type.
    Similar to _get_static_values() in discover_tools.py.

    Returns:
    - [] for fields that shouldn't be queried (uuid, datetime, issue_short_id, integer, dynamic_id)
    - [{"value": x}] for fields with static enum values (boolean, device_class)
    - None if the key's values are dynamic and should be queried
    """
    value_type = _FIELD_VALUE_TYPES.get(key, "")

    # Fields that shouldn't have value suggestions
    if value_type in ("uuid", "issue_short_id", "datetime", "integer", "dynamic_id"):
        return []

    if value_type == "boolean":
        return [{"value": "true"}, {"value": "false"}]
    if value_type == "device_class":
        return [{"value": val} for val in DEVICE_CLASS_VALUES]
    # Text fields and others - return None to fall through to API query
    return None


def _get_built_in_field_values(
    attribute_key: str,
    organization: Organization,
    project_ids: list[int],
    tag_keys: list[str] | None = None,
) -> list[dict[str, Any]] | None:
    """
    Get values for a built-in issue field.

    Args:
        attribute_key: The built-in field key (e.g., "is", "issue.priority", "assigned_or_suggested")
        organization: Organization instance
        project_ids: List of project IDs to query
        tag_keys: Optional list of tag keys (used for 'has' field)

    Returns:
        List of value dicts in the format expected by the API, or None if not a built-in field
    """
    # First check for static values based on field type (boolean, datetime, uuid, etc.)
    static_values = _get_static_values(attribute_key)
    if static_values is not None:
        return static_values

    if attribute_key == "is":
        return [{"value": val} for val in IS_VALUES]

    # HAS field values - return tag keys
    if attribute_key == "has":
        if tag_keys is None:
            return []
        return [{"value": tag_key} for tag_key in sorted(tag_keys)]

    if attribute_key in ("assigned", "assigned_or_suggested"):
        return _get_assignee_values(organization)
    if attribute_key in ("bookmarks", "subscribed"):
        return _get_username_values(organization)
    if attribute_key == "issue.priority":
        return [{"value": val} for val in PRIORITY_VALUES]
    if attribute_key == "issue.seer_actionability":
        return [{"value": val} for val in FIXABILITY_VALUES]
    if attribute_key == "issue.category":
        return [{"value": val} for val in ISSUE_CATEGORY_VALUES]
    if attribute_key == "issue.type":
        visible_group_types = group_type_registry.get_visible(organization)
        issue_type_values = [gt.slug for gt in visible_group_types]
        return [{"value": val} for val in issue_type_values]
    if attribute_key in ("release", "firstRelease"):
        return _get_release_values(organization, project_ids)
    if attribute_key == "release.stage":
        return [{"value": val} for val in RELEASE_STAGE_VALUES]

    return None


def _get_built_in_issue_fields(
    organization: Organization, project_ids: list[int], tag_keys: list[str]
) -> list[dict[str, Any]]:
    """
    Generate built-in issue search fields similar to the frontend's builtInIssuesFields.

    Args:
        organization: Organization instance
        project_ids: List of project IDs to query
        tag_keys: List of tag keys from the tags API (used for 'has' field values)

    Returns:
        List of built-in field definitions in Tag format
    """
    built_in_fields: list[dict[str, Any]] = []

    built_in_fields.append({"key": "is", "values": IS_VALUES})

    built_in_fields.append({"key": "has", "values": sorted(tag_keys)})

    assignee_values = _get_assignee_values(organization)
    assignee_value_strings = [v["value"] for v in assignee_values]

    username_values = _get_username_values(organization)
    username_value_strings = [v["value"] for v in username_values]

    built_in_fields.append({"key": "assigned", "values": assignee_value_strings})
    built_in_fields.append({"key": "assigned_or_suggested", "values": assignee_value_strings})

    built_in_fields.append({"key": "bookmarks", "values": username_value_strings})
    built_in_fields.append({"key": "subscribed", "values": username_value_strings})

    built_in_fields.append({"key": "issue.category", "values": ISSUE_CATEGORY_VALUES})
    visible_group_types = group_type_registry.get_visible(organization)
    issue_type_values = [gt.slug for gt in visible_group_types]
    built_in_fields.append({"key": "issue.type", "values": issue_type_values})

    release_values = _get_release_values(organization, project_ids)
    release_value_strings = [v["value"] for v in release_values]
    built_in_fields.append({"key": "firstRelease", "values": release_value_strings})
    built_in_fields.append({"key": "release", "values": release_value_strings})
    built_in_fields.append({"key": "release.stage", "values": RELEASE_STAGE_VALUES})

    built_in_fields.append({"key": "issue.priority", "values": PRIORITY_VALUES})
    built_in_fields.append({"key": "issue.seer_actionability", "values": FIXABILITY_VALUES})

    # Fields with empty values
    empty_value_types = ("datetime", "uuid", "issue_short_id", "integer", "dynamic_id")
    for key, value_type in _FIELD_VALUE_TYPES.items():
        if value_type in empty_value_types:
            built_in_fields.append({"key": key, "values": []})

    # Event-level fields
    added_keys = {f["key"] for f in built_in_fields}
    for field_key in _EVENT_CONTEXT_FIELDS:
        if field_key in added_keys:
            continue

        value_type = _FIELD_VALUE_TYPES.get(field_key, "")
        if value_type == "boolean":
            field_values = ["true", "false"]
        elif value_type == "device_class":
            field_values = DEVICE_CLASS_VALUES
        else:
            field_values = []

        built_in_fields.append({"key": field_key, "values": field_values})

    return built_in_fields


def get_issue_filter_keys(
    *,
    org_id: int,
    project_ids: list[int],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
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
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.

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

    stats_period, start, end = validate_date_params(stats_period, start, end)

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    base_params: dict[str, Any] = {
        "project": project_ids,
        "referrer": Referrer.SEER_RPC,
    }
    if stats_period:
        base_params["statsPeriod"] = stats_period
    else:
        base_params["start"] = start
        base_params["end"] = end

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
    built_in_fields = _get_built_in_issue_fields(organization, project_ids, tag_keys)

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
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
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
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.

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

    stats_period, start, end = validate_date_params(stats_period, start, end)

    # Check if this is a built-in field first
    # For 'has' field, we need to get tag keys first
    tag_keys: list[str] | None = None
    if attribute_key == "has":
        # Get tag keys for the 'has' field
        filter_keys_result = get_issue_filter_keys(
            org_id=org_id, project_ids=project_ids, stats_period=stats_period, start=start, end=end
        )
        if filter_keys_result:
            tag_keys = [
                tag.get("key") for tag in filter_keys_result.get("tags", []) if tag.get("key")
            ]

    built_in_values = _get_built_in_field_values(attribute_key, organization, project_ids, tag_keys)
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
        "project": project_ids,
        "sort": "-count",
        "referrer": Referrer.SEER_RPC,
    }
    if stats_period:
        base_params["statsPeriod"] = stats_period
    else:
        base_params["start"] = start
        base_params["end"] = end

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
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    sort: str | None = None,
    limit: int = 25,
) -> list[dict[str, Any]] | dict[str, Any] | None:
    """
    Execute an issues query by calling the issues endpoint.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        query: Search query string (e.g., "is:unresolved")
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.
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

    stats_period, start, end = validate_date_params(stats_period, start, end)

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    params: dict[str, Any] = {
        "query": query,
        "project": project_ids,
        "limit": limit,
        "collapse": ["stats", "unhandled"],
        "shortIdLookup": 1,
        "referrer": Referrer.SEER_RPC,
    }
    if stats_period:
        params["statsPeriod"] = stats_period
    else:
        params["start"] = start
        params["end"] = end

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
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
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
        stats_period: Time period for the query (e.g., "24h", "7d", "14d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.

    Returns:
        List of issue stats, or None if organization doesn't exist.
        Each item contains: id, count, userCount, firstSeen, lastSeen, stats, lifetime
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    stats_period, start, end = validate_date_params(stats_period, start, end)

    if not issue_ids:
        return []

    api_key = ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES)

    params: dict[str, Any] = {
        "project": project_ids,
        "groups": issue_ids,
        "query": query,
        "referrer": Referrer.SEER_RPC,
    }
    if stats_period:
        params["statsPeriod"] = stats_period
    else:
        params["start"] = start
        params["end"] = end

    resp = client.get(
        auth=api_key,
        user=None,
        path=f"/organizations/{organization.slug}/issues-stats/",
        params=params,
    )

    return resp.data
