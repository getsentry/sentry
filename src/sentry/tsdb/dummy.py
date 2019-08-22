from __future__ import absolute_import

from sentry.tsdb.base import BaseTSDB


class DummyTSDB(BaseTSDB):
    """
    A no-op time-series storage.
    """

    def incr(self, model, key, timestamp=None, count=1, environment_id=None):
        self.validate_arguments([model], [environment_id])

    def merge(self, model, destination, sources, timestamp=None, environment_ids=None):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )
        self.validate_arguments([model], environment_ids)

    def delete(self, models, keys, start=None, end=None, timestamp=None, environment_ids=None):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )
        self.validate_arguments(models, environment_ids)

    def get_range(self, model, keys, start, end, rollup=None, environment_ids=None):
        self.validate_arguments([model], environment_ids if environment_ids is not None else [None])
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def record(self, model, key, values, timestamp=None, environment_id=None):
        self.validate_arguments([model], [environment_id])

    def get_distinct_counts_series(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def get_distinct_counts_totals(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])
        return {k: 0 for k in keys}

    def get_distinct_counts_union(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])
        return 0

    def merge_distinct_counts(
        self, model, destination, sources, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )
        self.validate_arguments([model], environment_ids)

    def delete_distinct_counts(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )
        self.validate_arguments(models, environment_ids)

    def record_frequency_multi(self, requests, timestamp=None, environment_id=None):
        self.validate_arguments([model for model, request in requests], [environment_id])

    def get_most_frequent(
        self, model, keys, start, end=None, rollup=None, limit=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])
        return {key: [] for key in keys}

    def get_most_frequent_series(
        self, model, keys, start, end=None, rollup=None, limit=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)
        return {key: [(timestamp, {}) for timestamp in series] for key in keys}

    def get_frequency_series(self, model, items, start, end=None, rollup=None, environment_id=None):
        self.validate_arguments([model], [environment_id])
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key, members in items.items():
            result = results[key] = []
            for timestamp in series:
                result.append((timestamp, {k: 0.0 for k in members}))

        return results

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        self.validate_arguments([model], [environment_id])
        results = {}
        for key, members in items.items():
            results[key] = {member: 0.0 for member in members}
        return results

    def merge_frequencies(self, model, destination, sources, timestamp=None, environment_ids=None):
        environment_ids = list(
            (set(environment_ids) if environment_ids is not None else set()).union([None])
        )
        self.validate_arguments([model], environment_ids)

    def delete_frequencies(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )
        self.validate_arguments(models, environment_ids)

    def flush(self):
        pass
