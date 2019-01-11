from __future__ import absolute_import

from collections import OrderedDict
from contextlib import contextmanager
from datetime import datetime, timedelta
from dateutil.parser import parse as parse_datetime
import os
import pytz
import re
import six
import time
import urllib3

from django.conf import settings

from sentry import quotas
from sentry.models import (
    Environment, Group, GroupRelease,
    Organization, Project, Release, ReleaseProject
)
from sentry.net.http import connection_from_url
from sentry.utils import metrics, json
from sentry.utils.dates import to_timestamp

# TODO remove this when Snuba accepts more than 500 issues
MAX_ISSUES = 500
MAX_HASHES = 5000

# Global Snuba request option override dictionary. Only intended
# to be used with the `options_override` contextmanager below.
# NOT THREAD SAFE!
OVERRIDE_OPTIONS = {
    'consistent': os.environ.get('SENTRY_SNUBA_CONSISTENT', 'false').lower() in ('true', '1')
}

SENTRY_SNUBA_MAP = {
    # general
    'id': 'event_id',
    'project.id': 'project_id',
    'platform': 'platform',
    'message': 'message',
    'issue.id': 'issue',
    'timestamp': 'timestamp',
    'time': 'time',
    'type': 'type',
    'version': 'version',
    # user
    'user.id': 'user_id',
    'user.email': 'email',
    'user.username': 'username',
    'user.ip': 'ip_address',
    # sdk
    'sdk.name': 'sdk_name',
    'sdk.version': 'sdk_version',
    # http
    'http.method': 'http_method',
    'http.url': 'http_referer',
    # os
    'os.build': 'os_build',
    'os.kernel_version': 'os_kernel_version',
    # device
    'device.name': 'device_name',
    'device.brand': 'device_brand',
    'device.locale': 'device_locale',
    'device.uuid': 'device_uuid',
    'device.model_id': 'device_model_id',
    'device.arch': 'device_arch',
    'device.battery_level': 'device_battery_level',
    'device.orientation': 'device_orientation',
    'device.simulator': 'device_orientation',
    'device.online': 'device_online',
    'device.charging': 'device_charging',
    # geo
    'geo.country_code': 'geo_country_code',
    'geo.region': 'geo_region',
    'geo.city': 'geo_city',
    # error, stack
    'error.type': 'exception_stacks.type',
    'error.value': 'exception_stacks.value',
    'error.mechanism': 'exception_stacks.mechanism_type',
    'error.handled': 'exception_stacks.mechanism_handled',
    'stack.abs_path': 'exception_frames.abs_path',
    'stack.filename': 'exception_frames.filename',
    'stack.package': 'exception_frames.package',
    'stack.module': 'exception_frames.module',
    'stack.function': 'exception_frames.function',
    'stack.in_app': 'exception_frames.in_app',
    'stack.colno': 'exception_frames.colno',
    'stack.lineno': 'exception_frames.lineno',
    'stack.stack_level': 'exception_frames.stack_level',
    # tags, contexts
    'tags.key': 'tags.key',
    'tags.value': 'tags.value',
    'tags_key': 'tags_key',
    'tags_value': 'tags_value',
    'contexts.key': 'contexts.key',
    'contexts.value': 'contexts.value',
    # misc
    'release': 'tags[sentry:release]',
}


class SnubaError(Exception):
    pass


class UnqualifiedQueryError(SnubaError):
    """
    Exception raised when no project_id qualifications were provided in the
    query or could be derived from other filter criteria.
    """


class UnexpectedResponseError(SnubaError):
    """
    Exception raised when the Snuba API server returns an unexpected response
    type (e.g. not JSON.)
    """


class QueryExecutionError(SnubaError):
    """
    Exception raised when a query failed to execute.
    """


class RateLimitExceeded(SnubaError):
    """
    Exception raised when a query cannot be executed due to rate limits.
    """


