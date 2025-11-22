import logging

from sentry.api import client
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
            "project": project_ids,
        }

        # API returns: [{"key": "...", "name": "span.op", "attributeSource": {...}}, ...]
        resp = client.get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/attributes/",
            data=query_params,
        )

        fields[attr_type] = [item["name"] for item in resp.data if "name" in item]

    return {"fields": fields}
