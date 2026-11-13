from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from typing import Any

from sentry.tsdb.base import BaseTSDB, SnubaCondition, TSDBItem, TSDBKey, TSDBModel


def _environment_ids(environment_ids: Iterable[int | None] | None) -> set[int | None]:
    return (set(environment_ids) if environment_ids is not None else set()) | {None}


class DummyTSDB(BaseTSDB):
    """
    A no-op time-series storage.
    """

    def incr(
        self,
        model: TSDBModel,
        key: TSDBKey,
        timestamp: datetime | None = None,
        count: int = 1,
        environment_id: int | None = None,
    ) -> None:
        self.validate_arguments([model], [environment_id])

    def merge(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        self.validate_arguments([model], _environment_ids(environment_ids))

    def delete(
        self,
        models: list[TSDBModel],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int | None] | None = None,
    ) -> None:
        self.validate_arguments(models, _environment_ids(environment_ids))

    def get_range(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        conditions: list[SnubaCondition] | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
        group_on_time: bool = True,
        aggregation_override: str | None = None,
        project_ids: Sequence[int] | None = None,
    ) -> dict[TSDBKey, list[tuple[int, int]]]:
        self.validate_arguments([model], _environment_ids(environment_ids))
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def record(
        self,
        model: TSDBModel,
        key: int,
        values: Iterable[str],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        self.validate_arguments([model], [environment_id])

    def get_distinct_counts_series(
        self,
        model: TSDBModel,
        keys: Sequence[int],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        project_ids: Sequence[int] | None = None,
    ) -> dict[int, list[tuple[int, Any]]]:
        self.validate_arguments([model], [environment_id])
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def get_distinct_counts_totals(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, int | str] | None = None,
        referrer_suffix: str | None = None,
        conditions: list[SnubaCondition] | None = None,
        group_on_time: bool = False,
        project_ids: Sequence[int] | None = None,
    ) -> Mapping[TSDBKey, int]:
        self.validate_arguments([model], [environment_id])
        return {k: 0 for k in keys}

    def merge_distinct_counts(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        self.validate_arguments([model], _environment_ids(environment_ids))

    def delete_distinct_counts(
        self,
        models: list[TSDBModel],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        self.validate_arguments(models, _environment_ids(environment_ids))

    def get_frequency_series(
        self,
        model: TSDBModel,
        items: Mapping[TSDBKey, Sequence[TSDBItem]],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        project_ids: Sequence[int] | None = None,
    ) -> dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]]:
        self.validate_arguments([model], [environment_id])
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        return {
            key: [(timestamp, {k: 0.0 for k in members}) for timestamp in series]
            for key, members in items.items()
        }

    def flush(self) -> None:
        pass