class SchemaValidationError(QueryExecutionError):
    """
    Exception raised when a query is not valid.
    """


class QueryMemoryLimitExceeded(QueryExecutionError):
    """
    Exception raised when a query would exceed the memory limit.
    """


class QueryIllegalTypeOfArgument(QueryExecutionError):
    """
    Exception raised when a function in the query is provided an invalid
    argument type.
    """


class QueryTooManySimultaneous(QueryExecutionError):
    """
    Exception raised when a query is rejected due to too many simultaneous
    queries being performed on the database.
    """


clickhouse_error_codes_map = {
    43: QueryIllegalTypeOfArgument,
    241: QueryMemoryLimitExceeded,
    202: QueryTooManySimultaneous,
}


class QueryOutsideRetentionError(Exception):
    pass


class QueryOutsideGroupActivityError(Exception):
    pass


@contextmanager
def timer(name, prefix='snuba.client'):
    t = time.time()
    try:
        yield
    finally:
        metrics.timing(u'{}.{}'.format(prefix, name), time.time() - t)


@contextmanager
def options_override(overrides):
    """\
    NOT THREAD SAFE!

    Adds to OVERRIDE_OPTIONS, restoring previous values and removing
    keys that didn't previously exist on exit, so that calls to this
    can be nested.
    """
    previous = {}
    delete = []

    for k, v in overrides.items():
        try:
            previous[k] = OVERRIDE_OPTIONS[k]
        except KeyError:
            delete.append(k)
        OVERRIDE_OPTIONS[k] = v

    try:
        yield
    finally:
        for k, v in previous.items():
            OVERRIDE_OPTIONS[k] = v
        for k in delete:
            OVERRIDE_OPTIONS.pop(k)


_snuba_pool = connection_from_url(
    settings.SENTRY_SNUBA,
    retries=5,
    timeout=30,
    maxsize=10,
)


epoch_naive = datetime(1970, 1, 1, tzinfo=None)


def to_naive_timestamp(value):
    """
    Convert a time zone aware datetime to a POSIX timestamp (with fractional
    component.)
    """
    return (value - epoch_naive).total_seconds()


