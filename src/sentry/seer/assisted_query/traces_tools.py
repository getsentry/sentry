import logging

from sentry.api import client
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)

API_KEY_SCOPES = ["org:read", "project:read", "event:read"]


def get_attribute_names(
    *, org_id: int, project_ids: list[int], stats_period: str, item_type: str = "spans"
) -> dict:
    """
    Get attribute names for trace items by calling the public API endpoint.

    This ensures all queryable built-in fields (like span.op, span.description, etc.)
    are included in the response, unlike the Snuba RPC which may exclude certain
    standard fields.

    Args:
        org_id: Organization ID
        project_ids: List of project IDs to query
        stats_period: Time period string (e.g., "7d", "24h", "30d")
        item_type: Type of trace item (default: "spans", can be "spans", "logs", etc.)

    Returns:
        Dictionary with attributes:
        {
            "fields": {
                "string": ["span.op", "span.description", ...],
                "number": ["span.duration", ...]
            }
        }
    """
    organization = Organization.objects.get(id=org_id)
    api_key = ApiKey(organization_id=org_id, scope_list=API_KEY_SCOPES)

    fields: dict[str, list[str]] = {"string": [], "number": []}

    # Fetch both string and number attributes from the public API
    for attr_type in ["string", "number"]:
        query_params = {
            "attributeType": attr_type,
            "itemType": item_type,
            "statsPeriod": stats_period,
            "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        }

        # API returns: [{"key": "...", "name": "span.op", "attributeSource": {...}}, ...]
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/attributes/",
            params=query_params,
        )

        fields[attr_type] = [item["name"] for item in resp.data]

    return {"fields": fields}


def get_attribute_values_with_substring(
    *,
    org_id: int,
    project_ids: list[int],
    fields_with_substrings: list[dict[str, str]],
    stats_period: str = "7d",
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
        stats_period: Time period string (e.g., "7d", "24h", "30d")
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
    api_key = ApiKey(organization_id=org_id, scope_list=API_KEY_SCOPES)

    values: dict[str, set[str]] = {}

    for field_with_substring in fields_with_substrings:
        field = field_with_substring["field"]
        substring = field_with_substring.get("substring", "")

        query_params = {
            "itemType": item_type,
            "attributeType": "string",
            "statsPeriod": stats_period,
            "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        }
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
