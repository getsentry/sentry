import bisect
import logging
import math
import operator
import zlib
from calendar import Calendar
from collections import OrderedDict, namedtuple
from datetime import datetime, timedelta
from functools import partial, reduce
from itertools import zip_longest
from typing import Iterable, Mapping, NamedTuple, Tuple

import pytz
from django.urls.base import reverse
from django.utils import dateformat, timezone
from django.utils.http import urlencode
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.query import Query

from sentry import features
from sentry.app import tsdb
from sentry.constants import DataCategory
from sentry.models import (
    Activity,
    GroupStatus,
    Organization,
    OrganizationStatus,
    Project,
    Team,
    User,
    UserOption,
)
from sentry.snuba.dataset import Dataset
from sentry.tasks.base import instrumented_task
from sentry.utils import json, redis
from sentry.utils.compat import filter, map, zip
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.iterators import chunked
from sentry.utils.math import mean
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

date_format = partial(dateformat.format, format_string="F jS, Y")

logger = logging.getLogger(__name__)

BATCH_SIZE = 20000

ONE_DAY = int(timedelta(days=1).total_seconds())

project_breakdown_colors = ["#422C6E", "#895289", "#D6567F", "#F38150", "#F2B713"]

calendar_heat_colors = [
    "#fae5cf",
    "#f9ddc2",
    "#f9d6b6",
    "#f9cfaa",
    "#f8c79e",
    "#f8bf92",
    "#f8b786",
    "#f9a66d",
    "#f99d60",
    "#fa9453",
    "#fb8034",
    "#fc7520",
    "#f9600c",
    "#f75500",
]


total_color = """
linear-gradient(
    -45deg,
    #ccc 25%,
    transparent 25%,
    transparent 50%,
    #ccc 50%,
    #ccc 75%,
    transparent 75%,
    transparent
);
"""


def _get_organization_queryset():
    return Organization.objects.filter(status=OrganizationStatus.VISIBLE)


def _fill_default_parameters(timestamp=None, rollup=None):
    if timestamp is None:
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

    if rollup is None:
        rollup = ONE_DAY * 7

    return (timestamp, rollup)


def _to_interval(timestamp, duration):
    return (to_datetime(timestamp - duration), to_datetime(timestamp))


def change(value, reference):
    """
    Calculate the relative change between a value and a reference point.
    """
    if not reference:  # handle both None and divide by zero case
        return None

    return ((value or 0) - reference) / float(reference)


def safe_add(x, y):
    """
    Adds two values which are either numeric types or None.

    - If both values are numeric, the result is the sum of those values.
    - If only one numeric value is provided, that value is returned.
    - If both values are None, then None is returned.
    """
    if x is not None and y is not None:
        return x + y
    elif x is not None:
        return x
    elif y is not None:
        return y
    else:
        return None


def month_to_index(year, month):
    """
    Convert a year and month to a single value: the number of months between
    this month and 1 AD.

    This mainly exists to simplify doing month-based arithmetic (e.g. "three
    months ago") without having to manually handle wrapping around years, since
    timedelta doesn't accept a "months" parameter.
    """
    assert 12 >= month >= 1
    return (year - 1) * 12 + month - 1


