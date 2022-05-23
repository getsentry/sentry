from collections import OrderedDict
from datetime import timedelta
from functools import partial

from snuba_sdk import Request
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Limit, Query

from sentry.api.serializers.snuba import zerofill
from sentry.app import tsdb
from sentry.constants import DataCategory
from sentry.snuba.dataset import Dataset
from sentry.tasks.reports.utils.constants import ONE_DAY
from sentry.tasks.reports.utils.merge import merge_series
from sentry.tasks.reports.utils.util import clean_series
from sentry.utils.compat import map
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime, raw_snql_query


def build_project_series(start__stop, project):
    start, stop = start__stop
    rollup = ONE_DAY

    resolution, series = tsdb.get_optimal_rollup_series(start, stop, rollup)
    assert resolution == rollup, "resolution does not match requested value"

    clean = partial(clean_series, start, stop, rollup)

    def zerofill_clean(data):
        return clean(zerofill(data, start, stop, rollup, fill_default=0))

    # Use outcomes to compute total errors and transactions
    outcomes_query = Query(
        match=Entity("outcomes"),
        select=[
            Column("time"),
            Column("category"),
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, stop + timedelta(days=1)),
            Condition(Column("project_id"), Op.EQ, project.id),
            Condition(Column("org_id"), Op.EQ, project.organization_id),
            Condition(Column("outcome"), Op.EQ, Outcome.ACCEPTED),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories(), DataCategory.TRANSACTION],
            ),
        ],
        groupby=[Column("time"), Column("category")],
        granularity=Granularity(rollup),
        orderby=[OrderBy(Column("time"), Direction.ASC)],
    )
    request = Request(dataset=Dataset.Outcomes.value, app_id="reports", query=outcomes_query)
    outcome_series = raw_snql_query(request, referrer="reports.outcome_series")
    total_error_series = OrderedDict()
    for v in outcome_series["data"]:
        if v["category"] in DataCategory.error_categories():
            timestamp = int(to_timestamp(parse_snuba_datetime(v["time"])))
            total_error_series[timestamp] = total_error_series.get(timestamp, 0) + v["total"]

    total_error_series = zerofill_clean(list(total_error_series.items()))
    transaction_series = [
        (int(to_timestamp(parse_snuba_datetime(v["time"]))), v["total"])
        for v in outcome_series["data"]
        if v["category"] == DataCategory.TRANSACTION
    ]
    transaction_series = zerofill_clean(transaction_series)

    # Format of this series: [(errors, transactions)]
    return merge_series(
        total_error_series, transaction_series, lambda errors, transactions: (errors, transactions)
    )


def build_project_usage_outcomes(start__stop, project):
    start, stop = start__stop

    # XXX(epurkhiser): Tsdb used to use day buckets, where the end would
    # represent a whole day. Snuba queries more accurately thus we must
    # capture the entire last day
    end = stop + timedelta(days=1)

    query = Query(
        match=Entity("outcomes"),
        select=[
            Column("outcome"),
            Column("category"),
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.EQ, project.id),
            Condition(Column("org_id"), Op.EQ, project.organization_id),
            Condition(
                Column("outcome"), Op.IN, [Outcome.ACCEPTED, Outcome.FILTERED, Outcome.RATE_LIMITED]
            ),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories(), DataCategory.TRANSACTION],
            ),
        ],
        groupby=[Column("outcome"), Column("category")],
        granularity=Granularity(ONE_DAY),
    )
    request = Request(dataset=Dataset.Outcomes.value, app_id="reports", query=query)
    data = raw_snql_query(request, referrer="reports.outcomes")["data"]

    return (
        # Accepted errors
        sum(
            row["total"]
            for row in data
            if row["category"] in DataCategory.error_categories()
            and row["outcome"] == Outcome.ACCEPTED
        ),
        # Dropped errors
        sum(
            row["total"]
            for row in data
            if row["category"] in DataCategory.error_categories()
            and row["outcome"] == Outcome.RATE_LIMITED
        ),
        # accepted transactions
        sum(
            row["total"]
            for row in data
            if row["category"] == DataCategory.TRANSACTION and row["outcome"] == Outcome.ACCEPTED
        ),
        # Dropped transactions
        sum(
            row["total"]
            for row in data
            if row["category"] == DataCategory.TRANSACTION
            and row["outcome"] == Outcome.RATE_LIMITED
        ),
    )


def build_key_errors(interval, project):
    start, stop = interval

    # Take the 3 most frequently occuring events
    query = Query(
        match=Entity("events"),
        select=[Column("group_id"), Function("count", [])],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, stop + timedelta(days=1)),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        groupby=[Column("group_id")],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(3),
    )
    request = Request(dataset=Dataset.Events.value, app_id="reports", query=query)
    query_result = raw_snql_query(request, referrer="reports.key_errors")
    key_errors = query_result["data"]
    return [(e["group_id"], e["count()"]) for e in key_errors]


def build_key_transactions(interval, project):
    start, stop = interval

    # Take the 3 most frequently occuring transactions
    query = Query(
        match=Entity("transactions"),
        select=[
            Column("transaction_name"),
            Function("count", []),
        ],
        where=[
            Condition(Column("finish_ts"), Op.GTE, start),
            Condition(Column("finish_ts"), Op.LT, stop + timedelta(days=1)),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        groupby=[Column("transaction_name")],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(3),
    )
    request = Request(dataset=Dataset.Transactions.value, app_id="reports", query=query)
    query_result = raw_snql_query(request, referrer="reports.key_transactions")
    key_errors = query_result["data"]

    transaction_names = map(lambda p: p["transaction_name"], key_errors)

    def query_p95(interval):
        start, stop = interval
        query = Query(
            match=Entity("transactions"),
            select=[
                Column("transaction_name"),
                Function("quantile(0.95)", [Column("duration")], "p95"),
            ],
            where=[
                Condition(Column("finish_ts"), Op.GTE, start),
                Condition(Column("finish_ts"), Op.LT, stop + timedelta(days=1)),
                Condition(Column("transaction_name"), Op.IN, transaction_names),
                Condition(Column("project_id"), Op.EQ, project.id),
            ],
            groupby=[Column("transaction_name")],
        )
        request = Request(dataset=Dataset.Transactions.value, app_id="reports", query=query)
        return raw_snql_query(request, referrer="reports.key_transactions.p95")

    query_result = query_p95((start, stop))
    this_week_p95 = {}
    for point in query_result["data"]:
        this_week_p95[point["transaction_name"]] = point["p95"]

    query_result = query_p95((start - timedelta(days=7), stop - timedelta(days=7)))
    last_week_p95 = {}
    for point in query_result["data"]:
        last_week_p95[point["transaction_name"]] = point["p95"]

    return [
        (
            e["transaction_name"],
            e["count()"],
            project.id,
            this_week_p95.get(e["transaction_name"], None),
            last_week_p95.get(e["transaction_name"], None),
        )
        for e in key_errors
    ]
