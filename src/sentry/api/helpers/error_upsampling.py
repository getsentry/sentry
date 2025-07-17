from collections.abc import Sequence
from types import ModuleType
from typing import Any

from rest_framework.request import Request

from sentry import options
from sentry.models.organization import Organization
from sentry.search.events.types import SnubaParams

UPSAMPLED_ERROR_AGGREGATION = "upsampled_count"


def is_errors_query_for_error_upsampled_projects(
    snuba_params: SnubaParams,
    organization: Organization,
    dataset: ModuleType,
    request: Request,
) -> bool:
    """
    Determine if this query should use error upsampling transformations.
    Only applies when ALL projects are allowlisted and we're querying error events.
    """
    if not are_all_projects_error_upsampled(snuba_params.project_ids):
        return False

    return _should_apply_sample_weight_transform(dataset, request)


def are_all_projects_error_upsampled(project_ids: Sequence[int]) -> bool:
    """
    Check if ALL projects in the query are allowlisted for error upsampling.
    Only returns True if all projects pass the allowlist condition.
    """
    if not project_ids:
        return False

    allowlist = options.get("issues.client_error_sampling.project_allowlist", [])
    if not allowlist:
        return False

    # All projects must be in the allowlist
    result = all(project_id in allowlist for project_id in project_ids)
    return result


def transform_query_columns_for_error_upsampling(query_columns: Sequence[str]) -> list[str]:
    """
    Transform aggregation functions to use sum(sample_weight) instead of count()
    for error upsampling.
    """
    transformed_columns = []
    for column in query_columns:
        column_lower = column.lower().strip()

        if column_lower == "count()":
            transformed_columns.append("upsampled_count() as count")

        elif column_lower == "eps()":
            transformed_columns.append("upsampled_eps() as eps")

        elif column_lower == "epm()":
            transformed_columns.append("upsampled_epm() as epm")
        else:
            transformed_columns.append(column)

    return transformed_columns


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
