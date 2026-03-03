from collections.abc import Callable, Hashable, Mapping, Sequence
from datetime import datetime
from typing import Any

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams


def _escape_search_query_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def build_escaped_term_filter(field: str, values: Sequence[str]) -> str:
    if not values:
        return ""

    escaped_values = [_escape_search_query_value(value) for value in values]
    if len(escaped_values) == 1:
        return f'{field}:"{escaped_values[0]}"'

    values_list = ", ".join([f'"{value}"' for value in escaped_values])
    return f"{field}:[{values_list}]"


def build_snuba_params_from_ids(
    organization_id: int,
    project_ids: Sequence[int],
    start: datetime,
    end: datetime,
    environments: Sequence[Environment] | None = None,
    granularity_secs: int | None = None,
) -> SnubaParams | None:
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return None

    projects = list(Project.objects.filter(id__in=project_ids, organization_id=organization_id))
    if not projects:
        return None

    return SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=environments if environments else [],
        granularity_secs=granularity_secs,
    )


def keyed_counts_subset_match(
    control_rows: Sequence[Mapping[str, Any]],
    experimental_rows: Sequence[Mapping[str, Any]],
    key_fn: Callable[[Mapping[str, Any]], Hashable],
    count_field: str = "count()",
) -> bool:
    def _to_count_map(rows: Sequence[Mapping[str, Any]]) -> dict[Hashable, int]:
        output: dict[Hashable, int] = {}
        for row in rows:
            count = row.get(count_field)
            if count is None:
                continue
            key = key_fn(row)
            output[key] = int(count)
        return output

    control_map = _to_count_map(control_rows)
    experimental_map = _to_count_map(experimental_rows)

    if not set(experimental_map).issubset(set(control_map)):
        return False

    return all(exp_count <= control_map[key] for key, exp_count in experimental_map.items())
