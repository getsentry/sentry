from __future__ import absolute_import

from collections import namedtuple, OrderedDict
from copy import deepcopy
from contextlib import contextmanager
from datetime import datetime, timedelta
from dateutil.parser import parse as parse_datetime
import os
import pytz
import re
import six
import time
import urllib3

from concurrent.futures import ThreadPoolExecutor
from django.conf import settings

from sentry import quotas
from sentry.models import (
    Environment,
    Group,
    GroupRelease,
    Organization,
    Project,
    ProjectKey,
    Release,
    ReleaseProject,
)
from sentry.net.http import connection_from_url
from sentry.utils import metrics, json
from sentry.utils.dates import to_timestamp
from sentry.snuba.events import Columns
from sentry.snuba.dataset import Dataset

# TODO remove this when Snuba accepts more than 500 issues
MAX_ISSUES = 500
MAX_HASHES = 5000

SAFE_FUNCTION_RE = re.compile(r"-?[a-zA-Z_][a-zA-Z0-9_]*$")
QUOTED_LITERAL_RE = re.compile(r"^'.*'$")

# Global Snuba request option override dictionary. Only intended
# to be used with the `options_override` contextmanager below.
# NOT THREAD SAFE!
OVERRIDE_OPTIONS = {
    "consistent": os.environ.get("SENTRY_SNUBA_CONSISTENT", "false").lower() in ("true", "1")
}

# There are several cases here where we support both a top level column name and
# a tag with the same name. Existing search patterns expect to refer to the tag,
# so we support <real_column_name>.name to refer to the top level column name.
SENTRY_SNUBA_MAP = {
    col.value.alias: col.value.event_name for col in Columns if col.value.event_name is not None
}


TRANSACTIONS_SENTRY_SNUBA_MAP = {
    col.value.alias: col.value.transaction_name
    for col in Columns
    if col.value.transaction_name is not None
}

# This maps the public column aliases to the discover dataset column names.
# Longer term we would like to not expose the transactions dataset directly
# to end users and instead have all ad-hoc queries go through the discover
# dataset.
DISCOVER_COLUMN_MAP = {
    col.value.alias: col.value.discover_name
    for col in Columns
    if col.value.discover_name is not None
}


DATASETS = {
    Dataset.Events: SENTRY_SNUBA_MAP,
    Dataset.Transactions: TRANSACTIONS_SENTRY_SNUBA_MAP,
    Dataset.Discover: DISCOVER_COLUMN_MAP,
}

# Store the internal field names to save work later on.
# Add `group_id` to the events dataset list as we don't want to publically
# expose that field, but it is used by eventstore and other internals.
DATASET_FIELDS = {
    Dataset.Events: list(SENTRY_SNUBA_MAP.values()),
    Dataset.Transactions: list(TRANSACTIONS_SENTRY_SNUBA_MAP.values()),
    Dataset.Discover: list(DISCOVER_COLUMN_MAP.values()),
}


class SnubaError(Exception):
    pass


