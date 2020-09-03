from __future__ import absolute_import

import collections
from copy import deepcopy
import itertools

import six

from sentry.tsdb.base import BaseTSDB, TSDBModel
from sentry.utils import snuba, outcomes
from sentry.ingest.inbound_filters import FILTER_STAT_KEYS_TO_VALUES
from sentry.utils.dates import to_datetime
from sentry.utils.compat import map
from sentry.utils.compat import zip


SnubaModelQuerySettings = collections.namedtuple(
    # `dataset` - the dataset in Snuba that we want to query
    # `groupby` - the column in Snuba that we want to put in the group by statement
    # `aggregate` - the column in Snuba that we want to run the aggregate function on
    # `conditions` - any additional model specific conditions we want to pass in the query
    "SnubaModelSettings",
    ["dataset", "groupby", "aggregate", "conditions"],
)


class SnubaTSDB(BaseTSDB):
    """
    A time series query interface to Snuba

    Write methods are not supported, as the raw data from which we generate our
    time series is assumed to already exist in snuba.

    Read methods are supported only for models based on group/event data and
    will return empty results for unsupported models.
    """

    # ``non_outcomes_query_settings`` are all the query settings for for non outcomes based TSDB models.
    # Single tenant reads Snuba for these models, and writes to DummyTSDB. It reads and writes to Redis for all the
    # other models.
    non_outcomes_query_settings = {
        TSDBModel.project: SnubaModelQuerySettings(
            snuba.Dataset.Events, "project_id", None, [["type", "!=", "transaction"]]
        ),
        TSDBModel.group: SnubaModelQuerySettings(snuba.Dataset.Events, "group_id", None, None),
        TSDBModel.release: SnubaModelQuerySettings(
            snuba.Dataset.Events, "tags[sentry:release]", None, None
        ),
        TSDBModel.users_affected_by_group: SnubaModelQuerySettings(
            snuba.Dataset.Events, "group_id", "tags[sentry:user]", None
        ),
        TSDBModel.users_affected_by_project: SnubaModelQuerySettings(
            snuba.Dataset.Events, "project_id", "tags[sentry:user]", None
        ),
        TSDBModel.frequent_environments_by_group: SnubaModelQuerySettings(
            snuba.Dataset.Events, "group_id", "environment", None
        ),
        TSDBModel.frequent_releases_by_group: SnubaModelQuerySettings(
            snuba.Dataset.Events, "group_id", "tags[sentry:release]", None
        ),
        TSDBModel.frequent_issues_by_project: SnubaModelQuerySettings(
            snuba.Dataset.Events, "project_id", "group_id", None
        ),
    }

    # ``project_filter_model_query_settings`` and ``outcomes_partial_query_settings`` are all the TSDB models for
    # outcomes
    project_filter_model_query_settings = {
        model: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes, "project_id", "times_seen", [["reason", "=", reason]]
        )
        for reason, model in FILTER_STAT_KEYS_TO_VALUES.items()
    }

    outcomes_partial_query_settings = {
        TSDBModel.organization_total_received: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "org_id",
            "times_seen",
            [["outcome", "!=", outcomes.Outcome.INVALID]],
        ),
        TSDBModel.organization_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "org_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.organization_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "org_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.FILTERED]],
        ),
        TSDBModel.project_total_received: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "project_id",
            "times_seen",
            [["outcome", "!=", outcomes.Outcome.INVALID]],
        ),
        TSDBModel.project_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "project_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.project_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "project_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.FILTERED]],
        ),
        TSDBModel.key_total_received: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "key_id",
            "times_seen",
            [["outcome", "!=", outcomes.Outcome.INVALID]],
        ),
        TSDBModel.key_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "key_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.key_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.Outcomes,
            "key_id",
            "times_seen",
            [["outcome", "=", outcomes.Outcome.FILTERED]],
        ),
    }

    # ``model_query_settings`` is a translation of TSDB models into required settings for querying snuba
    model_query_settings = dict(
        itertools.chain(
            project_filter_model_query_settings.items(),
            outcomes_partial_query_settings.items(),
            non_outcomes_query_settings.items(),
        )
    )

    project_filter_model_query_settings_lower_rollup = {
        model: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw, "project_id", None, [["reason", "=", reason]]
        )
        for reason, model in FILTER_STAT_KEYS_TO_VALUES.items()
    }

    # The Outcomes dataset aggregates outcomes into chunks of an hour. So, for rollups less than an hour, we want to
    # query the raw outcomes dataset, with a few different settings (defined in lower_rollup_query_settings).
    other_lower_rollup_query_settings = {
        TSDBModel.organization_total_received: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw, "org_id", None, [["outcome", "!=", outcomes.Outcome.INVALID]]
        ),
        TSDBModel.organization_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw,
            "org_id",
            None,
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.organization_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw, "org_id", None, [["outcome", "=", outcomes.Outcome.FILTERED]]
        ),
        TSDBModel.project_total_received: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw,
            "project_id",
            None,
            [["outcome", "!=", outcomes.Outcome.INVALID]],
        ),
        TSDBModel.project_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw,
            "project_id",
            None,
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.project_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw,
            "project_id",
            None,
            [["outcome", "=", outcomes.Outcome.FILTERED]],
        ),
        TSDBModel.key_total_received: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw, "key_id", None, [["outcome", "!=", outcomes.Outcome.INVALID]]
        ),
        TSDBModel.key_total_rejected: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw,
            "key_id",
            None,
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED]],
        ),
        TSDBModel.key_total_blacklisted: SnubaModelQuerySettings(
            snuba.Dataset.OutcomesRaw, "key_id", None, [["outcome", "=", outcomes.Outcome.FILTERED]]
        ),
    }

    lower_rollup_query_settings = dict(
        itertools.chain(
            project_filter_model_query_settings_lower_rollup.items(),
            other_lower_rollup_query_settings.items(),
        )
    )

    def __init__(self, **options):
        super(SnubaTSDB, self).__init__(**options)

    def get_data(
        self,
        model,
        keys,
        start,
        end,
        rollup=None,
        environment_ids=None,
        aggregation="count()",
        group_on_model=True,
        group_on_time=False,
        snuba_filters=None,
    ):
        """
        Normalizes all the TSDB parameters and sends a query to snuba.

        `group_on_time`: whether to add a GROUP BY clause on the 'time' field.
        `group_on_model`: whether to add a GROUP BY clause on the primary model.
        """
        # XXX: to counteract the hack in project_key_stats.py
        if model in [
            TSDBModel.key_total_received,
            TSDBModel.key_total_blacklisted,
            TSDBModel.key_total_rejected,
        ]:
            keys = list(set(map(lambda x: int(x), keys)))

        # 10s is the only rollup under an hour that we support
        if rollup and rollup == 10 and model in self.lower_rollup_query_settings.keys():
            model_query_settings = self.lower_rollup_query_settings.get(model)
        else:
            model_query_settings = self.model_query_settings.get(model)

        if model_query_settings is None:
            raise Exception(u"Unsupported TSDBModel: {}".format(model.name))

        model_group = model_query_settings.groupby
        model_aggregate = model_query_settings.aggregate

        groupby = []
        if group_on_model and model_group is not None:
            groupby.append(model_group)
        if group_on_time:
            groupby.append("time")
        if aggregation == "count()" and model_aggregate is not None:
            # Special case, because count has different semantics, we change:
            # `COUNT(model_aggregate)` to `COUNT() GROUP BY model_aggregate`
            groupby.append(model_aggregate)
            model_aggregate = None

        columns = (model_query_settings.groupby, model_query_settings.aggregate)
        keys_map = dict(zip(columns, self.flatten_keys(keys)))
        keys_map = {k: v for k, v in six.iteritems(keys_map) if k is not None and v is not None}
        if environment_ids is not None:
            keys_map["environment"] = environment_ids

        aggregations = [[aggregation, model_aggregate, "aggregate"]]

        # For historical compatibility with bucket-counted TSDB implementations
        # we grab the original bucketed series and add the rollup time to the
        # timestamp of the last bucket to get the end time.
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)
        start = to_datetime(series[0])
        end = to_datetime(series[-1] + rollup)
        limit = min(10000, int(len(keys) * ((end - start).total_seconds() / rollup)))

        conditions = []
        if model_query_settings.conditions is not None:
            conditions = deepcopy(model_query_settings.conditions)
            # copy because we modify the conditions in snuba.query

        if snuba_filters is not None:
            conditions = conditions + snuba_filters

        if keys:
            result = snuba.query(
                dataset=model_query_settings.dataset,
                start=start,
                end=end,
                groupby=groupby,
                conditions=conditions,
                filter_keys=keys_map,
                aggregations=aggregations,
                rollup=rollup,
                limit=limit,
                referrer="tsdb",
                is_grouprelease=(model == TSDBModel.frequent_releases_by_group),
            )
        else:
            result = {}

        if group_on_time:
            keys_map["time"] = series

        self.zerofill(result, groupby, keys_map)
        self.trim(result, groupby, keys)

        return result

    def zerofill(self, result, groups, flat_keys):
        """
        Fills in missing keys in the nested result with zeroes.
        `result` is the nested result
        `groups` is the order in which the result is nested, eg: ['project', 'time']
        `flat_keys` is a map from groups to lists of required keys for that group.
                    eg: {'project': [1,2]}
        """
        if len(groups) > 0:
            group, subgroups = groups[0], groups[1:]
            # Zerofill missing keys
            for k in flat_keys[group]:
                if k not in result:
                    result[k] = 0 if len(groups) == 1 else {}

            if subgroups:
                for v in result.values():
                    self.zerofill(v, subgroups, flat_keys)

    def trim(self, result, groups, keys):
        """
        Similar to zerofill, but removes keys that should not exist.
        Uses the non-flattened version of keys, so that different sets
        of keys can exist in different branches at the same nesting level.
        """
        if len(groups) > 0:
            group, subgroups = groups[0], groups[1:]
            if isinstance(result, dict):
                for rk in result.keys():
                    if group == "time":  # Skip over time group
                        self.trim(result[rk], subgroups, keys)
                    elif rk in keys:
                        if isinstance(keys, dict):
                            self.trim(result[rk], subgroups, keys[rk])
                    else:
                        del result[rk]

    def get_range(
        self, model, keys, start, end, rollup=None, environment_ids=None, snuba_filters=None
    ):
        # 10s is the only rollup under an hour that we support
        if rollup and rollup == 10 and model in self.lower_rollup_query_settings.keys():
            model_query_settings = self.lower_rollup_query_settings.get(model)
        else:
            model_query_settings = self.model_query_settings.get(model)

        assert model_query_settings is not None, u"Unsupported TSDBModel: {}".format(model.name)

        if model_query_settings.dataset == snuba.Dataset.Outcomes:
            aggregate_function = "sum"
        else:
            aggregate_function = "count()"

        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            environment_ids,
            aggregation=aggregate_function,
            group_on_time=True,
            snuba_filters=snuba_filters,
        )
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_series(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="uniq",
            group_on_time=True,
        )
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_totals(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        return self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="uniq",
        )

    def get_distinct_counts_union(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        return self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="uniq",
            group_on_model=False,
        )

    def get_most_frequent(
        self, model, keys, start, end=None, rollup=None, limit=10, environment_id=None
    ):
        aggregation = u"topK({})".format(limit)
        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation=aggregation,
        )
        # convert
        #    {group:[top1, ...]}
        # into
        #    {group: [(top1, score), ...]}
        for k, top in six.iteritems(result):
            item_scores = [(v, float(i + 1)) for i, v in enumerate(reversed(top or []))]
            result[k] = list(reversed(item_scores))

        return result

    def get_most_frequent_series(
        self, model, keys, start, end=None, rollup=None, limit=10, environment_id=None
    ):
        aggregation = u"topK({})".format(limit)
        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation=aggregation,
            group_on_time=True,
        )
        # convert
        #    {group:{timestamp:[top1, ...]}}
        # into
        #    {group: [(timestamp, {top1: score, ...}), ...]}
        for k in result:
            result[k] = sorted(
                [
                    (timestamp, {v: float(i + 1) for i, v in enumerate(reversed(topk or []))})
                    for (timestamp, topk) in result[k].items()
                ]
            )

        return result

    def get_frequency_series(self, model, items, start, end=None, rollup=None, environment_id=None):
        result = self.get_data(
            model,
            items,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="count()",
            group_on_time=True,
        )
        # convert
        #    {group:{timestamp:{agg:count}}}
        # into
        #    {group: [(timestamp, {agg: count, ...}), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        return self.get_data(
            model,
            items,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="count()",
        )

    def flatten_keys(self, items):
        """
        Returns a normalized set of keys based on the various formats accepted
        by TSDB methods. The input is either just a plain list of keys for the
        top level or a `{level1_key: [level2_key, ...]}` dictionary->list map.
        The output is a 2-tuple of ([level_1_keys], [all_level_2_keys])
        """
        if isinstance(items, collections.Mapping):
            return (
                items.keys(),
                list(set.union(*(set(v) for v in items.values())) if items else []),
            )
        elif isinstance(items, (collections.Sequence, collections.Set)):
            return (items, None)
        else:
            raise ValueError("Unsupported type: %s" % (type(items)))