def index_to_month(index):
    """
    The opposite companion to ``month_to_index``. Returns a (year, month)
    tuple.
    """
    return (index // 12) + 1, index % 12 + 1


def clean_series(start: datetime, stop: datetime, rollup: int, series: Iterable[Tuple[int, int]]):
    """
    Validate a series, ensuring that it follows the specified rollup and
    boundaries. The start bound is inclusive, while the stop bound is
    exclusive (similar to the slice operation.)
    """
    start_timestamp = to_timestamp(start)
    stop_timestamp = to_timestamp(stop)

    result = []
    for i, (timestamp, value) in enumerate(series):
        assert timestamp == start_timestamp + rollup * i
        if timestamp >= stop_timestamp:
            break

        result.append((timestamp, value))

    return result


def merge_sequences(target, other, function=operator.add):
    """
    Merge two sequences into a single sequence. The length of the two
    sequences must be equal.
    """
    assert len(target) == len(other), "sequence lengths must match"

    rt_type = type(target)
    if rt_type == range:
        rt_type = list

    return rt_type([function(x, y) for x, y in zip(target, other)])


def merge_mappings(target, other, function=operator.add):
    """
    Merge two mappings into a single mapping. The set of keys in both
    mappings must be equal.
    """
    assert set(target) == set(other), "keys must match"
    return {k: function(v, other[k]) for k, v in target.items()}


def merge_series(target, other, function=operator.add):
    """
    Merge two series into a single series. Both series must have the same
    start and end points as well as the same resolution.
    """
    missing = object()
    results = []
    for x, y in zip_longest(target, other, fillvalue=missing):
        assert x is not missing and y is not missing, "series must be same length"
        assert x[0] == y[0], "series timestamps must match"
        results.append((x[0], function(x[1], y[1])))
    return results


def _query_tsdb_groups_chunked(func, issue_ids, start, stop, rollup):
    combined = {}

    for chunk in chunked(issue_ids, BATCH_SIZE):
        combined.update(func(tsdb.models.group, chunk, start, stop, rollup=rollup))

    return combined


def build_project_series(start__stop, project):
    start, stop = start__stop
    rollup = ONE_DAY

    resolution, series = tsdb.get_optimal_rollup_series(start, stop, rollup)
    assert resolution == rollup, "resolution does not match requested value"

    clean = partial(clean_series, start, stop, rollup)
    issue_ids = project.group_set.filter(
        status=GroupStatus.RESOLVED, resolved_at__gte=start, resolved_at__lt=stop
    ).values_list("id", flat=True)

    tsdb_range_resolved = _query_tsdb_groups_chunked(tsdb.get_range, issue_ids, start, stop, rollup)
    resolved_series = reduce(
        merge_series,
        map(clean, tsdb_range_resolved.values()),
        clean([(timestamp, 0) for timestamp in series]),
    )

    total_series = clean(
        tsdb.get_range(tsdb.models.project, [project.id], start, stop, rollup=rollup)[project.id]
    )

    return merge_series(
        resolved_series,
        total_series,
        lambda resolved, total: (resolved, total - resolved),  # unresolved
    )


def build_project_aggregates(ignore__stop, project):
    # TODO: This needs to return ``None`` for periods that don't have any data
    # (because the project is not old enough) and possibly extrapolate for
    # periods that only have partial periods.
    _, stop = ignore__stop
    segments = 4
    period = timedelta(days=7)
    start = stop - (period * segments)

    def get_aggregate_value(start, stop):
        return tsdb.get_sums(tsdb.models.project, (project.id,), start, stop, rollup=ONE_DAY)[
            project.id
        ]

    return [
        get_aggregate_value(start + (period * i), start + (period * (i + 1) - timedelta(seconds=1)))
        for i in range(segments)
    ]


def build_project_issue_summaries(interval, project):
    start, stop = interval

    queryset = project.group_set.exclude(status=GroupStatus.IGNORED)

    # Fetch all new issues.
    new_issue_ids = set(
        queryset.filter(first_seen__gte=start, first_seen__lt=stop).values_list("id", flat=True)
    )

    # Fetch all regressions. This is a little weird, since there's no way to
    # tell *when* a group regressed using the Group model. Instead, we query
    # all groups that have been seen in the last week and have ever regressed
    # and query the Activity model to find out if they regressed within the
    # past week. (In theory, the activity table *could* be used to answer this
    # query without the subselect, but there's no suitable indexes to make it's
    # performance predictable.)
    reopened_issue_ids = set(
        Activity.objects.filter(
            group__in=queryset.filter(
                last_seen__gte=start,
                last_seen__lt=stop,
                resolved_at__isnull=False,  # signals this has *ever* been resolved
            ),
            type__in=(Activity.SET_REGRESSION, Activity.SET_UNRESOLVED),
            datetime__gte=start,
            datetime__lt=stop,
        )
        .distinct()
        .values_list("group_id", flat=True)
    )

    rollup = ONE_DAY
    event_counts = _query_tsdb_groups_chunked(
        tsdb.get_sums, new_issue_ids | reopened_issue_ids, start, stop, rollup
    )

    new_issue_count = sum(event_counts[id] for id in new_issue_ids)
    reopened_issue_count = sum(event_counts[id] for id in reopened_issue_ids)
    existing_issue_count = max(
        tsdb.get_sums(tsdb.models.project, [project.id], start, stop, rollup=rollup)[project.id]
        - new_issue_count
        - reopened_issue_count,
        0,
    )

    return [new_issue_count, reopened_issue_count, existing_issue_count]


def build_project_usage_outcomes(start__stop, project):
    start, stop = start__stop

    # XXX(epurkhiser): Tsdb used to use day buckets, where the end would
    # represent a whole day. Snuba queries more accurately thus we must
    # capture the entire last day
    end = stop + timedelta(days=1)

    query = Query(
        dataset=Dataset.Outcomes.value,
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
    data = raw_snql_query(query, referrer="reports.outcomes")["data"]

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


def get_calendar_range(ignore__stop_time, months):
    _, stop_time = ignore__stop_time
    assert (
        stop_time.hour,
        stop_time.minute,
        stop_time.second,
        stop_time.microsecond,
        stop_time.tzinfo,
    ) == (0, 0, 0, 0, pytz.utc)

    last_day = stop_time - timedelta(days=1)

    stop_month_index = month_to_index(last_day.year, last_day.month)

    start_month_index = stop_month_index - months + 1
    return start_month_index, stop_month_index


def get_calendar_query_range(interval, months):
    start_month_index, _ = get_calendar_range(interval, months)

    start_time = datetime(day=1, tzinfo=pytz.utc, *index_to_month(start_month_index))

    return start_time, interval[1]


def clean_calendar_data(project, series, start, stop, rollup, timestamp=None):
    earliest = tsdb.get_earliest_timestamp(rollup, timestamp=timestamp)

    def remove_invalid_values(item):
        timestamp, value = item
        if timestamp < earliest:
            value = None
        elif to_datetime(timestamp) < project.date_added:
            value = None
        return (timestamp, value)

    return map(remove_invalid_values, clean_series(start, stop, rollup, series))


def build_project_calendar_series(interval, project):
    start, stop = get_calendar_query_range(interval, 3)

    rollup = ONE_DAY
    series = tsdb.get_range(tsdb.models.project, [project.id], start, stop, rollup=rollup)[
        project.id
    ]

    return clean_calendar_data(project, series, start, stop, rollup)


def build_report(fields):
    """
    Constructs the Report namedtuple class, as well as the `prepare` and
    `merge` functions for creating the Report object.

    Each field is a tuple of the (field name, builder fn, merge fn).

    The merge function is used to merge the value of that field together for
    multiple reports.
    """
    names, field_builders, field_mergers = zip(*fields)

    cls = namedtuple("Report", names)

    def prepare(*args):
        return cls(*[f(*args) for f in field_builders])

    def merge(target, other):
        return cls(*[f(target[i], other[i]) for i, f in enumerate(field_mergers)])

    return cls, prepare, merge


Report, build_project_report, merge_reports = build_report(
    [
        (
            "series",
            build_project_series,
            partial(merge_series, function=merge_sequences),
        ),
        (
            "aggregates",
            build_project_aggregates,
            partial(merge_sequences, function=safe_add),
        ),
        ("issue_summaries", build_project_issue_summaries, merge_sequences),
        ("series_outcomes", build_project_usage_outcomes, merge_sequences),
        (
            "calendar_series",
            build_project_calendar_series,
            partial(merge_series, function=safe_add),
        ),
    ],
)


class ReportBackend:
    def build(self, timestamp, duration, project):
        """
        Constructs the report for a project.
        """
        return build_project_report(_to_interval(timestamp, duration), project)

    def prepare(self, timestamp, duration, organization):
        """
        Build and store reports for all projects in an organization.
        """
        raise NotImplementedError

    def fetch(self, timestamp, duration, organization, projects):
        """
        Fetch reports for a set of projects in the organization, returning
        reports in the order that they were requested.
        """
        raise NotImplementedError


class DummyReportBackend(ReportBackend):
    def prepare(self, timestamp, duration, organization):
        pass

    def fetch(self, timestamp, duration, organization, projects):
        assert all(project.organization_id == organization.id for project in projects)
        return map(partial(self.build, timestamp, duration), projects)


class RedisReportBackend(ReportBackend):
    version = 1

    def __init__(self, cluster, ttl, namespace="r"):
        self.cluster = cluster
        self.ttl = ttl
        self.namespace = namespace

    def __make_key(self, timestamp, duration, organization):
        return "{}:{}:{}:{}:{}".format(
            self.namespace, self.version, organization.id, int(timestamp), int(duration)
        )

    def __encode(self, report):
        return zlib.compress(json.dumps(list(report)).encode("utf-8"))

    def __decode(self, value):
        if value is None:
            return None

        return Report(*json.loads(zlib.decompress(value)))

    def prepare(self, timestamp, duration, organization):
        reports = {}
        for project in organization.project_set.all():
            reports[project.id] = self.__encode(self.build(timestamp, duration, project))

        if not reports:
            # XXX: HMSET requires at least one key/value pair, so we need to
            # protect ourselves here against organizations that were created
            # but haven't set up any projects yet.
            return

        with self.cluster.map() as client:
            key = self.__make_key(timestamp, duration, organization)
            client.hmset(key, reports)
            client.expire(key, self.ttl)

    def fetch(self, timestamp, duration, organization, projects):
        with self.cluster.map() as client:
            result = client.hmget(
                self.__make_key(timestamp, duration, organization),
                [project.id for project in projects],
            )

        return map(self.__decode, result.value)


backend = RedisReportBackend(redis.clusters.get("default"), 60 * 60 * 3)


@instrumented_task(name="sentry.tasks.reports.prepare_reports", queue="reports.prepare")
def prepare_reports(dry_run=False, *args, **kwargs):
    timestamp, duration = _fill_default_parameters(*args, **kwargs)

    organization_ids = _get_organization_queryset().values_list("id", flat=True)
    for organization_id in organization_ids:
        prepare_organization_report.delay(timestamp, duration, organization_id, dry_run=dry_run)


@instrumented_task(name="sentry.tasks.reports.prepare_organization_report", queue="reports.prepare")
def prepare_organization_report(timestamp, duration, organization_id, dry_run=False):
    try:
        organization = _get_organization_queryset().get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "reports.organization.missing",
            extra={
                "timestamp": timestamp,
                "duration": duration,
                "organization_id": organization_id,
            },
        )
        return

    backend.prepare(timestamp, duration, organization)

    # If an OrganizationMember row doesn't have an associated user, this is
    # actually a pending invitation, so no report should be delivered.
    member_set = organization.member_set.filter(user_id__isnull=False, user__is_active=True)

    for user_id in member_set.values_list("user_id", flat=True):
        deliver_organization_user_report.delay(
            timestamp, duration, organization_id, user_id, dry_run=dry_run
        )


def fetch_personal_statistics(start__stop, organization, user):
    start, stop = start__stop
    resolved_issue_ids = set(
        Activity.objects.filter(
            project__organization_id=organization.id,
            user_id=user.id,
            type__in=(Activity.SET_RESOLVED, Activity.SET_RESOLVED_IN_RELEASE),
            datetime__gte=start,
            datetime__lt=stop,
            group__status=GroupStatus.RESOLVED,  # only count if the issue is still resolved
        )
        .distinct()
        .values_list("group_id", flat=True)
    )

    if resolved_issue_ids:
        users = tsdb.get_distinct_counts_union(
            tsdb.models.users_affected_by_group, resolved_issue_ids, start, stop, ONE_DAY
        )
    else:
        users = {}

    return {"resolved": len(resolved_issue_ids), "users": users}


class Duration(NamedTuple):
    adjective: str  # e.g. "daily" or "weekly",
    noun: str  # relative to today, e.g. "yesterday" or "this week"
    date_format: str  # date format used for large series x axis labeling


durations = {(ONE_DAY * 7): Duration("weekly", "this week", "D")}


def build_message(timestamp, duration, organization, user, reports):
    start, stop = interval = _to_interval(timestamp, duration)

    duration_spec = durations[duration]
    message = MessageBuilder(
        subject="{} Report for {}: {} - {}".format(
            duration_spec.adjective.title(),
            organization.name,
            date_format(start),
            date_format(stop),
        ),
        template="sentry/emails/reports/body.txt",
        html_template="sentry/emails/reports/body.html",
        type="report.organization",
        context={
            "duration": duration_spec,
            "interval": {"start": date_format(start), "stop": date_format(stop)},
            "organization": organization,
            "personal": fetch_personal_statistics(interval, organization, user),
            "report": to_context(organization, interval, reports),
            "user": user,
        },
        headers={"X-SMTPAPI": json.dumps({"category": "organization_report_email"})},
    )

    message.add_users((user.id,))

    return message


DISABLED_ORGANIZATIONS_USER_OPTION_KEY = "reports:disabled-organizations"


def user_subscribed_to_organization_reports(user, organization):
    return organization.id not in UserOption.objects.get_value(
        user=user, key=DISABLED_ORGANIZATIONS_USER_OPTION_KEY, default=[]
    )


class Skipped:
    NotSubscribed = object()
    NoProjects = object()
    NoReports = object()


def has_valid_aggregates(interval, project__report):
    project, report = project__report
    return any(bool(value) for value in report.aggregates)


@instrumented_task(
    name="sentry.tasks.reports.deliver_organization_user_report", queue="reports.deliver"
)
def deliver_organization_user_report(timestamp, duration, organization_id, user_id, dry_run=False):
    try:
        organization = _get_organization_queryset().get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "reports.organization.missing",
            extra={
                "timestamp": timestamp,
                "duration": duration,
                "organization_id": organization_id,
            },
        )
        return

    user = User.objects.get(id=user_id)

    if not user_subscribed_to_organization_reports(user, organization):
        logger.debug(
            "Skipping report for %r to %r, user is not subscribed to reports.", organization, user
        )
        return Skipped.NotSubscribed

    projects = set()
    for team in Team.objects.get_for_user(organization, user):
        projects.update(Project.objects.get_for_user(team, user, _skip_team_check=True))

    if not projects:
        logger.debug(
            "Skipping report for %r to %r, user is not associated with any projects.",
            organization,
            user,
        )
        return Skipped.NoProjects

    interval = _to_interval(timestamp, duration)
    projects = list(projects)

    inclusion_predicates = [
        lambda interval, project__report: project__report[1] is not None,
        has_valid_aggregates,
    ]

    reports = dict(
        filter(
            lambda item: all(predicate(interval, item) for predicate in inclusion_predicates),
            zip(projects, backend.fetch(timestamp, duration, organization, projects)),
        )
    )

    if not reports:
        logger.debug(
            "Skipping report for %r to %r, no qualifying reports to deliver.", organization, user
        )
        return Skipped.NoReports

    message = build_message(timestamp, duration, organization, user, reports)

    if not dry_run:
        message.send()


