from __future__ import absolute_import

from dateutil.parser import parse as parse_datetime
from itertools import chain
import json
import requests
import six
import os
import pytz

from sentry.models import Group, GroupHash, Environment, Release, ReleaseProject
from sentry.utils.dates import to_timestamp

SNUBA = os.environ.get('SNUBA', 'http://localhost:5000')


class SnubaError(Exception):
    pass


def query(start, end, groupby, conditions=None, filter_keys=None,
          aggregations=None, rollup=None, arrayjoin=None, limit=None, orderby=None):
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

    `aggregations` a list of (aggregation_function, column, alias) tuples to be
    passed to the query.
    """
    start = start.replace(tzinfo=pytz.utc) if not start.tzinfo else start
    end = end.replace(tzinfo=pytz.utc) if not end.tzinfo else end

    groupby = groupby or []
    conditions = conditions or []
    aggregations = aggregations or [['count()', '', 'aggregate']]
    filter_keys = filter_keys or {}

    # Forward and reverse translation maps from model ids to snuba keys, per column
    snuba_map = {col: get_snuba_map(col, keys) for col, keys in six.iteritems(filter_keys)}
    snuba_map = {k: v for k, v in six.iteritems(snuba_map) if k is not None and v is not None}
    rev_snuba_map = {col: dict(reversed(i) for i in keys.items())
                     for col, keys in six.iteritems(snuba_map)}

    for col, keys in six.iteritems(filter_keys):
        keys = [k for k in keys if k is not None]
        if col in snuba_map:
            keys = [snuba_map[col][k] for k in keys if k in snuba_map[col]]
        if keys:
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
        raise SnubaError("No project_id filter, or none could be inferred from other filters.")

    # If the grouping, aggregation, or any of the conditions reference `issue`
    # we need to fetch the issue definitions (issue -> fingerprint hashes)
    aggregate_cols = [a[1] for a in aggregations]
    condition_cols = [c[0] for c in flat_conditions(conditions)]
    all_cols = groupby + aggregate_cols + condition_cols
    get_issues = 'issue' in all_cols
    issues = get_project_issues(project_ids, filter_keys.get('issue')) if get_issues else None

    url = '{0}/query'.format(SNUBA)
    request = {k: v for k, v in six.iteritems({
        'from_date': start.isoformat(),
        'to_date': end.isoformat(),
        'conditions': conditions,
        'groupby': groupby,
        'project': project_ids,
        'aggregations': aggregations,
        'granularity': rollup,
        'issues': issues,
        'arrayjoin': arrayjoin,
        'limit': limit,
        'orderby': orderby,
    }) if v is not None}

    try:
        response = requests.post(url, data=json.dumps(request))
        response.raise_for_status()
    except requests.RequestException as re:
        raise SnubaError(re)

    try:
        response = json.loads(response.text)
    except ValueError:
        raise SnubaError("Could not decode JSON response: {}".format(response.text))

    # Validate and scrub response, and translate snuba keys back to IDs
    aggregate_cols = [a[2] for a in aggregations]
    expected_cols = set(groupby + aggregate_cols)
    got_cols = set(c['name'] for c in response['meta'])

    assert expected_cols == got_cols

    for d in response['data']:
        if 'time' in d:
            d['time'] = int(to_timestamp(parse_datetime(d['time'])))
        for col in rev_snuba_map:
            if col in d:
                d[col] = rev_snuba_map[col][d[col]]

    return nest_groups(response['data'], groupby, aggregate_cols)


def nest_groups(data, groups, aggregate_cols):
    """
    Build a nested mapping from query response rows. Each group column
    gives a new level of nesting and the leaf result is the aggregate
    """
    if not groups:
        # At leaf level, just return the aggregations from the first data row
        if len(aggregate_cols) == 1:
            # Special case, if there is only one aggregate, just return the raw value
            return data[0][aggregate_cols[0]] if data else None
        else:
            return {c: data[0][c] for c in aggregate_cols} if data else None
    else:
        g, rest = groups[0], groups[1:]
        inter = {}
        for d in data:
            inter.setdefault(d[g], []).append(d)
        return {k: nest_groups(v, rest, aggregate_cols) for k, v in six.iteritems(inter)}


def is_condition(cond_or_list):
    return len(cond_or_list) == 3 and isinstance(cond_or_list[0], six.string_types)


def flat_conditions(conditions):
    return list(chain(*[[c] if is_condition(c) else c for c in conditions]))

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