class UnqualifiedQueryError(SnubaError):
    """
    Exception raised when a required qualification was not satisfied in the query.
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


SnubaTSResult = namedtuple("SnubaTSResult", ("data", "start", "end", "rollup"))


@contextmanager
def timer(name, prefix="snuba.client"):
    t = time.time()
    try:
        yield
    finally:
        metrics.timing(u"{}.{}".format(prefix, name), time.time() - t)


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


class RetrySkipTimeout(urllib3.Retry):
    """
    urllib3 Retry class does not allow us to retry on read errors but to exclude
    read timeout. Retrying after a timeout adds useless load to Snuba.
    """

    def increment(
        self, method=None, url=None, response=None, error=None, _pool=None, _stacktrace=None
    ):
        """
        Just rely on the parent class unless we have a read timeout. In that case
        immediately give up
        """
        if error and isinstance(error, urllib3.exceptions.ReadTimeoutError):
            raise six.reraise(type(error), error, _stacktrace)

        return super(RetrySkipTimeout, self).increment(
            method=method,
            url=url,
            response=response,
            error=error,
            _pool=_pool,
            _stacktrace=_stacktrace,
        )


_snuba_pool = connection_from_url(
    settings.SENTRY_SNUBA,
    retries=RetrySkipTimeout(
        total=5,
        # Expand our retries to POST since all of
        # our requests are POST and they don't mutate, so they
        # are safe to retry. Without this, we aren't
        # actually retrying at all.
        method_whitelist={"GET", "POST"},
    ),
    timeout=30,
    maxsize=10,
)
_query_thread_pool = ThreadPoolExecutor(max_workers=10)


epoch_naive = datetime(1970, 1, 1, tzinfo=None)


def to_naive_timestamp(value):
    """
    Convert a time zone aware datetime to a POSIX timestamp (with fractional
    component.)
    """
    return (value - epoch_naive).total_seconds()


def zerofill(data, start, end, rollup, orderby):
    rv = []
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]

    for key in six.moves.xrange(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            rv.append({"time": key})

    if "-time" in orderby:
        return list(reversed(rv))

    return rv


def get_snuba_column_name(name, dataset=Dataset.Events):
    """
    Get corresponding Snuba column name from Sentry snuba map, if not found
    the column is assumed to be a tag. If name is falsy or name is a quoted literal
    (e.g. "'name'"), leave unchanged.
    """
    no_conversion = set(["group_id", "project_id", "start", "end"])

    if name in no_conversion:
        return name

    if not name or QUOTED_LITERAL_RE.match(name):
        return name

    return DATASETS[dataset].get(name, u"tags[{}]".format(name))


def detect_dataset(query_args, aliased_conditions=False):
    """
    Determine the dataset to use based on the conditions, selected_columns,
    groupby clauses.

    This function operates on the end user field aliases and not the internal column
    names that have been converted using the field mappings.

    The aliased_conditions parameter switches column detection between
    the public aliases and the internal names. When query conditions
    have been pre-parsed by api.event_search set aliased_conditions=True
    as we need to look for internal names.

    :deprecated: This method and the automatic dataset resolution is deprecated.
    You should use sentry.snuba.discover instead.
    """
    if query_args.get("dataset", None):
        return query_args["dataset"]

    dataset = Dataset.Events
    transaction_fields = set(DATASETS[Dataset.Transactions].keys()) - set(
        DATASETS[Dataset.Events].keys()
    )
    condition_fieldset = transaction_fields

    if aliased_conditions:
        # Release and user are also excluded as they are present on both
        # datasets and don't trigger usage of transactions.
        condition_fieldset = (
            set(DATASET_FIELDS[Dataset.Transactions])
            - set(DATASET_FIELDS[Dataset.Events])
            - set(["release", "user"])
        )

    for condition in query_args.get("conditions") or []:
        if isinstance(condition[0], six.string_types) and condition[0] in condition_fieldset:
            return Dataset.Transactions
        if condition == ["event.type", "=", "transaction"] or condition == [
            "type",
            "=",
            "transaction",
        ]:
            return Dataset.Transactions

        if condition == ["event.type", "!=", "transaction"] or condition == [
            "type",
            "!=",
            "transaction",
        ]:
            return Dataset.Events

    for field in query_args.get("selected_columns") or []:
        if isinstance(field, six.string_types) and field in transaction_fields:
            return Dataset.Transactions

    for field in query_args.get("aggregations") or []:
        if len(field) != 3:
            continue
        # Check field or fields
        if isinstance(field[1], six.string_types) and field[1] in transaction_fields:
            return Dataset.Transactions
        if isinstance(field[1], (list, tuple)):
            is_transaction = [column for column in field[1] if column in transaction_fields]
            if is_transaction:
                return Dataset.Transactions
        # Check for transaction only field aliases
        if isinstance(field[2], six.string_types) and field[2] in (
            "apdex",
            "impact",
            "p75",
            "p95",
            "p99",
        ):
            return Dataset.Transactions

    for field in query_args.get("groupby") or []:
        if field in transaction_fields:
            return Dataset.Transactions

    return dataset


def get_function_index(column_expr, depth=0):
    """
    If column_expr list contains a function, returns the index of its function name
    within column_expr (and assumption is that index + 1 is the list of arguments),
    otherwise None.

     A function expression is of the form:
         [func, [arg1, arg2]]  => func(arg1, arg2)
     If a string argument is followed by list arg, the pair of them is assumed
    to be a nested function call, with extra args to the outer function afterward.
         [func1, [func2, [arg1, arg2], arg3]]  => func1(func2(arg1, arg2), arg3)
     Although at the top level, there is no outer function call, and the optional
    3rd argument is interpreted as an alias for the entire expression.
         [func, [arg1], alias] => function(arg1) AS alias
     You can also have a function part of an argument list:
         [func1, [arg1, func2, [arg2, arg3]]] => func1(arg1, func2(arg2, arg3))
     """
    index = None
    if isinstance(column_expr, (tuple, list)):
        i = 0
        while i < len(column_expr) - 1:
            # The assumption here is that a list that follows a string means
            # the string is a function name
            if isinstance(column_expr[i], six.string_types) and isinstance(
                column_expr[i + 1], (tuple, list)
            ):
                assert SAFE_FUNCTION_RE.match(column_expr[i])
                index = i
                break
            else:
                i = i + 1

        return index
    else:
        return None


def parse_columns_in_functions(col, context=None, index=None, dataset=Dataset.Events):
    """
    Checks expressions for arguments that should be considered a column while
    ignoring strings that represent clickhouse function names

    if col is a list, means the expression has functions and we need
    to parse for arguments that should be considered column names.

    Assumptions here:
     * strings that represent clickhouse function names are always followed by a list or tuple
     * strings that are quoted with single quotes are used as string literals for CH
     * otherwise we should attempt to get the snuba column name (or custom tag)
    """

    function_name_index = get_function_index(col)

    if function_name_index is not None:
        # if this is non zero, that means there are strings before this index
        # that should be converted to snuba column names
        # e.g. ['func1', ['column', 'func2', ['arg1']]]
        if function_name_index > 0:
            for i in six.moves.xrange(0, function_name_index):
                if context is not None:
                    context[i] = get_snuba_column_name(col[i], dataset)

        args = col[function_name_index + 1]

        # check for nested functions in args
        if get_function_index(args):
            # look for columns
            return parse_columns_in_functions(args, args, dataset=dataset)

        # check each argument for column names
        else:
            for (i, arg) in enumerate(args):
                parse_columns_in_functions(arg, args, i, dataset=dataset)
    else:
        # probably a column name
        if context is not None and index is not None:
            context[index] = get_snuba_column_name(col, dataset)


def get_arrayjoin(column):
    match = re.match(r"^(exception_stacks|exception_frames|contexts)\..+$", column)
    if match:
        return match.groups()[0]


def valid_orderby(orderby, custom_fields=None, dataset=Dataset.Events):
    """
    Check if a field can be used in sorting. We don't allow
    sorting on fields that would be aliased as tag[foo] because those
    fields are unlikely to be selected.
    """
    if custom_fields is None:
        custom_fields = []
    fields = orderby if isinstance(orderby, (list, tuple)) else [orderby]
    mapping = DATASETS[dataset]
    for field in fields:
        field = field.lstrip("-")
        if field not in mapping and field not in custom_fields:
            return False
    return True


def transform_aliases_and_query(**kwargs):
    """
    Convert aliases in selected_columns, groupby, aggregation, conditions,
    orderby and arrayjoin fields to their internal Snuba format and post the
    query to Snuba. Convert back translated aliases before returning snuba
    results.

    :deprecated: This method is deprecated. You should use sentry.snuba.discover instead.
    """

    arrayjoin_map = {"error": "exception_stacks", "stack": "exception_frames"}

    translated_columns = {}
    derived_columns = set()

    selected_columns = kwargs.get("selected_columns")
    groupby = kwargs.get("groupby")
    aggregations = kwargs.get("aggregations")
    conditions = kwargs.get("conditions")
    filter_keys = kwargs["filter_keys"]
    arrayjoin = kwargs.get("arrayjoin")
    orderby = kwargs.get("orderby")
    having = kwargs.get("having", [])
    dataset = detect_dataset(kwargs)

    if selected_columns:
        for (idx, col) in enumerate(selected_columns):
            if isinstance(col, list):
                # if list, means there are potentially nested functions and need to
                # iterate and translate potential columns
                parse_columns_in_functions(col)
                selected_columns[idx] = col
                translated_columns[col[2]] = col[2]
                derived_columns.add(col[2])
            else:
                name = get_snuba_column_name(col, dataset)
                selected_columns[idx] = name
                translated_columns[name] = col

    if groupby:
        for (idx, col) in enumerate(groupby):
            if col not in derived_columns:
                name = get_snuba_column_name(col, dataset)
            else:
                name = col

            groupby[idx] = name
            translated_columns[name] = col

    for aggregation in aggregations or []:
        derived_columns.add(aggregation[2])
        if isinstance(aggregation[1], six.string_types):
            aggregation[1] = get_snuba_column_name(aggregation[1], dataset)
        elif isinstance(aggregation[1], (set, tuple, list)):
            aggregation[1] = [get_snuba_column_name(col, dataset) for col in aggregation[1]]

    for col in filter_keys.keys():
        name = get_snuba_column_name(col, dataset)
        filter_keys[name] = filter_keys.pop(col)

    if conditions:
        aliased_conditions = []
        for condition in conditions:
            field = condition[0]
            if not isinstance(field, (list, tuple)) and field in derived_columns:
                having.append(condition)
            else:
                aliased_conditions.append(condition)
        kwargs["conditions"] = aliased_conditions

    if having:
        kwargs["having"] = having

    if orderby:
        orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
        translated_orderby = []

        for field_with_order in orderby:
            field = field_with_order.lstrip("-")
            translated_orderby.append(
                u"{}{}".format(
                    "-" if field_with_order.startswith("-") else "",
                    field if field in derived_columns else get_snuba_column_name(field, dataset),
                )
            )

        kwargs["orderby"] = translated_orderby

    kwargs["arrayjoin"] = arrayjoin_map.get(arrayjoin, arrayjoin)
    kwargs["dataset"] = dataset

    result = dataset_query(**kwargs)

    return transform_results(result, translated_columns, kwargs)


def transform_results(result, translated_columns, snuba_args):
    """
    Transform internal names back to the public schema ones.

    When getting timeseries results via rollup, this function will
    zerofill the output results.
    """
    # Translate back columns that were converted to snuba format
    for col in result["meta"]:
        col["name"] = translated_columns.get(col["name"], col["name"])

    def get_row(row):
        return {translated_columns.get(key, key): value for key, value in row.items()}

    if len(translated_columns):
        result["data"] = [get_row(row) for row in result["data"]]

    rollup = snuba_args.get("rollup")
    if rollup and rollup > 0:
        result["data"] = zerofill(
            result["data"], snuba_args["start"], snuba_args["end"], rollup, snuba_args["orderby"]
        )

    return result


def get_query_params_to_update_for_projects(query_params):
    """
    Get the project ID and query params that need to be updated for project
    based datasets, before we send the query to Snuba.
    """
    if "project_id" in query_params.filter_keys:
        # If we are given a set of project ids, use those directly.
        project_ids = list(set(query_params.filter_keys["project_id"]))
    elif query_params.filter_keys:
        # Otherwise infer the project_ids from any related models
        with timer("get_related_project_ids"):
            ids = [
                get_related_project_ids(k, query_params.filter_keys[k])
                for k in query_params.filter_keys
            ]
            project_ids = list(set.union(*map(set, ids)))
    else:
        project_ids = []

    if not project_ids:
        raise UnqualifiedQueryError(
            "No project_id filter, or none could be inferred from other filters."
        )

    # any project will do, as they should all be from the same organization
    organization_id = Project.objects.get(pk=project_ids[0]).organization_id

    return organization_id, {"project": project_ids}


def get_query_params_to_update_for_organizations(query_params):
    """
    Get the organization ID and query params that need to be updated for organization
    based datasets, before we send the query to Snuba.
    """
    if "org_id" in query_params.filter_keys:
        organization_ids = list(set(query_params.filter_keys["org_id"]))
        if len(organization_ids) != 1:
            raise UnqualifiedQueryError("Multiple organization_ids found. Only one allowed.")
        organization_id = organization_ids[0]
    elif "project_id" in query_params.filter_keys:
        organization_id, _ = get_query_params_to_update_for_projects(query_params)
    elif "key_id" in query_params.filter_keys:
        key_ids = list(set(query_params.filter_keys["key_id"]))
        project_key = ProjectKey.objects.get(pk=key_ids[0])
        organization_id = project_key.project.organization_id
    else:
        organization_id = None

    if not organization_id:
        raise UnqualifiedQueryError(
            "No organization_id filter, or none could be inferred from other filters."
        )

    return organization_id, {"organization": organization_id}


def _prepare_query_params(query_params):
    # convert to naive UTC datetimes, as Snuba only deals in UTC
    # and this avoids offset-naive and offset-aware issues
    start = naiveify_datetime(query_params.start)
    end = naiveify_datetime(query_params.end)

    with timer("get_snuba_map"):
        forward, reverse = get_snuba_translators(
            query_params.filter_keys, is_grouprelease=query_params.is_grouprelease
        )

    if query_params.dataset in [Dataset.Events, Dataset.Transactions, Dataset.Discover]:
        (organization_id, params_to_update) = get_query_params_to_update_for_projects(query_params)
    elif query_params.dataset in [Dataset.Outcomes, Dataset.OutcomesRaw]:
        (organization_id, params_to_update) = get_query_params_to_update_for_organizations(
            query_params
        )
    else:
        raise UnqualifiedQueryError(
            "No strategy found for getting an organization for the given dataset."
        )

    query_params.kwargs.update(params_to_update)

    for col, keys in six.iteritems(forward(deepcopy(query_params.filter_keys))):
        if keys:
            if len(keys) == 1 and None in keys:
                query_params.conditions.append((col, "IS NULL", None))
            else:
                query_params.conditions.append((col, "IN", keys))

    retention = quotas.get_event_retention(organization=Organization(organization_id))
    if retention:
        start = max(start, datetime.utcnow() - timedelta(days=retention))
        if start > end:
            raise QueryOutsideRetentionError

    # if `shrink_time_window` pushed `start` after `end` it means the user queried
    # a Group for T1 to T2 when the group was only active for T3 to T4, so the query
    # wouldn't return any results anyway
    new_start = shrink_time_window(query_params.filter_keys.get("group_id"), start)

    # TODO (alexh) this is a quick emergency fix for an occasion where a search
    # results in only 1 django candidate, which is then passed to snuba to
    # check and we raised because of it. Remove this once we figure out why the
    # candidate was returned from django at all if it existed only outside the
    # time range of the query
    if new_start <= end:
        start = new_start

    if start > end:
        raise QueryOutsideGroupActivityError

    query_params.kwargs.update(
        {
            "dataset": query_params.dataset.value,
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
            "groupby": query_params.groupby,
            "conditions": query_params.conditions,
            "aggregations": query_params.aggregations,
            "granularity": query_params.rollup,  # TODO name these things the same
        }
    )
    kwargs = {k: v for k, v in six.iteritems(query_params.kwargs) if v is not None}

    kwargs.update(OVERRIDE_OPTIONS)
    return kwargs, forward, reverse


class SnubaQueryParams(object):
    """
    Represents the information needed to make a query to Snuba.

    `start` and `end`: The beginning and end of the query time window (required)

    `groupby`: A list of column names to group by.

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

    The rest of the args are passed directly into the query JSON unmodified.
    See the snuba schema for details.
    """

    def __init__(
        self,
        dataset=None,
        start=None,
        end=None,
        groupby=None,
        conditions=None,
        filter_keys=None,
        aggregations=None,
        rollup=None,
        referrer=None,
        is_grouprelease=False,
        **kwargs
    ):
        # TODO: instead of having events be the default, make dataset required.
        self.dataset = dataset or Dataset.Events
        self.start = start or datetime.utcfromtimestamp(0)  # will be clamped to project retention
        self.end = end or datetime.utcnow() + timedelta(seconds=1)
        self.groupby = groupby or []
        self.conditions = conditions or []
        self.aggregations = aggregations or []
        self.filter_keys = filter_keys or {}
        self.rollup = rollup
        self.referrer = referrer
        self.is_grouprelease = is_grouprelease
        self.kwargs = kwargs


def raw_query(
    dataset=None,
    start=None,
    end=None,
    groupby=None,
    conditions=None,
    filter_keys=None,
    aggregations=None,
    rollup=None,
    referrer=None,
    is_grouprelease=False,
    **kwargs
):
    """
    Sends a query to snuba.  See `SnubaQueryParams` docstring for param
    descriptions.
    """
    snuba_params = SnubaQueryParams(
        dataset=dataset,
        start=start,
        end=end,
        groupby=groupby,
        conditions=conditions,
        filter_keys=filter_keys,
        aggregations=aggregations,
        rollup=rollup,
        is_grouprelease=is_grouprelease,
        **kwargs
    )
    return bulk_raw_query([snuba_params], referrer=referrer)[0]


def bulk_raw_query(snuba_param_list, referrer=None):
    headers = {}
    if referrer:
        headers["referer"] = referrer

    query_param_list = map(_prepare_query_params, snuba_param_list)

    def snuba_query(params):
        query_params, forward, reverse = params
        try:
            with timer("snuba_query"):
                return (
                    _snuba_pool.urlopen(
                        "POST", "/query", body=json.dumps(query_params), headers=headers
                    ),
                    forward,
                    reverse,
                )
        except urllib3.exceptions.HTTPError as err:
            raise SnubaError(err)

    if len(snuba_param_list) > 1:
        query_results = _query_thread_pool.map(snuba_query, query_param_list)
    else:
        # No need to submit to the thread pool if we're just performing a
        # single query
        query_results = [snuba_query(query_param_list[0])]

    results = []
    for response, _, reverse in query_results:
        try:
            body = json.loads(response.data)
        except ValueError:
            raise UnexpectedResponseError(
                u"Could not decode JSON response: {}".format(response.data)
            )

        if response.status != 200:
            if body.get("error"):
                error = body["error"]
                if response.status == 429:
                    raise RateLimitExceeded(error["message"])
                elif error["type"] == "schema":
                    raise SchemaValidationError(error["message"])
                elif error["type"] == "clickhouse":
                    raise clickhouse_error_codes_map.get(error["code"], QueryExecutionError)(
                        error["message"]
                    )
                else:
                    raise SnubaError(error["message"])
            else:
                raise SnubaError(u"HTTP {}".format(response.status))

        # Forward and reverse translation maps from model ids to snuba keys, per column
        body["data"] = [reverse(d) for d in body["data"]]
        results.append(body)

    return results


def query(
    dataset=None,
    start=None,
    end=None,
    groupby=None,
    conditions=None,
    filter_keys=None,
    aggregations=None,
    selected_columns=None,
    totals=None,
    **kwargs
):

    aggregations = aggregations or [["count()", "", "aggregate"]]
    filter_keys = filter_keys or {}
    selected_columns = selected_columns or []
    groupby = groupby or []

    try:
        body = raw_query(
            dataset=dataset,
            start=start,
            end=end,
            groupby=groupby,
            conditions=conditions,
            filter_keys=filter_keys,
            aggregations=aggregations,
            selected_columns=selected_columns,
            totals=totals,
            **kwargs
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
    got_cols = set(c["name"] for c in body["meta"])

    assert expected_cols == got_cols, "expected {}, got {}".format(expected_cols, got_cols)

    with timer("process_result"):
        if totals:
            return (
                nest_groups(body["data"], groupby, aggregate_names + selected_names),
                body["totals"],
            )
        else:
            return nest_groups(body["data"], groupby, aggregate_names + selected_names)


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


def constrain_column_to_dataset(col, dataset, value=None):
    """
    Ensure conditions only reference valid columns on the provided
    dataset. Return none for conditions to be removed, and convert
    unknown columns into tags expressions.

    :deprecated: This method and the automatic dataset resolution is deprecated.
    You should use sentry.snuba.discover instead.
    """
    if col.startswith("tags["):
        return col

    # Special case for the type condition as we only want
    # to drop it when we are querying transactions.
    if dataset == Dataset.Transactions and col == "event.type" and value == "transaction":
        return None
    if not col or QUOTED_LITERAL_RE.match(col):
        return col
    if col in DATASETS[dataset]:
        return DATASETS[dataset][col]
    if col in DATASET_FIELDS[dataset]:
        return col

    return u"tags[{}]".format(col)


def constrain_condition_to_dataset(cond, dataset):
    """
    When conditions have been parsed by the api.event_search module
    we can end up with conditions that are not valid on the current dataset
    due to how ap.event_search checks for valid field names without
    being aware of the dataset.

    We have the dataset context here, so we need to re-scope conditions to the
    current dataset.

    :deprecated: This method and the automatic dataset resolution is deprecated.
    You should use sentry.snuba.discover instead.
    """
    index = get_function_index(cond)
    if index is not None:
        # IN conditions are detected as a function but aren't really.
        if cond[index] == "IN":
            cond[0] = constrain_column_to_dataset(cond[0], dataset)
            return cond

        func_args = cond[index + 1]
        for (i, arg) in enumerate(func_args):
            # Nested function
            if isinstance(arg, (list, tuple)):
                func_args[i] = constrain_condition_to_dataset(arg, dataset)
            else:
                func_args[i] = constrain_column_to_dataset(arg, dataset)
        cond[index + 1] = func_args
        return cond

    # No function name found
    if isinstance(cond, (list, tuple)) and len(cond):
        # Condition is [col, operator, value]
        if isinstance(cond[0], six.string_types) and len(cond) == 3:
            # Map column name to current dataset removing
            # invalid conditions based on the dataset.
            name = constrain_column_to_dataset(cond[0], dataset, cond[2])
            if name is None:
                return None
            cond[0] = name
            return cond
        if isinstance(cond[0], (list, tuple)):
            if get_function_index(cond[0]) is not None:
                cond[0] = constrain_condition_to_dataset(cond[0], dataset)
                return cond
            else:
                # Nested conditions
                return [constrain_condition_to_dataset(item, dataset) for item in cond]
    raise ValueError("Unexpected condition format %s" % cond)


def dataset_query(
    start=None,
    end=None,
    groupby=None,
    conditions=None,
    filter_keys=None,
    aggregations=None,
    selected_columns=None,
    arrayjoin=None,
    having=None,
    dataset=None,
    orderby=None,
    **kwargs
):
    """
    Wrapper around raw_query that selects the dataset based on the
    selected_columns, conditions and groupby parameters.
    Useful for taking arbitrary end user queries and searching
    either error or transaction events.

    This function will also re-alias columns to match the selected dataset

    :deprecated: This method and the automatic dataset resolution is deprecated.
    You should use sentry.snuba.discover instead.
    """
    if dataset is None:
        dataset = detect_dataset(
            dict(
                dataset=dataset,
                aggregations=aggregations,
                conditions=conditions,
                selected_columns=selected_columns,
                groupby=groupby,
            )
        )

    derived_columns = []
    if selected_columns:
        for (i, col) in enumerate(selected_columns):
            if isinstance(col, (list, tuple)):
                derived_columns.append(col[2])
            else:
                selected_columns[i] = constrain_column_to_dataset(col, dataset)
        selected_columns = list(filter(None, selected_columns))

    if aggregations:
        for aggregation in aggregations:
            derived_columns.append(aggregation[2])

    if conditions:
        for (i, condition) in enumerate(conditions):
            replacement = constrain_condition_to_dataset(condition, dataset)
            conditions[i] = replacement
        conditions = list(filter(None, conditions))

    if orderby:
        # Don't mutate in case we have a default order passed.
        updated_order = []
        for (i, order) in enumerate(orderby):
            order_field = order.lstrip("-")
            if order_field not in derived_columns:
                order_field = constrain_column_to_dataset(order_field, dataset)
            updated_order.append(u"{}{}".format("-" if order.startswith("-") else "", order_field))
        orderby = updated_order

    return raw_query(
        start=start,
        end=end,
        groupby=groupby,
        conditions=conditions,
        aggregations=aggregations,
        selected_columns=selected_columns,
        filter_keys=filter_keys,
        arrayjoin=arrayjoin,
        having=having,
        dataset=dataset,
        orderby=orderby,
        **kwargs
    )


JSON_TYPE_MAP = {
    "UInt8": "boolean",
    "UInt16": "integer",
    "UInt32": "integer",
    "UInt64": "integer",
    "Float32": "number",
    "Float64": "number",
    "DateTime": "date",
}


def get_json_type(snuba_type):
    """
    Convert Snuba/Clickhouse type to JSON type
    Default is string
    """
    # Ignore Nullable part
    nullable_match = re.search(r"^Nullable\((.+)\)$", snuba_type)

    if nullable_match:
        snuba_type = nullable_match.group(1)

    # Check for array
    array_match = re.search(r"^Array\(.+\)$", snuba_type)
    if array_match:
        return "array"

    return JSON_TYPE_MAP.get(snuba_type, "string")


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
    identity = lambda x: x
    compose = lambda f, g: lambda x: f(g(x))
    replace = lambda d, key, val: d.update({key: val}) or d

    forward = identity
    reverse = identity

    map_columns = {
        "environment": (Environment, "name", lambda name: None if name == "" else name),
        "tags[sentry:release]": (Release, "version", identity),
        "release": (Release, "version", identity),
    }

    for col, (model, field, fmt) in six.iteritems(map_columns):
        fwd, rev = None, None
        ids = filter_keys.get(col)
        if not ids:
            continue
        if is_grouprelease and col in ("release", "tags[sentry:release]"):
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
            ver = dict(
                Release.objects.filter(id__in=[x[2] for x in gr_map]).values_list("id", "version")
            )
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
                    row,
                    col,
                    trans.get((row["group_id"], row[col])),
                )
            )(col, rev_map)

        else:
            fwd_map = {
                k: fmt(v) for k, v in model.objects.filter(id__in=ids).values_list("id", field)
            }
            rev_map = dict(reversed(t) for t in six.iteritems(fwd_map))
            fwd = (
                lambda col, trans: lambda filters: replace(
                    filters, col, [trans[k] for k in filters[col] if k]
                )
            )(col, fwd_map)
            rev = (
                lambda col, trans: lambda row: replace(row, col, trans[row[col]])
                if col in row
                else row
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
    # Extra reverse translator for bucketed_end column.
    reverse = compose(
        reverse,
        lambda row: replace(
            row, "bucketed_end", int(to_timestamp(parse_datetime(row["bucketed_end"])))
        )
        if "bucketed_end" in row
        else row,
    )

    return (forward, reverse)


def get_related_project_ids(column, ids):
    """
    Get the project_ids from a model that has a foreign key to project.
    """
    mappings = {
        "group_id": (Group, "id", "project_id"),
        "tags[sentry:release]": (ReleaseProject, "release_id", "project_id"),
        "release": (ReleaseProject, "release_id", "project_id"),
    }
    if ids:
        if column == "project_id":
            return ids
        elif column in mappings:
            model, id_field, project_field = mappings[column]
            return model.objects.filter(
                **{id_field + "__in": ids, project_field + "__isnull": False}
            ).values_list(project_field, flat=True)
    return []


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