def series_map(function, series):
    return [(timestamp, function(value)) for timestamp, value in series]


class Key(NamedTuple):
    label: str
    url: str
    color: str
    data: Mapping[str, int]


class Point(NamedTuple):
    resolved: int
    unresolved: int


class DistributionType(NamedTuple):
    label: str
    color: str


def build_project_breakdown_series(reports):
    def get_legend_data(report):
        (
            accepted_errors,
            dropped_errors,
            accepted_transactions,
            dropped_transactions,
        ) = report.series_outcomes

        return {
            "accepted_errors": accepted_errors,
            "dropped_errors": dropped_errors,
            "accepted_transactions": accepted_transactions,
            "dropped_transactions": dropped_transactions,
        }

    # Find the reports with the most total events. Note that reports are keyed
    # on project, so this returns the list of Projects, which map to reports
    all_projects = [
        v[0]
        for v in sorted(
            reports.items(),
            key=lambda project__report: sum(
                sum(resolved__unresolved) for _, resolved__unresolved in project__report[1].series
            ),
            reverse=True,
        )
    ]

    # The number of reports to keep is the same as the number of colors
    # available to use in the legend.
    projects = all_projects[: len(project_breakdown_colors)]

    # Starting building the list of items to include in the report chart. This
    # is a list of [Key, Report] pairs, in *ascending* order of the total sum
    # of values in the series. (This is so when we render the series, the
    # largest color blocks are at the bottom and it feels appropriately
    # weighted.)
    selections = map(
        lambda project__color: (
            Key(
                label=project__color[0].slug,
                url=project__color[0].get_absolute_url(),
                color=project__color[1],
                data=get_legend_data(reports[project__color[0]]),
            ),
            reports[project__color[0]],
        ),
        zip(projects, project_breakdown_colors),
    )[::-1]

    # Collect any reports that weren't in the selection set, merge them
    # together and add it at the top (front) of the stack.
    overflow = set(reports) - set(projects)
    if overflow:
        overflow_report = reduce(merge_reports, [reports[project] for project in overflow])
        selections.insert(
            0, (Key("Other", None, "#f2f0fa", get_legend_data(overflow_report)), overflow_report)
        )

    def summarize(key, points):
        total = sum(points)
        return [(key, total)] if total else []

    # Collect all of the independent series into a single series to make it
    # easier to render, resulting in a series where each value is a sequence of
    # (key, count) pairs.
    series = reduce(
        merge_series,
        [series_map(partial(summarize, key), report[0]) for key, report in selections],
    )

    legend = [key for key, value in reversed(selections)]
    return {
        "points": [(to_datetime(timestamp), value) for timestamp, value in series],
        "maximum": max(sum(count for key, count in value) for timestamp, value in series),
        "legend": {
            "rows": legend,
            "total": Key(
                "Total", None, total_color, reduce(merge_mappings, [key.data for key in legend])
            ),
        },
    }


