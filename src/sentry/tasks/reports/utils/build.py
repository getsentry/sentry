from collections import namedtuple
from datetime import timedelta
from functools import partial, reduce

from sentry.app import tsdb
from sentry.models import Activity, GroupStatus
from sentry.tasks.reports.types import Key
from sentry.tasks.reports.utils.color import PROJECT_BREAKDOWN_COLORS, TOTAL_COLOR
from sentry.tasks.reports.utils.constants import BATCH_SIZE, ONE_DAY
from sentry.tasks.reports.utils.merge import merge_mappings, merge_series
from sentry.tasks.reports.utils.util import series_map
from sentry.types.activity import ActivityType
from sentry.utils.compat import filter, map, zip
from sentry.utils.dates import to_datetime
from sentry.utils.iterators import chunked


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
        return cls(*(f(*args) for f in field_builders))

    def merge(target, other):
        return cls(*(f(target[i], other[i]) for i, f in enumerate(field_mergers)))

    return cls, prepare, merge


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
                errors for _, (errors, transaction) in project__report[1].series
            ),
            reverse=True,
        )
    ]

    # The number of reports to keep is the same as the number of colors
    # available to use in the legend.
    projects = all_projects[: len(PROJECT_BREAKDOWN_COLORS)]

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
        zip(projects, PROJECT_BREAKDOWN_COLORS),
    )[::-1]

    # Collect any reports that weren't in the selection set, merge them
    # together and add it at the top (front) of the stack.
    overflow = set(reports) - set(projects)
    if overflow:
        from sentry.tasks.reports import merge_reports

        overflow_report = reduce(merge_reports, [reports[project] for project in overflow])
        selections.insert(
            0,
            (
                Key(
                    "Other",
                    None,
                    "#f2f0fa",
                    get_legend_data(overflow_report),
                ),
                overflow_report,
            ),
        )

    def summarize_errors(key, points):
        [errors, transactions] = points
        return [(key, errors)] if errors else []

    def summarize_transaction(key, points):
        [errors, transactions] = points
        return [(key, transactions)] if transactions else []

    # Collect all of the independent series into a single series to make it
    # easier to render, resulting in a series where each value is a sequence of
    # (key, count) pairs.
    series = reduce(
        merge_series,
        [series_map(partial(summarize_errors, key), report.series) for key, report in selections],
    )
    transaction_series = reduce(
        merge_series,
        [
            series_map(partial(summarize_transaction, key), report.series)
            for key, report in selections
        ],
    )

    legend = [key for key, value in reversed(selections)]
    return {
        "points": [
            (to_datetime(timestamp), value) for timestamp, value in series
        ],  # array of (timestamp, [(key, count)])
        "transaction_points": [
            (to_datetime(timestamp), value) for timestamp, value in transaction_series
        ],  # array of (timestamp, [(key, count)])
        "maximum": max(sum(count for key, count in value) for timestamp, value in series),
        "transaction_maximum": max(
            sum(count for key, count in value) for timestamp, value in transaction_series
        ),
        "legend": {
            "rows": legend,
            "total": Key(
                "Total",
                None,
                TOTAL_COLOR,
                reduce(merge_mappings, [key.data for key in legend]),
            ),
        },
    }


def build_key_transactions_ctx(key_events, organization, projects):
    # Todo: use projects arg?
    # Fetch projects
    project_id_to_project = {}
    for project in projects:
        project_id_to_project[project.id] = project

    return [
        {
            "name": e[0],
            "count": e[1],
            "project": project_id_to_project[e[2]],
            "p95": e[3],
            "p95_prev_week": e[4],
        }
        for e in filter(lambda e: e[2] in project_id_to_project, key_events)
    ]


def _query_tsdb_groups_chunked(func, issue_ids, start, stop, rollup):
    combined = {}

    for chunk in chunked(issue_ids, BATCH_SIZE):
        combined.update(func(tsdb.models.group, chunk, start, stop, rollup=rollup))

    return combined


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
            type__in=(
                ActivityType.SET_REGRESSION.value,
                ActivityType.SET_UNRESOLVED.value,
            ),
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
