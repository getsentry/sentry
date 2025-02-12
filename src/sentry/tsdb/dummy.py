from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from typing import Any

from sentry.tsdb.base import BaseTSDB, TSDBItem, TSDBKey, TSDBModel


def _environment_ids(environment_ids: Iterable[int | None] | None) -> set[int | None]:
    return (set(environment_ids) if environment_ids is not None else set()) | {None}


class DummyTSDB(BaseTSDB):
    """
    A no-op time-series storage.
    """

    def incr(self, model, key: TSDBKey, timestamp=None, count=1, environment_id=None):
        self.validate_arguments([model], [environment_id])

    def merge(self, model, destination, sources, timestamp=None, environment_ids=None):
        self.validate_arguments([model], _environment_ids(environment_ids))

    def delete(self, models, keys, start=None, end=None, timestamp=None, environment_ids=None):
        self.validate_arguments(models, _environment_ids(environment_ids))

    def get_range(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        conditions=None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ) -> dict[TSDBKey, list[tuple[int, int]]]:
        self.validate_arguments([model], _environment_ids(environment_ids))
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def record(self, model, key, values, timestamp=None, environment_id=None):
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
    ) -> dict[int, list[tuple[int, Any]]]:
        self.validate_arguments([model], [environment_id])
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def get_distinct_counts_totals(
        self,
        model,
        keys: Sequence[int],
        start,
        end=None,
        rollup=None,
        environment_id=None,
        use_cache=False,
        jitter_value=None,
        tenant_ids=None,
        referrer_suffix=None,
        conditions=None,
    ):
        self.validate_arguments([model], [environment_id])
        return {k: 0 for k in keys}

    def merge_distinct_counts(
        self, model, destination, sources, timestamp=None, environment_ids=None
    ):
        self.validate_arguments([model], _environment_ids(environment_ids))

    def delete_distinct_counts(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        self.validate_arguments(models, _environment_ids(environment_ids))

    def record_frequency_multi(
        self,
        requests: Sequence[tuple[TSDBModel, Mapping[str, Mapping[str, int | float]]]],
        timestamp=None,
        environment_id=None,
    ):
        self.validate_arguments([model for model, request in requests], [environment_id])

    def get_frequency_series(
        self,
        model: TSDBModel,
        items: Mapping[TSDBKey, Sequence[TSDBItem]],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]]:
        self.validate_arguments([model], [environment_id])
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        return {
            key: [(timestamp, {k: 0.0 for k in members}) for timestamp in series]
            for key, members in items.items()
        }

    def merge_frequencies(
        self,
        model: TSDBModel,
        destination: str,
        sources: Sequence[TSDBKey],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        self.validate_arguments([model], _environment_ids(environment_ids))

    def delete_frequencies(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        self.validate_arguments(models, _environment_ids(environment_ids))

    def flush(self):
        pass
