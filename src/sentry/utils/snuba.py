from __future__ import absolute_import

from dateutil.parser import parse as parse_datetime
import json
import requests
import six
import os

from sentry.models import Group, GroupHash, Environment, Release, ReleaseProject
from sentry.utils.dates import to_timestamp

SNUBA = os.environ.get('SNUBA', 'http://localhost:5000')


def query(start, end, groupby, conditions=None, filter_keys=None,
          aggregation=None, aggregateby=None, rollup=None, arrayjoin=None):
    """
    Sends a query to snuba.

    `conditions`: A list of (column, operator, literal) conditions to be passed
    to the query. Conditions that we know will not have to be translated should
    be passed this way (eg tag[foo] = bar).

    `filter_keys`: A dictionary of {col: [key, ...]} that will be converted
    into "col IN (key, ...)" conditions. These are used to restrict the query to
    known sets of project/issue/environment/release etc. Appropriate
    translations (eg. from environment model ID to environment name) are
    performed on the query, and the inverse translation performed on the
    result. The project_id(s) to restrict the query to will also be
    automatically inferred from these keys.
    """
    groupby = groupby or []
    conditions = conditions or []
    filter_keys = filter_keys or {}

    # Forward and reverse translation maps from model ids to snuba keys, per column
    snuba_map = {col: get_snuba_map(col, keys) for col, keys in six.iteritems(filter_keys)}
    snuba_map = {k: v for k, v in six.iteritems(snuba_map) if k is not None and v is not None}
    rev_snuba_map = {col: dict(reversed(i) for i in keys.items())
                     for col, keys in six.iteritems(snuba_map)}

    for col, keys in six.iteritems(filter_keys):
        if col in snuba_map:
            keys = [snuba_map[col][k] for k in keys]
        conditions.append((col, 'IN', keys))

    if 'project_id' in filter_keys:
        # If we are given a set of project ids, use those directly.
        project_ids = filter_keys['project_id']
    elif filter_keys:
        # Otherwise infer the project_ids from any related models
        ids = [get_related_project_ids(k, filter_keys[k]) for k in filter_keys]
        project_ids = list(set.union(*map(set, ids)))
    else:
        project_ids = []

    if not project_ids:
        raise Exception("No project_id filter, or none could be inferred from other filters.")

    # If the grouping, aggregation, or any of the conditions reference `issue`
    # we need to fetch the issue definitions (issue -> fingerprint hashes)
    get_issues = 'issue' in groupby + [aggregateby] + [c[0] for c in conditions]
    issues = get_project_issues(project_ids, filter_keys.get('issue')) if get_issues else None

    url = '{0}/query'.format(SNUBA)
    request = {k: v for k, v in six.iteritems({
        'from_date': start.isoformat(),
        'to_date': end.isoformat(),
        'conditions': conditions,
        'groupby': groupby,
        'project': project_ids,
        'aggregation': aggregation,
        'aggregateby': aggregateby,
        'granularity': rollup,
        'issues': issues,
        'arrayjoin': arrayjoin,
    }) if v is not None}

    response = requests.post(url, data=json.dumps(request))
    # TODO handle error responses
    response = json.loads(response.text)

    # Validate and scrub response, and translate snuba keys back to IDs
    expected_cols = groupby + ['aggregate']
    assert all(c['name'] in expected_cols for c in response['meta'])
    for d in response['data']:
        if 'time' in d:
            d['time'] = int(to_timestamp(parse_datetime(d['time'])))
        if d['aggregate'] is None:
            d['aggregate'] = 0
        for col in rev_snuba_map:
            if col in d:
                d[col] = rev_snuba_map[col][d[col]]

    return nest_groups(response['data'], groupby)


def nest_groups(data, groups):
    """
    Build a nested mapping from query response rows. Each group column
    gives a new level of nesting and the leaf result is the aggregate
    """
    if not groups:
        # If no groups, just return the aggregate value from the first row
        return data[0]['aggregate'] if data else None
    else:
        g, rest = groups[0], groups[1:]
        inter = {}
        for d in data:
            inter.setdefault(d[g], []).append(d)
        return {k: nest_groups(v, rest) for k, v in six.iteritems(inter)}

# The following are functions for resolving information from sentry models
# about projects, environments, and issues (groups). Having this snuba
# implementation have to know about these relationships is not ideal, and
# many of these relationships (eg environment id->name) will have already
# been queried and exist somewhere in the call stack, but for now, lookup
# is implemented here for simplicity.


def get_snuba_map(column, ids):
    """
    Some models are stored differently in snuba, eg. as the environment
    name instead of the the environment ID. Here we look up a set of keys
    for a given model and return a lookup dictionary from those keys to the
    equivalent ones in snuba.
    """
    mappings = {
        'environment': (Environment, 'name'),
        'release': (Release, 'version'),
    }
    if column in mappings and ids:
        model, field = mappings[column]
        return dict(model.objects.filter(id__in=ids).values_list('id', field))
    return None


def get_project_issues(project_ids, issue_ids=None):
    """
    Get a list of issues and associated fingerprint hashes for a list of
    project ids. If issue_ids is also set, then also restrict to only those
    issues as well.

    Returns a list: [(issue_id: [hash1, hash2, ...]), ...]
    """
    hashes = GroupHash.objects.filter(project__in=project_ids)
    if issue_ids:
        hashes = hashes.filter(group_id__in=issue_ids)
    result = {}
    for gid, hsh in hashes.values_list('group_id', 'hash'):
        result.setdefault(gid, []).append(hsh)
    return list(result.items())


def get_related_project_ids(column, ids):
    """
    Get the project_ids from a model that has a foreign key to project.
    """
    mappings = {
        'environment': (Environment, 'id', 'project_id'),
        'issue': (Group, 'id', 'project_id'),
        'release': (ReleaseProject, 'release_id', 'project_id'),
    }
    if ids:
        if column == "project_id":
            return ids
        elif column in mappings:
            model, id_field, project_field = mappings[column]
            return model.objects.filter(**{
                id_field + '__in': ids,
                project_field + '__isnull': False,
            }).values_list(project_field, flat=True)
    return []
