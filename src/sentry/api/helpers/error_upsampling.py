from collections.abc import Sequence
from types import ModuleType
from typing import int, Any

from rest_framework.request import Request

from sentry import options
from sentry.models.organization import Organization
from sentry.search.events.types import SnubaParams

UPSAMPLED_ERROR_AGGREGATION = "upsampled_count"

# Function key conversions for error upsampling results
_FUNCTION_KEY_CONVERSIONS = {
    "count()": "sample_count()",
    "eps()": "sample_eps()",
    "epm()": "sample_epm()",
    "upsampled_count()": "count()",
    "upsampled_eps()": "eps()",
    "upsampled_epm()": "epm()",
}

# Pre-computed ordered keys to handle conversion conflicts
# Keys that are targets of other conversions must be processed first
_conversion_targets = set(_FUNCTION_KEY_CONVERSIONS.values())
_ORDERED_CONVERSION_KEYS = sorted(
    _FUNCTION_KEY_CONVERSIONS.keys(), key=lambda k: k not in _conversion_targets
)


def convert_fields_for_upsampling(data: list[dict[str, Any]], fields_meta: dict[str, str]) -> None:
    """
    Convert field names in query results for error upsampled projects.
    This renames upsampled_* functions to their standard names and standard functions
    to sample_* equivalents to hide the conversion from the client.

    Args:
        data: List of result dictionaries to modify in-place
        fields_meta: Meta fields dictionary to modify in-place
    """
    # Collect keys that need conversion and exist in data
    all_present_keys: set[str] = set()
    for result in data:
        all_present_keys.update(result.keys())

    # Filter the pre-ordered list to only include keys actually present
    keys_to_convert = [key for key in _ORDERED_CONVERSION_KEYS if key in all_present_keys]

    # Apply conversions to data
    for result in data:
        for original_key in keys_to_convert:
            if original_key in result:
                converted_key = _FUNCTION_KEY_CONVERSIONS[original_key]
                result[converted_key] = result[original_key]
                del result[original_key]

    # Apply conversions to fields_meta
    for original_key in keys_to_convert:
        if original_key in fields_meta:
            converted_key = _FUNCTION_KEY_CONVERSIONS[original_key]
            fields_meta[converted_key] = fields_meta[original_key]
            del fields_meta[original_key]


def is_errors_query_for_error_upsampled_projects(
    snuba_params: SnubaParams,
    organization: Organization,
    dataset: ModuleType,
    request: Request,
) -> bool:
    """
    Determine if this query should use error upsampling transformations.
    Only applies when ANY projects are allowlisted and we're querying error events.
    """
    if not are_any_projects_error_upsampled(snuba_params.project_ids):
        return False

    return _should_apply_sample_weight_transform(dataset, request)


def are_any_projects_error_upsampled(project_ids: Sequence[int]) -> bool:
    """
    Check if ANY projects in the query are allowlisted for error upsampling.
    Only returns True if any project pass the allowlist condition.
    """
    if not project_ids:
        return False

    allowlist = options.get("issues.client_error_sampling.project_allowlist", [])
    if not allowlist:
        return False

    # Any project must be in the allowlist
    result = any(project_id in allowlist for project_id in project_ids)
    return result


def transform_query_columns_for_error_upsampling(
    query_columns: Sequence[str], include_alias: bool = True
) -> list[str]:
    """
    Transform aggregation functions to use sum(sample_weight) instead of count()
    for error upsampling.
    """
    function_conversions = {
        "count()": "upsampled_count()",
        "eps()": "upsampled_eps()",
        "epm()": "upsampled_epm()",
        "sample_count()": "count()",
        "sample_eps()": "eps()",
        "sample_epm()": "epm()",
    }

    transformed_columns = []
    for column in query_columns:
        column_lower = column.lower().strip()

        if column_lower in function_conversions:
            transformed = function_conversions[column_lower]
            if include_alias:
                transformed += " as " + column_lower[:-2]
            transformed_columns.append(transformed)
        else:
            transformed_columns.append(column)

    return transformed_columns


def transform_orderby_for_error_upsampling(orderby: list[str]) -> list[str]:
    """
    Transform orderby fields to use upsampled aggregation functions instead of raw ones
    for error upsampling.

    Args:
        orderby: List of orderby strings like ["-count", "eps"]

    Returns:
        List of transformed orderby strings like ["-upsampled_count", "upsampled_eps"]
    """
    orderby_conversions = {
        "count": "upsampled_count",
        "eps": "upsampled_eps",
        "epm": "upsampled_epm",
        "sample_count": "count",
        "sample_eps": "eps",
        "sample_epm": "epm",
    }

    transformed_orderby = []
    for order_field in orderby:
        if order_field.startswith("-"):
            direction = "-"
            field = order_field[1:]
        else:
            direction = ""
            field = order_field

        # Apply transformation if field needs it
        if field in orderby_conversions:
            field = orderby_conversions[field]

        transformed_orderby.append(f"{direction}{field}")

    return transformed_orderby


def _should_apply_sample_weight_transform(dataset: Any, request: Request) -> bool:
    """
    Determine if we should apply sample_weight transformations based on the dataset
    and query context. Only apply for error events since sample_weight doesn't exist
    for transactions.
    """
    from sentry.snuba import discover, errors

    # Always apply for the errors dataset
    if dataset == errors:
        return True

    from sentry.snuba import transactions

    # Never apply for the transactions dataset
    if dataset == transactions:
        return False

    # For the discover dataset, check if we're querying errors specifically
    if dataset == discover:
        result = _is_error_focused_query(request)
        return result

    # For other datasets (spans, metrics, etc.), don't apply
    return False


def _is_error_focused_query(request: Request) -> bool:
    """
    Check if a query is focused on error events.
    Reduced to only check for event.type:error to err on the side of caution.
    """
    query = request.GET.get("query", "").lower()

    if "event.type:error" in query:
        return True

    return False
