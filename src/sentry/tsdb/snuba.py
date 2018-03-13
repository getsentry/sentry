from __future__ import absolute_import

from dateutil.parser import parse as parse_datetime
import json
import requests
import six

from sentry.tsdb.base import BaseTSDB, TSDBModel
from sentry.utils.dates import to_timestamp

from sentry.models import GroupHash, Environment


class SnubaTSDB(BaseTSDB):
    """
    A time series query interface to Snuba

    Write methods are not supported, as the raw data from which we generate our
    time series is assumed to already exist in snuba.

    Read methods are supported only for models based on group/event data and
    will return empty results for unsupported models.
    """
    SNUBA = 'http://localhost:5000'

    def __init__(self, **options):
        super(SnubaTSDB, self).__init__(**options)

    def query_snuba(self, start, end, rollup, groupby, conditions,
                    project_id, aggregation, aggregateby):

        conditions = conditions or []

        # If the grouping, aggregation, or any of the conditions reference `issue`
        # we need to fetch the issue definitions (hashes)
        references_issues = 'issue' in [groupby, aggregateby] + [c[0] for c in conditions]
        issues = get_project_issues(project_id) if references_issues else None

        url = '{0}/query'.format(self.SNUBA)
        request = {k: v for k, v in six.iteritems({
            'from_date': start.isoformat(),
            'to_date': end.isoformat(),
            'conditions': conditions,
            'groupby': groupby,
            'project': project_id,
            'aggregation': aggregation,
            'aggregateby': aggregateby,
            'granularity': rollup,
            'issues': issues,
        }) if v is not None}
        response = requests.post(url, data=json.dumps(request))
        response = json.loads(response.text)

        # Response rows from snuba are grouped by the groupby column, and by time.
        # Here we build a structure mapping distinct values of the groupby column
        # to a series of (time, count) tuples.
        result = {}
        cols = [c['name'] for c in response['meta'] if c['name'] != groupby]
        for d in response['data']:
            if 'time' in d:
                d['time'] = to_timestamp(parse_datetime(d['time']))
            series = result.setdefault(d[groupby], [])
            series.append(tuple(d[c] for c in cols))

        # TODO fill in zero-buckets that are missing from the result

        for k in result:
            result[k] = sorted(result[k])

        return result

    def model_columns(self, model):
        """
        Translates TSDB models into the required columns for querying snuba.
        Returns a tuple of (groupby_column, aggregateby_column)

        Returns None if the model is not supported in snuba.
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
        }.get(model, (None, None))

    def get_data(self, model, keys, start, end, rollup=None,
                 environment_id=None, aggregation='count'):
        (groupcol, aggcol) = self.model_columns(model)

        if not groupcol:
            return {}
        else:
            conditions = [(groupcol, 'IN', keys)]
            if environment_id is not None:
                environment = 'fixme'  # TODO get environment name from id
                conditions.append(('environment', '=', environment))
            if groupcol == 'project_id':
                project_id = keys
            else:
                project_id = get_project(groupcol, keys)
            return self.query_snuba(
                start, end, rollup, groupcol, conditions,
                project_id, aggregation, aggcol
            )

    def get_range(self, model, keys, start, end, rollup=None, environment_id=None):
        return self.get_data(model, keys, start, end, rollup, environment_id, aggregation='count')

    def get_distinct_counts_series(self, model, keys, start, end=None,
                                   rollup=None, environment_id=None):
        return self.get_data(model, keys, start, end, rollup, environment_id, aggregation='uniq')

    def get_most_frequent(self, model, keys, start, end=None,
                          rollup=None, limit=None, environment_id=None):
        default_limit = 10
        aggregation = 'topK({})'.format(limit or default_limit)
        return self.get_data(model, keys, start, end, rollup,
                             environment_id, aggregation=aggregation)

    def get_optimal_rollup(self, start):
        """
        Always return the smallest rollup as we can bucket on any granularity.
        """
        return self.rollups.keys()[0]


# The following are functions for resolving information from sentry models
# about projects, environments, and issues (groups). Having the TSDB
# implementation have to know about these relationships is not ideal, and
# couples this tsdb implementation to django model code, but is currently
# implemented here for simplicity.

def get_environment(environment_id):
    """
    Get an environment name from an id.
    """
    return Environment.objects.get(pk=environment_id).name


def get_project_issues(project_ids):
    """
    Get a list of issues and associated fingerprint hashes for a project.
    """
    project_ids = project_ids if isinstance(project_ids, list) else [project_ids]
    result = {}
    hashes = GroupHash.objects.filter(project__in=project_ids).values_list('group_id', 'hash')
    for gid, hsh in hashes:
        result.setdefault(gid, []).append(hsh)
    return list(result.items())


def get_project(model, model_ids):
    """
    Get the project_ids from a model that has a foreign key to project.
    """
    return [1]
