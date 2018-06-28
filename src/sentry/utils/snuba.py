from __future__ import absolute_import

from collections import OrderedDict
from contextlib import contextmanager
from dateutil.parser import parse as parse_datetime
from itertools import chain
from operator import or_
import six
import time
import urllib3

from django.conf import settings
from django.db.models import Q

from sentry.event_manager import HASH_RE
from sentry.models import Environment, Group, GroupHash, GroupHashTombstone, GroupRelease, Release, ReleaseProject
from sentry.utils import metrics, json
from sentry.utils.dates import to_timestamp
from functools import reduce

# TODO remove this when Snuba accepts more than 500 issues
MAX_ISSUES = 500
MAX_HASHES = 5000


class SnubaError(Exception):
    pass


@contextmanager
def timer(name, prefix='snuba.client'):
    t = time.time()
    try:
        yield
    finally:
        metrics.timing('{}.{}'.format(prefix, name), time.time() - t)

_snuba_pool = urllib3.connectionpool.connection_from_url(
    settings.SENTRY_SNUBA,
    retries=False,
    timeout=30,
    maxsize=10,
)


def raw_query(start, end, groupby=None, conditions=None, filter_keys=None,
              aggregations=None, rollup=None, arrayjoin=None, limit=None, orderby=None,
              having=None, referrer=None, is_grouprelease=False, selected_columns=None,):
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
    groupby = groupby or []
    conditions = conditions or []
    having = having or []
    aggregations = aggregations or []
    filter_keys = filter_keys or {}
    selected_columns = selected_columns or []

    with timer('get_snuba_map'):
        forward, reverse = get_snuba_translators(filter_keys, is_grouprelease=is_grouprelease)

    if 'project_id' in filter_keys:
        # If we are given a set of project ids, use those directly.
        project_ids = filter_keys['project_id']
    elif filter_keys:
        # Otherwise infer the project_ids from any related models
        with timer('get_related_project_ids'):
            ids = [get_related_project_ids(k, filter_keys[k]) for k in filter_keys]
            project_ids = list(set.union(*map(set, ids)))
    else:
        project_ids = []

    for col, keys in six.iteritems(forward(filter_keys.copy())):
        if keys:
            if len(keys) == 1 and keys[0] is None:
                conditions.append((col, 'IS NULL', None))
            else:
                conditions.append((col, 'IN', keys))

    if not project_ids:
        raise SnubaError("No project_id filter, or none could be inferred from other filters.")

    # If the grouping, aggregation, or any of the conditions reference `issue`
    # we need to fetch the issue definitions (issue -> fingerprint hashes)
    aggregate_cols = [a[1] for a in aggregations]
    condition_cols = [c[0] for c in flat_conditions(conditions)]
    all_cols = groupby + aggregate_cols + condition_cols + selected_columns
    get_issues = 'issue' in all_cols

    with timer('get_project_issues'):
        issues = get_project_issues(project_ids, filter_keys.get('issue')) if get_issues else None

    request = {k: v for k, v in six.iteritems({
        'from_date': start.isoformat(),
        'to_date': end.isoformat(),
        'conditions': conditions,
        'having': having,
        'groupby': groupby,
        'project': project_ids,
        'aggregations': aggregations,
        'granularity': rollup,
        'issues': issues,
        'arrayjoin': arrayjoin,
        'limit': limit,
        'orderby': orderby,
        'selected_columns': selected_columns,
    }) if v is not None}

    headers = {}
    if referrer:
        headers['referer'] = referrer

    try:
        with timer('snuba_query'):
            response = _snuba_pool.urlopen(
                'POST', '/query', body=json.dumps(request), headers=headers)
    except urllib3.exceptions.HTTPError as err:
        raise SnubaError(err)

    try:
        body = json.loads(response.data)
    except ValueError:
        raise SnubaError("Could not decode JSON response: {}".format(response.data))

    if response.status != 200:
        if body.get('error'):
            raise SnubaError(body['error'])
        else:
            raise SnubaError('HTTP {}'.format(response.status))

    # Forward and reverse translation maps from model ids to snuba keys, per column
    body['data'] = [reverse(d) for d in body['data']]
    return body


def query(start, end, groupby, conditions=None, filter_keys=None,
          aggregations=None, rollup=None, arrayjoin=None, limit=None, orderby=None,
          having=None, referrer=None, is_grouprelease=False, selected_columns=None):

    aggregations = aggregations or [['count()', '', 'aggregate']]
    filter_keys = filter_keys or {}
    selected_columns = selected_columns or []

    body = raw_query(start, end, groupby=groupby, conditions=conditions, filter_keys=filter_keys,
                     selected_columns=selected_columns, aggregations=aggregations, rollup=rollup, arrayjoin=arrayjoin,
                     limit=limit, orderby=orderby, having=having, referrer=referrer, is_grouprelease=is_grouprelease)

    # Validate and scrub response, and translate snuba keys back to IDs
    aggregate_cols = [a[2] for a in aggregations]
    expected_cols = set(groupby + aggregate_cols + selected_columns)
    got_cols = set(c['name'] for c in body['meta'])

    assert expected_cols == got_cols

    with timer('process_result'):
        return nest_groups(body['data'], groupby, aggregate_cols)


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
        inter = OrderedDict()
        for d in data:
            inter.setdefault(d[g], []).append(d)
        return OrderedDict(
            (k, nest_groups(v, rest, aggregate_cols)) for k, v in six.iteritems(inter)
        )


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