def to_context(organization, interval, reports):
    report = reduce(merge_reports, reports.values())
    series = [(to_datetime(timestamp), Point(*values)) for timestamp, values in report.series]
    return {
        "series": {
            "points": series,
            "maximum": max(sum(point) for timestamp, point in series),
            "all": sum([sum(point) for timestamp, point in series]),
            "resolved": sum([point.resolved for timestamp, point in series]),
        },
        "distribution": {
            "types": list(
                zip(
                    (
                        DistributionType("New", "#DF5120"),
                        DistributionType("Reopened", "#FF7738"),
                        DistributionType("Existing", "#F9C7B9"),
                    ),
                    report.issue_summaries,
                )
            ),
            "total": sum(report.issue_summaries),
        },
        "comparisons": [
            ("last week", change(report.aggregates[-1], report.aggregates[-2])),
            (
                "four week average",
                change(
                    report.aggregates[-1],
                    mean(report.aggregates)
                    if all(v is not None for v in report.aggregates)
                    else None,
                ),
            ),
        ],
        "projects": {"series": build_project_breakdown_series(reports)},
        "calendar": to_calendar(organization, interval, report.calendar_series),
    }


def get_percentile(values, percentile):
    # XXX: ``values`` must be sorted.
    assert 1 >= percentile > 0
    if len(values) == 0:
        return 0
    if percentile == 1:
        index = -1
    else:
        index = int(math.ceil(len(values) * percentile)) - 1
    return values[index]


