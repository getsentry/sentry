"""
sentry.tsdb.base
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.utils import timezone
from enum import Enum

from sentry.utils.dates import to_timestamp

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


class TSDBModel(Enum):
    internal = 0

    # number of events seen specific to grouping
    project = 1
    project_tag_key = 2
    project_tag_value = 3
    group = 4
    group_tag_key = 5
    group_tag_value = 6

    # the number of events sent to the server
    project_total_received = 100
    # the number of events rejected due to rate limiting
    project_total_rejected = 101
    # the number of operations
    project_operations = 102
    # the number of operations with an error state
    project_operation_errors = 103
    # the number of events blocked due to being blacklisted
    project_total_blacklisted = 104

    # the number of events sent to the server
    organization_total_received = 200
    # the number of events rejected due to rate limiting
    organization_total_rejected = 201
    # the number of events blocked due to being blacklisted
    organization_total_blacklisted = 202

    # distinct count of users that have been affected by an event in a group
    users_affected_by_group = 300
    # distinct count of users that have been affected by an event in a project
    users_affected_by_project = 301

    # frequent_organization_received_by_system = 400
    # frequent_organization_rejected_by_system = 401
    # frequent_organization_blacklisted_by_system = 402
    # frequent_values_by_issue_tag = 405

    # number of events seen for a project, by organization
    frequent_projects_by_organization = 403
    # number of issues seen for a project, by project
    frequent_issues_by_project = 404


class BaseTSDB(object):
    models = TSDBModel

    def __init__(self, rollups=settings.SENTRY_TSDB_ROLLUPS):
        self.rollups = rollups

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def normalize_to_epoch(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        epoch = int(to_timestamp(timestamp))
        return epoch - (epoch % seconds)

    def normalize_ts_to_epoch(self, epoch, seconds):
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return epoch - (epoch % seconds)

    def normalize_to_rollup(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch rollup.
        """
        epoch = int(to_timestamp(timestamp))
        return int(epoch / seconds)

    def normalize_ts_to_rollup(self, epoch, seconds):
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return int(epoch / seconds)

    def get_optimal_rollup(self, start_timestamp, end_timestamp):
        """
        Identify the lowest granularity rollup available within the given time
        range.
        """
        num_seconds = int(to_timestamp(end_timestamp)) - int(to_timestamp(start_timestamp))

        # calculate the highest rollup within time range
        for rollup, samples in self.rollups:
            if rollup * samples >= num_seconds:
                return rollup
        return self.rollups[-1][0]

    def get_optimal_rollup_series(self, start, end=None, rollup=None):
        if end is None:
            end = timezone.now()

        # NOTE: "optimal" here means "able to most closely reflect the upper
        # and lower bounds", not "able to construct the most efficient query"
        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        series = [self.normalize_to_epoch(start, rollup)]
        end_ts = int(to_timestamp(end))
        while series[-1] + rollup < end_ts:
            series.append(series[-1] + rollup)

        return rollup, series

    def calculate_expiry(self, rollup, samples, timestamp):
        """
        Calculate the expiration time for a rollup.

        :param rollup: rollup interval (in seconds)
        :param samples: number of samples to maintain
        :param timestamp: datetime used to calculate the rollup epoch
        """
        epoch = self.normalize_to_epoch(timestamp, rollup)
        return epoch + (rollup * samples)

    def incr(self, model, key, timestamp=None, count=1):
        """
        Increment project ID=1:

        >>> incr(TimeSeriesModel.project, 1)
        """
        raise NotImplementedError

    def incr_multi(self, items, timestamp=None, count=1):
        """
        Increment project ID=1 and group ID=5:

        >>> incr_multi([(TimeSeriesModel.project, 1), (TimeSeriesModel.group, 5)])
        """
        for model, key in items:
            self.incr(model, key, timestamp, count)

    def get_range(self, model, keys, start, end, rollup=None):
        """
        To get a range of data for group ID=[1, 2, 3]:

        Both ``start`` and ``end`` are inclusive.

        Returns a mapping of key => [(timestamp, count), ...].

        >>> now = timezone.now()
        >>> get_range([TSDBModel.group], [1, 2, 3],
        >>>           start=now - timedelta(days=1),
        >>>           end=now)
        """
        raise NotImplementedError

    def get_sums(self, model, keys, start, end, rollup=None):
        range_set = self.get_range(model, keys, start, end, rollup)
        sum_set = dict(
            (key, sum(p for _, p in points))
            for (key, points) in range_set.iteritems()
        )
        return sum_set

    def rollup(self, values, rollup):
        """
        Given a set of values (as returned from ``get_range``), roll them up
        using the ``rollup`` time (in seconds).
        """
        normalize_ts_to_epoch = self.normalize_ts_to_epoch
        result = {}
        for key, points in values.iteritems():
            result[key] = []
            last_new_ts = None
            for (ts, count) in points:
                new_ts = normalize_ts_to_epoch(ts, rollup)
                if new_ts == last_new_ts:
                    result[key][-1][1] += count
                else:
                    result[key].append([new_ts, count])
                    last_new_ts = new_ts
        return result

    def record(self, model, key, values, timestamp=None):
        """
        Record occurences of items in a single distinct counter.
        """
        raise NotImplementedError

    def record_multi(self, items, timestamp=None):
        """
        Record occurences of items in multiple distinct counters.
        """
        for model, key, values in items:
            self.record(model, key, values, timestamp)

    def get_distinct_counts_series(self, model, keys, start, end=None, rollup=None):
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        raise NotImplementedError

    def get_distinct_counts_totals(self, model, keys, start, end=None, rollup=None):
        """
        Count distinct items during a time range.
        """
        raise NotImplementedError

    def get_distinct_counts_union(self, model, keys, start, end=None, rollup=None):
        """
        Count the total number of distinct items across multiple counters
        during a time range.
        """
        raise NotImplementedError

    def record_frequency_multi(self, requests, timestamp=None):
        """
        Record items in a frequency table.

        Metrics to increment should be passed as sequence pairs, using this
        structure: ``(model, {key: {item: score, ...}, ...})``
        """
        raise NotImplementedError

    def get_most_frequent(self, model, keys, start, end=None, rollup=None, limit=None):
        """
        Retrieve the most frequently seen items in a frequency table.

        Results are returned as a mapping, where the key is the key requested
        and the value is a list of ``(member, score)`` tuples, ordered by the
        highest (most frequent) to lowest (least frequent) score. The maximum
        number of items returned is ``index capacity * rollup intervals`` if no
        ``limit`` is provided.
        """
        raise NotImplementedError

    def get_frequency_series(self, model, items, start, end=None, rollup=None):
        """
        Retrieve the frequency of known items in a table over time.

        The items requested should be passed as a mapping, where the key is the
        metric key, and the value is a sequence of members to retrieve scores
        for.

        Results are returned as a mapping, where the key is the key requested
        and the value is a list of ``(timestamp, {item: score, ...})`` pairs
        over the series.
        """
        raise NotImplementedError

    def get_frequency_totals(self, model, items, start, end=None, rollup=None):
        """
        Retrieve the total frequency of known items in a table over time.

        The items requested should be passed as a mapping, where the key is the
        metric key, and the value is a sequence of members to retrieve scores
        for.

        Results are returned as a mapping, where the key is the key requested
        and the value is a mapping of ``{item: score, ...}`` containing the
        total score of items over the interval.
        """
        raise NotImplementedError
