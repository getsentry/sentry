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


def _normalize_hashable(value: Any) -> Hashable:
    if isinstance(value, dict):
        return tuple(sorted((str(key), _normalize_hashable(val)) for key, val in value.items()))
    if isinstance(value, list):
        return tuple(_normalize_hashable(v) for v in value)
    if isinstance(value, set):
        return tuple(sorted(_normalize_hashable(v) for v in value))
    return value


def issue_platform_table_subset_match(
    control_rows: Sequence[Mapping[str, Any]],
    experimental_rows: Sequence[Mapping[str, Any]],
) -> bool:
    if not experimental_rows:
        return True

    # Event-like rows: use ID subset semantics.
    experimental_has_ids = all(row.get("id") is not None for row in experimental_rows)
    if experimental_has_ids:
        control_ids = {row.get("id") for row in control_rows if row.get("id") is not None}
        experimental_ids = {row.get("id") for row in experimental_rows if row.get("id") is not None}
        return experimental_ids.issubset(control_ids)

    # Aggregated rows keyed by count(): enforce eap_count <= control_count for matching keys.
    experimental_has_counts = all("count()" in row for row in experimental_rows)
    if experimental_has_counts:
        return keyed_counts_subset_match(
            control_rows,
            experimental_rows,
            key_fn=lambda row: tuple(
                sorted(
                    (key, _normalize_hashable(value))
                    for key, value in row.items()
                    if key != "count()"
                )
            ),
        )

    # Conservative fallback: exact row subset for normalized row payloads.
    control_signatures = {
        tuple(sorted((key, _normalize_hashable(value)) for key, value in row.items()))
        for row in control_rows
    }
    experimental_signatures = {
        tuple(sorted((key, _normalize_hashable(value)) for key, value in row.items()))
        for row in experimental_rows
    }
    return experimental_signatures.issubset(control_signatures)
