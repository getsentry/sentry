from __future__ import absolute_import

from datetime import timedelta
from dateutil.parser import parse as parse_datetime
import json
import pytest
import responses

from django.conf import settings

from sentry.models import GroupHash, Release
from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_timestamp


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


class SnubaTSDBRequestsTest(TestCase):
    """
    Tests that the Snuba TSDB backend makes correctly formatted requests
    to the Snuba service, and formats the results correctly.

    Mocks the Snuba service request/response.
    """

    def setUp(self):
        self.db = SnubaTSDB()

    @responses.activate
    def test_result_shape(self):
        """
        Tests that the results from the different TSDB methods have the
        expected format.
        """
        now = parse_datetime('2018-03-09T01:00:00Z')
        project_id = 194503
        dts = [now + timedelta(hours=i) for i in range(4)]

        with responses.RequestsMock() as rsps:
            def snuba_response(request):
                body = json.loads(request.body)
                aggs = body.get('aggregations', [])
                meta = [{'name': col} for col in body['groupby'] + [a[2] for a in aggs]]
                datum = {col['name']: 1 for col in meta}
                datum['project_id'] = project_id
                if 'time' in datum:
                    datum['time'] = '2018-03-09T01:00:00Z'
                for agg in aggs:
                    if agg[0].startswith('topK'):
                        datum[agg[2]] = [99]
                return (200, {}, json.dumps({'data': [datum], 'meta': meta}))

            rsps.add_callback(
                responses.POST,
                settings.SENTRY_SNUBA + '/query',
                callback=snuba_response)

            results = self.db.get_most_frequent(TSDBModel.frequent_issues_by_project,
                                                [project_id], dts[0], dts[0])
            assert has_shape(results, {1: [(1, 1.0)]})

            results = self.db.get_most_frequent_series(TSDBModel.frequent_issues_by_project,
                                                       [project_id], dts[0], dts[0])
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

            results = self.db.get_distinct_counts_series(TSDBModel.users_affected_by_project,
                                                         [project_id], dts[0], dts[-1])
            assert has_shape(results, {1: [(1, 1)]})

            results = self.db.get_distinct_counts_totals(TSDBModel.users_affected_by_project,
                                                         [project_id], dts[0], dts[-1])
            assert has_shape(results, {1: 1})

            results = self.db.get_distinct_counts_union(TSDBModel.users_affected_by_project,
                                                        [project_id], dts[0], dts[-1])
            assert has_shape(results, 1)

    @responses.activate
    def test_groups_request(self):
        now = parse_datetime('2018-03-09T01:00:00Z')
        dts = [now + timedelta(hours=i) for i in range(4)]
        project = self.create_project()
        group = self.create_group(project=project)
        GroupHash.objects.create(project=project, group=group, hash='0' * 32)
        group2 = self.create_group(project=project)
        GroupHash.objects.create(project=project, group=group2, hash='1' * 32)

        with responses.RequestsMock() as rsps:
            def snuba_response(request):
                body = json.loads(request.body)
                assert body['aggregations'] == [['count()', None, 'aggregate']]
                assert body['project'] == [project.id]
                assert body['groupby'] == ['issue', 'time']

                # Assert issue->hash map is generated, but only for referenced issues
                assert [group.id, ['0' * 32]] in body['issues']
                assert [group2.id, ['1' * 32]] not in body['issues']

                return (200, {}, json.dumps({
                    'data': [{'time': '2018-03-09T01:00:00Z', 'issue': 1, 'aggregate': 100}],
                    'meta': [{'name': 'time'}, {'name': 'issue'}, {'name': 'aggregate'}]
                }))

            rsps.add_callback(
                responses.POST,
                settings.SENTRY_SNUBA + '/query',
                callback=snuba_response)
            results = self.db.get_range(TSDBModel.group, [group.id], dts[0], dts[-1])
            assert results is not None

    @responses.activate
    def test_releases_request(self):
        now = parse_datetime('2018-03-09T01:00:00Z')
        project = self.create_project()
        release = Release.objects.create(
            organization_id=self.organization.id,
            version='version X',
            date_added=now,
        )
        release.add_project(project)
        dts = [now + timedelta(hours=i) for i in range(4)]

        with responses.RequestsMock() as rsps:
            def snuba_response(request):
                body = json.loads(request.body)
                assert body['aggregations'] == [['count()', None, 'aggregate']]
                assert body['project'] == [project.id]
                assert body['groupby'] == ['tags[sentry:release]', 'time']
                assert ['tags[sentry:release]', 'IN', ['version X']] in body['conditions']
                return (200, {}, json.dumps({
                    'data': [{'tags[sentry:release]': 'version X', 'time': '2018-03-09T01:00:00Z', 'aggregate': 100}],
                    'meta': [{'name': 'tags[sentry:release]'}, {'name': 'time'}, {'name': 'aggregate'}]
                }))

            rsps.add_callback(
                responses.POST,
                settings.SENTRY_SNUBA + '/query',
                callback=snuba_response)
            results = self.db.get_range(
                TSDBModel.release, [release.id], dts[0], dts[-1], rollup=3600)
            assert results == {
                release.id: [
                    (int(to_timestamp(d)), 100 if d == now else 0)
                    for d in dts]
            }

    @responses.activate
    def test_environment_request(self):
        now = parse_datetime('2018-03-09T01:00:00Z')
        project = self.create_project()
        env = self.create_environment(project=project, name="prod")
        dts = [now + timedelta(hours=i) for i in range(4)]

        with responses.RequestsMock() as rsps:
            def snuba_response(request):
                body = json.loads(request.body)
                assert body['aggregations'] == [['count()', None, 'aggregate']]
                assert body['project'] == [project.id]
                assert body['groupby'] == ['project_id', 'time']
                assert ['environment', 'IN', ['prod']] in body['conditions']
                return (200, {}, json.dumps({
                    'data': [{'project_id': project.id, 'time': '2018-03-09T01:00:00Z', 'aggregate': 100}],
                    'meta': [{'name': 'project_id'}, {'name': 'time'}, {'name': 'aggregate'}]
                }))

            rsps.add_callback(
                responses.POST,
                settings.SENTRY_SNUBA + '/query',
                callback=snuba_response)
            results = self.db.get_range(TSDBModel.project, [project.id],
                                        dts[0], dts[-1], environment_id=env.id, rollup=3600)
            assert results == {
                project.id: [
                    (int(to_timestamp(d)), 100 if d == now else 0)
                    for d in dts]
            }

    def test_invalid_model(self):
        with pytest.raises(Exception) as ex:
            self.db.get_range(TSDBModel.project_total_received_discarded, [], None, None)
        assert "Unsupported TSDBModel" in ex.value.message