def get_snuba_translators(filter_keys, is_grouprelease=False):
    """
    Some models are stored differently in snuba, eg. as the environment
    name instead of the the environment ID. Here we create and return forward()
    and reverse() translation functions that perform all the required changes.

    forward() is designed to work on the filter_keys and so should be called
    with a map of {column: [key1, key2], ...} and should return an updated map
    with the filter keys replaced with the ones that Snuba expects.

    reverse() is designed to work on result rows, so should be called with a row
    in the form {column: value, ...} and will return a translated result row.

    Because translation can potentially rely on combinations of different parts
    of the result row, I decided to implement them as composable functions over the
    row to be translated. This should make it simpler to add any other needed
    translations as long as you can express them as forward(filters) and reverse(row)
    functions.
    """

    # Helper lambdas to compose translator functions
    identity = (lambda x: x)
    compose = (lambda f, g: lambda x: f(g(x)))
    replace = (lambda d, key, val: d.update({key: val}) or d)

    forward = identity
    reverse = identity

    map_columns = {
        'environment': (Environment, 'name', lambda name: None if name == '' else name),
        'tags[sentry:release]': (Release, 'version', identity),
    }

    for col, (model, field, fmt) in six.iteritems(map_columns):
        fwd, rev = None, None
        ids = filter_keys.get(col)
        if not ids:
            continue
        if is_grouprelease and col == "tags[sentry:release]":
            # GroupRelease -> Release translation is a special case because the
            # translation relies on both the Group and Release value in the result row.
            #
            # We create a map of {grouprelease_id: (group_id, version), ...} and the corresponding
            # reverse map of {(group_id, version): grouprelease_id, ...}
            # NB this does depend on `issue` being defined in the query result, and the correct
            # set of issues being resolved, which is outside the control of this function.
            gr_map = GroupRelease.objects.filter(id__in=ids).values_list(
                "id", "group_id", "release_id"
            )
            ver = dict(Release.objects.filter(id__in=[x[2] for x in gr_map]).values_list(
                "id", "version"
            ))
            fwd_map = {gr: (group, ver[release]) for (gr, group, release) in gr_map}
            rev_map = dict(reversed(t) for t in six.iteritems(fwd_map))
            fwd = (
                lambda col, trans: lambda filters: replace(
                    filters, col, [trans[k][1] for k in filters[col]]
                )
            )(col, fwd_map)
            rev = (
                lambda col, trans: lambda row: replace(
                    # The translate map may not have every combination of issue/release
                    # returned by the query.
                    row, col, trans.get((row["issue"], row[col]))
                )
            )(col, rev_map)

        else:
            fwd_map = {
                k: fmt(v)
                for k, v in model.objects.filter(id__in=ids).values_list("id", field)
            }
            rev_map = dict(reversed(t) for t in six.iteritems(fwd_map))
            fwd = (
                lambda col, trans: lambda filters: replace(
                    filters, col, [trans[k] for k in filters[col] if k]
                )
            )(col, fwd_map)
            rev = (
                lambda col, trans: lambda row: replace(
                    row, col, trans[row[col]]) if col in row else row
            )(col, rev_map)

        if fwd:
            forward = compose(forward, fwd)
        if rev:
            reverse = compose(reverse, rev)

    # Extra reverse translator for time column.
    reverse = compose(
        reverse,
        lambda row: replace(row, "time", int(to_timestamp(parse_datetime(row["time"]))))
        if "time" in row
        else row,
    )

    return (forward, reverse)


def get_project_issues(project_ids, issue_ids=None):
    """
    Get a list of issues and associated fingerprint hashes for a list of
    project ids. If issue_ids is set, then return only those issues.

    Returns a list: [(issue_id: [hash1, hash2, ...]), ...]
    """
    if issue_ids:
        issue_ids = issue_ids[:MAX_ISSUES]
        hashes = GroupHash.objects.filter(
            group_id__in=issue_ids
        )[:MAX_HASHES]
    else:
        hashes = GroupHash.objects.filter(
            project__in=project_ids,
            group_id__isnull=False,
        )[:MAX_HASHES]

    hashes = [h for h in hashes if HASH_RE.match(h.hash)]
    if not hashes:
        return []

    hashes_by_project = {}
    for h in hashes:
        hashes_by_project.setdefault(h.project_id, []).append(h.hash)

    tombstones = GroupHashTombstone.objects.filter(
        reduce(or_, (Q(project_id=pid, hash__in=hshes)
                     for pid, hshes in six.iteritems(hashes_by_project)))
    )

    tombstones_by_project = {}
    for tombstone in tombstones:
        tombstones_by_project.setdefault(
            tombstone.project_id, {}
        )[tombstone.hash] = tombstone.deleted_at

    # return [(gid, pid, [(hash, tombstone_date), (hash, tombstone_date), ...]), ...]
    result = {}
    for h in hashes:
        tombstone_date = tombstones_by_project.get(h.project_id, {}).get(h.hash, None)
        pair = (
            h.hash,
            tombstone_date.strftime("%Y-%m-%d %H:%M:%S") if tombstone_date else None
        )
        result.setdefault((h.group_id, h.project_id), []).append(pair)
    return [k + (v,) for k, v in result.items()][:MAX_ISSUES]


def get_related_project_ids(column, ids):
    """
    Get the project_ids from a model that has a foreign key to project.
    """
    mappings = {
        'environment': (Environment, 'id', 'project_id'),
        'issue': (Group, 'id', 'project_id'),
        'tags[sentry:release]': (ReleaseProject, 'release_id', 'project_id'),
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


def insert_raw(data):
    data = json.dumps(data)
    try:
        with timer('snuba_insert_raw'):
            return _snuba_pool.urlopen(
                'POST', '/tests/insert',
                body=data,
            )
    except urllib3.exceptions.HTTPError as err:
        raise SnubaError(err)