def zerofill(data, start, end, rollup, orderby):
    rv = []
    start = (int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup)
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if obj['time'] in data_by_time:
            data_by_time[obj['time']].append(obj)
        else:
            data_by_time[obj['time']] = [obj]

    for key in six.moves.xrange(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            rv.append({'time': key})

    if orderby.startswith('-'):
        return list(reversed(rv))

    return rv


def get_snuba_column_name(name):
    """
    Get corresponding Snuba column name from Sentry snuba map, if not found
    the column is assumed to be a tag. If name is falsy, leave unchanged.
    """
    if not name:
        return name
    return SENTRY_SNUBA_MAP.get(name, u'tags[{}]'.format(name))


def get_arrayjoin(column):
    match = re.match(r'^(exception_stacks|exception_frames|contexts)\..+$', column)
    if match:
        return match.groups()[0]


def transform_aliases_and_query(**kwargs):
    """
    Convert aliases in selected_columns, groupby, aggregation, conditions,
    orderby and arrayjoin fields to their internal Snuba format and post the
    query to Snuba. Convert back translated aliases before returning snuba
    results.
    """

    arrayjoin_map = {
        'error': 'exception_stacks',
        'stack': 'exception_frames',
    }

    translated_columns = {}
    derived_columns = set()

    selected_columns = kwargs['selected_columns']
    groupby = kwargs['groupby']
    aggregations = kwargs['aggregations']
    conditions = kwargs['conditions'] or []
    filter_keys = kwargs['filter_keys']

    for (idx, col) in enumerate(selected_columns):
        name = get_snuba_column_name(col)
        selected_columns[idx] = name
        translated_columns[name] = col

    for (idx, col) in enumerate(groupby):
        name = get_snuba_column_name(col)
        groupby[idx] = name
        translated_columns[name] = col

    for aggregation in aggregations or []:
        derived_columns.add(aggregation[2])
        aggregation[1] = get_snuba_column_name(aggregation[1])

    for (col, _value) in six.iteritems(filter_keys):
        name = get_snuba_column_name(col)
        filter_keys[name] = filter_keys.pop(col)

    def handle_condition(cond):
        if isinstance(cond, (list, tuple)) and len(cond):
            if (isinstance(cond[0], (list, tuple))):
                cond[0] = handle_condition(cond[0])
            elif len(cond) == 3:
                # map column name
                cond[0] = get_snuba_column_name(cond[0])
            elif len(cond) == 2 and cond[0] == "has":
                # first function argument is the column if function is "has"
                cond[1][0] = get_snuba_column_name(cond[1][0])
        return cond

    kwargs['conditions'] = [handle_condition(condition) for condition in conditions]

    order_by_column = kwargs['orderby'].lstrip('-')
    kwargs['orderby'] = u'{}{}'.format(
        '-' if kwargs['orderby'].startswith('-') else '',
        order_by_column if order_by_column in derived_columns else get_snuba_column_name(
            order_by_column)
    ) or None

    kwargs['arrayjoin'] = arrayjoin_map.get(kwargs['arrayjoin'], kwargs['arrayjoin'])

    result = raw_query(**kwargs)

    # Translate back columns that were converted to snuba format
    for col in result['meta']:
        col['name'] = translated_columns.get(col['name'], col['name'])

    def get_row(row):
        return {translated_columns.get(key, key): value for key, value in row.items()}

    if len(translated_columns):
        result['data'] = [get_row(row) for row in result['data']]
        if kwargs['rollup'] > 0:
            result['data'] = zerofill(
                result['data'],
                kwargs['start'],
                kwargs['end'],
                kwargs['rollup'],
                kwargs['orderby'],
            )

    return result


def raw_query(start, end, groupby=None, conditions=None, filter_keys=None,
              aggregations=None, rollup=None, arrayjoin=None, limit=None, offset=None,
              orderby=None, having=None, referrer=None, is_grouprelease=False,
              selected_columns=None, totals=None, limitby=None, turbo=False):
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

    # convert to naive UTC datetimes, as Snuba only deals in UTC
    # and this avoids offset-naive and offset-aware issues
    start = naiveify_datetime(start)
    end = naiveify_datetime(end)

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
        project_ids = list(set(filter_keys['project_id']))
    elif filter_keys:
        # Otherwise infer the project_ids from any related models
        with timer('get_related_project_ids'):
            ids = [get_related_project_ids(k, filter_keys[k]) for k in filter_keys]
            project_ids = list(set.union(*map(set, ids)))
    else:
        project_ids = []

    for col, keys in six.iteritems(forward(filter_keys.copy())):
        if keys:
            if len(keys) == 1 and None in keys:
                conditions.append((col, 'IS NULL', None))
            else:
                conditions.append((col, 'IN', keys))

    if not project_ids:
        raise UnqualifiedQueryError(
            "No project_id filter, or none could be inferred from other filters.")

    # any project will do, as they should all be from the same organization
    project = Project.objects.get(pk=project_ids[0])
    retention = quotas.get_event_retention(
        organization=Organization(project.organization_id)
    )
    if retention:
        start = max(start, datetime.utcnow() - timedelta(days=retention))
        if start > end:
            raise QueryOutsideRetentionError

    start = shrink_time_window(filter_keys.get('issue'), start)

    # if `shrink_time_window` pushed `start` after `end` it means the user queried
    # a Group for T1 to T2 when the group was only active for T3 to T4, so the query
    # wouldn't return any results anyway
    if start > end:
        raise QueryOutsideGroupActivityError

    request = {k: v for k, v in six.iteritems({
        'from_date': start.isoformat(),
        'to_date': end.isoformat(),
        'conditions': conditions,
        'having': having,
        'groupby': groupby,
        'totals': totals,
        'project': project_ids,
        'aggregations': aggregations,
        'granularity': rollup,
        'arrayjoin': arrayjoin,
        'limit': limit,
        'offset': offset,
        'limitby': limitby,
        'orderby': orderby,
        'selected_columns': selected_columns,
        'turbo': turbo
    }) if v is not None}

    request.update(OVERRIDE_OPTIONS)

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
        raise UnexpectedResponseError(u"Could not decode JSON response: {}".format(response.data))

    if response.status != 200:
        if body.get('error'):
            error = body['error']
            if response.status == 429:
                raise RateLimitExceeded(error['message'])
            elif error['type'] == 'schema':
                raise SchemaValidationError(error['message'])
            elif error['type'] == 'clickhouse':
                raise clickhouse_error_codes_map.get(
                    error['code'],
                    QueryExecutionError,
                )(error['message'])
            else:
                raise SnubaError(error['message'])
        else:
            raise SnubaError(u'HTTP {}'.format(response.status))

    # Forward and reverse translation maps from model ids to snuba keys, per column
    body['data'] = [reverse(d) for d in body['data']]
    return body


def query(start, end, groupby, conditions=None, filter_keys=None,
          aggregations=None, rollup=None, arrayjoin=None, limit=None, offset=None,
          orderby=None, having=None, referrer=None, is_grouprelease=False,
          selected_columns=None, totals=None, limitby=None):

    aggregations = aggregations or [['count()', '', 'aggregate']]
    filter_keys = filter_keys or {}
    selected_columns = selected_columns or []

    try:
        body = raw_query(
            start, end, groupby=groupby, conditions=conditions, filter_keys=filter_keys,
            selected_columns=selected_columns, aggregations=aggregations, rollup=rollup,
            arrayjoin=arrayjoin, limit=limit, offset=offset, orderby=orderby, having=having,
            referrer=referrer, is_grouprelease=is_grouprelease, totals=totals, limitby=limitby
        )
    except (QueryOutsideRetentionError, QueryOutsideGroupActivityError):
        if totals:
            return OrderedDict(), {}
        else:
            return OrderedDict()

    # Validate and scrub response, and translate snuba keys back to IDs
    aggregate_names = [a[2] for a in aggregations]
    selected_names = [c[2] if isinstance(c, (list, tuple)) else c for c in selected_columns]
    expected_cols = set(groupby + aggregate_names + selected_names)
    got_cols = set(c['name'] for c in body['meta'])

    assert expected_cols == got_cols, 'expected {}, got {}'.format(expected_cols, got_cols)

    with timer('process_result'):
        if totals:
            return nest_groups(body['data'], groupby, aggregate_names + selected_names), body['totals']
        else:
            return nest_groups(body['data'], groupby, aggregate_names + selected_names)


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


def get_related_project_ids(column, ids):
    """
    Get the project_ids from a model that has a foreign key to project.
    """
    mappings = {
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
            resp = _snuba_pool.urlopen(
                'POST', '/tests/insert',
                body=data,
            )
            if resp.status != 200:
                raise SnubaError("Non-200 response from Snuba insert!")
            return resp
    except urllib3.exceptions.HTTPError as err:
        raise SnubaError(err)


def shrink_time_window(issues, start):
    """\
    If a single issue is passed in, shrink the `start` parameter to be briefly before
    the `first_seen` in order to hopefully eliminate a large percentage of rows scanned.

    Note that we don't shrink `end` based on `last_seen` because that value is updated
    asynchronously by buffers, and will cause queries to skip recently seen data on
    stale groups.
    """
    if issues and len(issues) == 1:
        group = Group.objects.get(pk=list(issues)[0])
        start = max(start, naiveify_datetime(group.first_seen) - timedelta(minutes=5))

    return start


def naiveify_datetime(dt):
    return dt if not dt.tzinfo else dt.astimezone(pytz.utc).replace(tzinfo=None)
