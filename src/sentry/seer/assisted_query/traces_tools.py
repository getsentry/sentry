import logging
from typing import Any

from sentry.api import client
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.seer.endpoints.utils import validate_date_params

logger = logging.getLogger(__name__)

API_KEY_SCOPES = ["org:read", "project:read", "event:read"]


_SPAN_BUILT_IN_STRING_FIELDS = [
    "id",
    "project",
    "span.description",
    "span.op",
    "timestamp",
    "transaction",
    "trace",
    "is_transaction",
    "sentry.normalized_description",
    "release",
    "project.id",
    "sdk.name",
    "sdk.version",
    "span.system",
    "span.category",
]

_SPAN_BUILT_IN_NUMBER_FIELDS = [
    "span.duration",
    "span.self_time",
]


_LOG_BUILT_IN_STRING_FIELDS = [
    "trace",
    "id",
    "message",
    "severity",
    "timestamp",
]

_LOG_BUILT_IN_NUMBER_FIELDS = [
    "severity_number",
]


def _get_built_in_fields(item_type: str = "spans") -> list[dict[str, Any]]:
    """
    Get built-in fields for the specified item type.

    Args:
        item_type: Type of trace item ("spans" or "logs")

    Returns:
        List of built-in field definitions with key and type.
    """
    if item_type == "logs":
        string_fields = _LOG_BUILT_IN_STRING_FIELDS
        number_fields = _LOG_BUILT_IN_NUMBER_FIELDS
    else:
        string_fields = _SPAN_BUILT_IN_STRING_FIELDS
        number_fields = _SPAN_BUILT_IN_NUMBER_FIELDS

    built_in_fields = []
    for field in string_fields:
        built_in_fields.append({"key": field, "type": "string"})
    for field in number_fields:
        built_in_fields.append({"key": field, "type": "number"})

    return built_in_fields


def get_attribute_names(
    *,
    org_id: int,
    project_ids: list[int],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    item_type: str = "spans",
) -> dict:
    """
    Get attribute names for trace items by calling the public API endpoint.

    This ensures all queryable built-in fields (like span.op, span.description, etc.)
    are included in the response, unlike the Snuba RPC which may exclude certain
    standard fields.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        stats_period: Time period string (e.g., "7d", "24h", "30d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.
        item_type: Type of trace item (default: "spans", can be "spans", "logs", etc.)

    Returns:
        Dictionary with attributes:
        {
            "fields": {
                "string": ["span.op", "span.description", ...],
                "number": ["span.duration", ...]
            },
            "built_in_fields": [
                {"key": "span.op", "type": "string"},
                {"key": "span.duration", "type": "number"},
                ...
            ]
        }
    """
    organization = Organization.objects.get(id=org_id)

    stats_period, start, end = validate_date_params(stats_period, start, end)

    api_key = ApiKey(organization_id=org_id, scope_list=API_KEY_SCOPES)

    fields: dict[str, list[str]] = {"string": [], "number": []}

    # Fetch both string and number attributes from the public API
    for attr_type in ["string", "number"]:
        query_params: dict[str, Any] = {
            "attributeType": attr_type,
            "itemType": item_type,
            "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        }
        if stats_period:
            query_params["statsPeriod"] = stats_period
        else:
            query_params["start"] = start
            query_params["end"] = end

        # API returns: [{"key": "...", "name": "span.op", "attributeSource": {...}}, ...]
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/attributes/",
            params=query_params,
        )

        fields[attr_type] = [item["name"] for item in resp.data]

    built_in_fields = _get_built_in_fields(item_type)

    return {"fields": fields, "built_in_fields": built_in_fields}


def get_attribute_values_with_substring(
    *,
    org_id: int,
    project_ids: list[int],
    fields_with_substrings: list[dict[str, str]],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = 100,
    item_type: str = "spans",
) -> dict:
    """
    Get attribute values for specific fields, optionally filtered by substring. Only string attributes are supported.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        fields_with_substrings: List of dicts with "field" and optional "substring" keys
            Example: [{"field": "span.status", "substring": "error"}]
        stats_period: Time period string (e.g., "7d", "24h", "30d"). Cannot be provided with start and end.
        start: Start date for the query (ISO string). Must be provided with end.
        end: End date for the query (ISO string). Must be provided with start.
        limit: Maximum number of values to return per field (API default is 1000)
        item_type: Type of trace item (default: "spans")

    Returns:
        Dictionary with field names as keys and lists of values:
        {
            "span.status": ["ok", "error", ...],
            "transaction": ["checkout", ...]
        }
    """
    if not fields_with_substrings:
        return {}

    organization = Organization.objects.get(id=org_id)

    stats_period, start, end = validate_date_params(stats_period, start, end)

    api_key = ApiKey(organization_id=org_id, scope_list=API_KEY_SCOPES)

    values: dict[str, set[str]] = {}

    for field_with_substring in fields_with_substrings:
        field = field_with_substring["field"]
        substring = field_with_substring.get("substring", "")

        query_params: dict[str, Any] = {
            "itemType": item_type,
            "attributeType": "string",
            "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        }
        if stats_period:
            query_params["statsPeriod"] = stats_period
        else:
            query_params["start"] = start
            query_params["end"] = end
        if substring:
            query_params["substringMatch"] = substring

        # API returns: [{"value": "ok", "count": 123, ...}, ...]
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/attributes/{field}/values/",
            params=query_params,
        )

        # Extract "value" from each item, filter out None/empty, and respect limit
        field_values_list = [item["value"] for item in resp.data if item.get("value")]
        # Merge with existing values if field already exists (multiple substrings for same field)
        values.setdefault(field, set()).update(field_values_list[:limit])

    # Convert sets to sorted lists for JSON serialization
    return {field: sorted(field_values)[:limit] for field, field_values in values.items()}
