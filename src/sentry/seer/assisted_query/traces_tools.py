import logging
from typing import Any

from sentry.api.client import ApiClient
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.seer.sentry_data_models import (
    AttributeNamesResponse,
    AttributeValuesResponse,
    BuiltInField,
)

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


_METRIC_BUILT_IN_STRING_FIELDS = [
    "metric.name",
    "metric.type",
    "metric.unit",
    "timestamp",
    "project",
    "environment",
    "release",
    "trace",
]

_METRIC_BUILT_IN_NUMBER_FIELDS = [
    "value",
]


def _get_built_in_fields(item_type: str = "spans") -> list[dict[str, Any]]:
    """
    Get built-in fields for the specified item type.

    Args:
        item_type: Type of trace item ("spans", "logs", or "tracemetrics")

    Returns:
        List of built-in field definitions with key and type.
    """
    if item_type == "logs":
        string_fields = _LOG_BUILT_IN_STRING_FIELDS
        number_fields = _LOG_BUILT_IN_NUMBER_FIELDS
    elif item_type == "tracemetrics":
        string_fields = _METRIC_BUILT_IN_STRING_FIELDS
        number_fields = _METRIC_BUILT_IN_NUMBER_FIELDS
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
    include_context: bool = False,
) -> AttributeNamesResponse:
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
        include_context: When True, include the context metadata (brief,
            examples, deprecation, etc.) for each attribute and attach it to the
            matching built-in fields in the response. Today the metadata comes
            from the sentry conventions; custom attribute context is planned.

    Returns:
        Dictionary with attributes:
        {
            "fields": {
                "string": ["span.op", "span.description", ...],
                "number": ["span.duration", ...]
            },
            "built_in_fields": [
                {"key": "span.op", "type": "string", "context": {...}},
                {"key": "span.duration", "type": "number", "context": None},
                ...
            ]
        }

        Each built-in field's "context" is only populated when expand="context"
        is requested (and the attribute maps to a known convention); otherwise it
        is None. Convention-backed attributes that aren't hardcoded built-ins
        (e.g. http.route) are also appended to "built_in_fields" so their context
        isn't lost.
    """
    organization = Organization.objects.get(id=org_id)

    api_key = ApiKey(organization_id=org_id, scope_list=API_KEY_SCOPES)

    fields: dict[str, list[str]] = {"string": [], "number": []}
    # Maps an attribute name to its context, populated only when the caller
    # passes include_context=True. Used below to attach context to the built-in
    # fields (which is where Seer reads attribute context from). Today the
    # context comes from the sentry conventions, but custom attribute context is
    # planned, at which point user-defined attributes will be populated too.
    context_by_name: dict[str, dict[str, Any]] = {}
    # Maps an attribute name to its type ("string"/"number"), so context-bearing
    # attributes that aren't hardcoded built-ins can still be emitted as fields.
    type_by_name: dict[str, str] = {}

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
        # Request per-attribute context from the public endpoint via its `expand`
        # query param (gated behind the data-browsing-attribute-context feature).
        if include_context:
            query_params["expand"] = "context"

        # API returns: [{"key": "...", "name": "span.op", "attributeSource": {...},
        # "context": {...}}, ...]. "context" is only present when expand="context".
        resp = ApiClient().get(
            auth=api_key,
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/attributes/",
            params=query_params,
        )

        fields[attr_type] = [item["name"] for item in resp.data]
        for item in resp.data:
            # The endpoint attaches an (empty) context to every attribute when
            # requested, so only keep it when there's actual metadata; otherwise
            # the built-in field's context stays None.
            if item.get("context"):
                context_by_name[item["name"]] = item["context"]
                type_by_name[item["name"]] = attr_type

    hardcoded_fields = _get_built_in_fields(item_type)
    built_in_fields = [
        BuiltInField(**f, context=context_by_name.get(f["key"])) for f in hardcoded_fields
    ]

    # Convention-backed attributes (e.g. http.route) aren't in the hardcoded
    # list, so their context would otherwise be dropped. Surface them through
    # built_in_fields too, since that's where Seer reads attribute context from.
    # Only conventions are promoted (isConvention=True); user-authored custom
    # context is intentionally left out.
    hardcoded_keys = {f["key"] for f in hardcoded_fields}
    for name, context in context_by_name.items():
        if name in hardcoded_keys or not context.get("isConvention"):
            continue
        built_in_fields.append(BuiltInField(key=name, type=type_by_name[name], context=context))

    return AttributeNamesResponse(fields=fields, built_in_fields=built_in_fields)


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
) -> AttributeValuesResponse:
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
        return AttributeValuesResponse(__root__={})

    organization = Organization.objects.get(id=org_id)

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
        resp = ApiClient().get(
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
    return AttributeValuesResponse(
        __root__={field: sorted(field_values)[:limit] for field, field_values in values.items()}
    )
