from __future__ import absolute_import

import six

from sentry.tsdb.base import BaseTSDB, TSDBModel
from sentry.utils.snuba import query_snuba


class SnubaTSDB(BaseTSDB):
    """
    A time series query interface to Snuba

    Write methods are not supported, as the raw data from which we generate our
    time series is assumed to already exist in snuba.

    Read methods are supported only for models based on group/event data and
    will return empty results for unsupported models.
    """

    def __init__(self, **options):
        super(SnubaTSDB, self).__init__(**options)

    def model_columns(self, model):
        """
        Translates TSDB models into the required columns for querying snuba.
        Returns a tuple of (groupby_column, aggregateby_column)
        """
        return {
            TSDBModel.project: ('project_id', None),
            TSDBModel.group: ('issue', None),
            TSDBModel.release: ('release', None),
            TSDBModel.users_affected_by_group: ('issue', 'user_id'),
            TSDBModel.users_affected_by_project: ('project_id', 'user_id'),
            TSDBModel.users_affected_by_project: ('project_id', 'user_id'),
            TSDBModel.frequent_environments_by_group: ('issue', 'environment'),
            TSDBModel.frequent_releases_by_group: ('issue', 'release'),
            TSDBModel.frequent_issues_by_project: ('project_id', 'issue'),
        }.get(model, None)

    def get_data(self, model, keys, start, end, rollup=None, environment_id=None,
                 aggregation='count', group_on_model=True, group_on_time=False):
        """
        Queries the snuba service for time series data.

        `group_on_time`: whether to add a GROUP BY clause on the 'time' field.
        `group_on_model`: whether to add a GROUP BY clause on the primary model.
        """
        model_columns = self.model_columns(model)

        if model_columns is None:
            return None

        model_group, model_aggregate = model_columns

        groupby = []
        if group_on_model and model_group is not None:
            groupby.append(model_group)
        if group_on_time:
            groupby.append('time')
        if aggregation == 'count' and model_aggregate is not None:
            # Special case, because count has different semantics, we change:
            # `COUNT(model_aggregate)` to `COUNT() GROUP BY model_aggregate`
            groupby.append(model_aggregate)
            model_aggregate = None

        keys_map = dict(zip(model_columns, self.flatten_keys(keys)))
        keys_map = {k: v for k, v in six.iteritems(keys_map) if k is not None and v is not None}
        if environment_id is not None:
            keys_map['environment'] = [environment_id]

        return query_snuba(keys_map, start, end, rollup, groupby, aggregation, model_aggregate)

    def get_range(self, model, keys, start, end, rollup=None, environment_id=None):
        result = self.get_data(model, keys, start, end, rollup, environment_id,
                               aggregation='count', group_on_time=True)
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_series(self, model, keys, start, end=None,
                                   rollup=None, environment_id=None):
        result = self.get_data(model, keys, start, end, rollup, environment_id,
                               aggregation='uniq', group_on_time=True)
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_totals(self, model, keys, start, end=None,
                                   rollup=None, environment_id=None):
        return self.get_data(model, keys, start, end, rollup, environment_id,
                             aggregation='uniq')

    def get_distinct_counts_union(self, model, keys, start, end=None,
                                  rollup=None, environment_id=None):
        return self.get_data(model, keys, start, end, rollup, environment_id,
                             aggregation='uniq', group_on_model=False)

    def get_most_frequent(self, model, keys, start, end=None,
                          rollup=None, limit=10, environment_id=None):
        aggregation = 'topK({})'.format(limit)
        result = self.get_data(model, keys, start, end, rollup, environment_id,
                               aggregation=aggregation)
        # convert
        #    {group:[top1, ...]}
        # into
        #    {group: [(top1, score), ...]}
        for k in result:
            item_scores = [(v, float(i + 1)) for i, v in enumerate(reversed(result[k]))]
            result[k] = list(reversed(item_scores))

        return result

    def get_most_frequent_series(self, model, keys, start, end=None,
                                 rollup=None, limit=10, environment_id=None):
        aggregation = 'topK({})'.format(limit)
        result = self.get_data(model, keys, start, end, rollup, environment_id,
                               aggregation=aggregation, group_on_time=True)
        # convert
        #    {group:{timestamp:[top1, ...]}}
        # into
        #    {group: [(timestamp, {top1: score, ...}), ...]}
        for k in result:
            result[k] = sorted([
                (timestamp, {v: float(i + 1) for i, v in enumerate(reversed(topk))})
                for (timestamp, topk) in result[k].items()
            ])

        return result

    def get_frequency_series(self, model, items, start, end=None,
                             rollup=None, environment_id=None, limit=10):
        result = self.get_data(model, items, start, end, rollup, environment_id,
                               aggregation='count', group_on_time=True)
        # convert
        #    {group:{timestamp:{agg:count}}}
        # into
        #    {group: [(timestamp, {agg: count, ...}), ...]}
        return {k: result[k].items() for k in result}

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        return self.get_data(model, items, start, end, rollup, environment_id,
                             aggregation='count')

    def get_optimal_rollup(self, start):
        """
        Always return the smallest rollup as we can bucket on any granularity.
        """
        return self.rollups.keys()[0]

    def flatten_keys(self, items):
        """
        Returns a normalized set of keys based on the various formats accepted
        by TSDB methods. The input is either just a plain list of keys for the
        top level or a `{level1_key: [level2_key, ...]}` dictionary->list map.
        """
        # Flatten keys
        if isinstance(items, list):
            return (items, None)
        elif isinstance(items, dict):
            return (items.keys(), list(set.union(*(set(v) for v in items.values()))))
        else:
            return (None, None)