def colorize(spectrum, values):
    calculate_percentile = partial(get_percentile, sorted(values))

    legend = OrderedDict()
    width = 1.0 / len(spectrum)
    for i, color in enumerate(spectrum, 1):
        legend[color] = calculate_percentile(i * width)

    find_index = partial(bisect.bisect_left, list(legend.values()))

    results = []
    for value in values:
        results.append((value, spectrum[find_index(value)]))

    return legend, results


def to_calendar(organization, interval, series):
    start, stop = get_calendar_range(interval, 3)

    legend, values = colorize(
        calendar_heat_colors,
        [value for timestamp, value in series if value is not None],
    )

    value_color_map = dict(values)
    value_color_map[None] = "#F2F2F2"

    series_value_map = dict(series)

    # If global views are enabled we can generate a link to the day
    has_global_views = features.has("organizations:global-views", organization)

    def get_data_for_date(date):
        dt = datetime(date.year, date.month, date.day, tzinfo=pytz.utc)
        ts = to_timestamp(dt)
        value = series_value_map.get(ts, None)

        data = {"value": value, "color": value_color_map[value], "url": None}
        if has_global_views:
            url = reverse(
                "sentry-organization-issue-list", kwargs={"organization_slug": organization.slug}
            )
            params = {
                "project": -1,
                "utc": True,
                "start": dt.isoformat(),
                "end": (dt + timedelta(days=1)).isoformat(),
            }
            url = f"{url}?{urlencode(params)}"
            data["url"] = absolute_uri(url)

        return (dt, data)

    calendar = Calendar(6)
    sheets = []
    for year, month in map(index_to_month, range(start, stop + 1)):
        weeks = []

        for week in calendar.monthdatescalendar(year, month):
            weeks.append(map(get_data_for_date, week))

        sheets.append((datetime(year, month, 1, tzinfo=pytz.utc), weeks))

    return {"legend": list(legend.keys()), "sheets": sheets}
