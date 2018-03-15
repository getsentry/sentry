from __future__ import absolute_import

from datetime import timedelta
from dateutil.parser import parse as parse_datetime

from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB


def has_shape(data, shape, allow_empty=False):
    """
    Determine if a data object has the provided shape

    At any level, the object in `data` and in `shape` must have the same type.
    A dict is the same shape if all its keys and values have the same shape as the
    key/value in `shape`. The number of keys/values is not relevant.
    A list is the same shape if all its items have the same shape as the value
    in `shape`
    A tuple is the same shape if it has the same length as `shape` and all the
    values have the same shape as the corresponding value in `shape`
    Any other object simply has to have the same type.
    If `allow_empty` is set, lists and dicts in `data` will pass even if they are empty.
    """
    if type(data) != type(shape):
        return False
    if isinstance(data, dict):
        return (allow_empty or len(data) > 0) and\
            all(has_shape(k, shape.keys()[0]) for k in data.keys()) and\
            all(has_shape(v, shape.values()[0]) for v in data.values())
    elif isinstance(data, list):
        return (allow_empty or len(data) > 0) and\
            all(has_shape(v, shape[0]) for v in data)
    elif isinstance(data, tuple):
        return len(data) == len(shape) and all(
            has_shape(data[i], shape[i]) for i in range(len(data)))
    else:
        return True


class SnubaTSDBTest(TestCase):
    def setUp(self):
        self.db = SnubaTSDB()

    def test_result_shape(self):
        """
        Tests that the results from the different TSDB methods have the
        expected format.
        """
        now = parse_datetime('2018-03-09T01:00:00Z')
        project_id = 194503
        dts = [now + timedelta(hours=i) for i in range(4)]

        results = self.db.get_most_frequent(TSDBModel.frequent_issues_by_project,
                                            [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: [(1, 1.0)]})

        results = self.db.get_most_frequent_series(TSDBModel.frequent_issues_by_project,
                                                   [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: [(1, {1: 1.0})]})

        items = {
            project_id: (0, 1, 2)  # {project_id: (issue_id, issue_id, ...)}
        }
        results = self.db.get_frequency_series(TSDBModel.frequent_issues_by_project,
                                               items, dts[0], dts[-1])
        assert has_shape(results, {1: [(1, {1: 1})]})

        results = self.db.get_frequency_totals(TSDBModel.frequent_issues_by_project,
                                               items, dts[0], dts[-1])
        assert has_shape(results, {1: {1: 1}})

        results = self.db.get_range(TSDBModel.project, [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: [(1, 1)]})
        assert project_id in results

        results = self.db.get_distinct_counts_series(TSDBModel.users_affected_by_project,
                                                     [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: [(1, 1)]})

        results = self.db.get_distinct_counts_totals(TSDBModel.users_affected_by_project,
                                                     [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: 1})

        results = self.db.get_distinct_counts_union(TSDBModel.users_affected_by_project,
                                                    [project_id], dts[0], dts[-1])
        assert has_shape(results, 1)
