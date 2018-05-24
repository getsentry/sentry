from __future__ import absolute_import

import six

from sentry.tsdb.base import BaseTSDB, TSDBModel
from sentry.utils import snuba
from sentry.utils.dates import to_datetime


class SnubaTSDB(BaseTSDB):
    """
    A time series query interface to Snuba

    Write methods are not supported, as the raw data from which we generate our
    time series is assumed to already exist in snuba.

    Read methods are supported only for models based on group/event data and
    will return empty results for unsupported models.
    """

    # The ``model_columns`` are translations of TSDB models into the required
    # columns for querying snuba. Keys are ``TSDBModel`` enumeration values,
    # values are in the form ``(groupby_column, aggregateby_column or None)``.
    # Only the models that are listed in this mapping are supported.
    model_columns = {
        TSDBModel.project: ('project_id', None),
        TSDBModel.group: ('issue', None),
        TSDBModel.release: ('tags[sentry:release]', None),
        TSDBModel.users_affected_by_group: ('issue', 'tags[sentry:user]'),
        TSDBModel.users_affected_by_project: ('project_id', 'tags[sentry:user]'),
        TSDBModel.frequent_environments_by_group: ('issue', 'environment'),
        TSDBModel.frequent_releases_by_group: ('issue', 'tags[sentry:release]'),
        TSDBModel.frequent_issues_by_project: ('project_id', 'issue'),
    }

    def __init__(self, **options):
        super(SnubaTSDB, self).__init__(**options)

    def get_data(self, model, keys, start, end, rollup=None, environment_id=None,
                 aggregation='count()', group_on_model=True, group_on_time=False):
        """
        Normalizes all the TSDB parameters and sends a query to snuba.

        `group_on_time`: whether to add a GROUP BY clause on the 'time' field.
        `group_on_model`: whether to add a GROUP BY clause on the primary model.
        """
        model_columns = self.model_columns.get(model)

        if model_columns is None:
            raise Exception("Unsupported TSDBModel: {}".format(model.name))

        model_group, model_aggregate = model_columns

        groupby = []
        if group_on_model and model_group is not None:
            groupby.append(model_group)
        if group_on_time:
            groupby.append('time')
        if aggregation == 'count()' and model_aggregate is not None:
            # Special case, because count has different semantics, we change:
            # `COUNT(model_aggregate)` to `COUNT() GROUP BY model_aggregate`
            groupby.append(model_aggregate)
            model_aggregate = None

        keys_map = dict(zip(model_columns, self.flatten_keys(keys)))
        keys_map = {k: v for k, v in six.iteritems(keys_map) if k is not None and v is not None}
        if environment_id is not None:
            keys_map['environment'] = [environment_id]

        aggregations = [[aggregation, model_aggregate, 'aggregate']]

        # For historical compatibility with bucket-counted TSDB implementations
        # we grab the original bucketed series and add the rollup time to the
        # timestamp of the last bucket to get the end time.
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)
        start = to_datetime(series[0])
        end = to_datetime(series[-1] + rollup)

        result = snuba.query(start, end, groupby, None, keys_map,
                             aggregations, rollup, referrer='tsdb')

        if group_on_time:
            keys_map['time'] = series
        self.zerofill(result, groupby, keys_map)

        return result

    def zerofill(self, result, groups, group_keys):
        if len(groups) > 0:
            for k in group_keys[groups[0]]:
                if k not in result:
                    result[k] = 0 if len(groups) == 1 else {}

            if len(groups) > 1:
                subgroups = groups[1:]
                for v in result.values():
                    self.zerofill(v, subgroups, group_keys)

    def get_range(self, model, keys, start, end, rollup=None, environment_id=None):
        result = self.get_data(model, keys, start, end, rollup, environment_id,
                               aggregation='count()', group_on_time=True)
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
        for k, top in six.iteritems(result):
            item_scores = [(v, float(i + 1)) for i, v in enumerate(reversed(top or []))]
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
                (timestamp, {v: float(i + 1) for i, v in enumerate(reversed(topk or []))})
                for (timestamp, topk) in result[k].items()
            ])

        return result

    def get_frequency_series(self, model, items, start, end=None,
                             rollup=None, environment_id=None):
        result = self.get_data(model, items, start, end, rollup, environment_id,
                               aggregation='count()', group_on_time=True)
        # convert
        #    {group:{timestamp:{agg:count}}}
        # into
        #    {group: [(timestamp, {agg: count, ...}), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        return self.get_data(model, items, start, end, rollup, environment_id,
                             aggregation='count()')

    def flatten_keys(self, items):
        """
        Returns a normalized set of keys based on the various formats accepted
        by TSDB methods. The input is either just a plain list of keys for the
        top level or a `{level1_key: [level2_key, ...]}` dictionary->list map.
        """
        # Flatten keys
        if isinstance(items, (list, tuple)):
            return (items, None)
        elif isinstance(items, dict):
            return (items.keys(), list(set.union(*(set(v) for v in items.values()))))
        else:
            return (None, None)
