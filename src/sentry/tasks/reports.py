from __future__ import absolute_import

import functools
import itertools
import logging
import operator
import zlib
from collections import namedtuple
from datetime import timedelta

from django.utils import dateformat, timezone

from sentry import features
from sentry.app import tsdb
from sentry.models import (
    Activity, GroupStatus, Organization, OrganizationStatus, Project,
    Release, TagValue, Team, User, UserOption
)
from sentry.tasks.base import instrumented_task
from sentry.utils import json, redis
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.email import MessageBuilder
from sentry.utils.math import mean
from six.moves import reduce

date_format = functools.partial(
    dateformat.format,
    format_string="F jS, Y",
)


logger = logging.getLogger(__name__)


def _get_organization_queryset():
    return Organization.objects.filter(
        status=OrganizationStatus.VISIBLE,
    )


def _fill_default_parameters(timestamp=None, rollup=None):
    if timestamp is None:
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

    if rollup is None:
        rollup = 60 * 60 * 24 * 7

    return (timestamp, rollup)


def _to_interval(timestamp, duration):
    return (
        to_datetime(timestamp - duration),
        to_datetime(timestamp),
    )


def change(value, reference):
    """
    Calculate the relative change between a value and a reference point.
    """
    if not reference:  # handle both None and divide by zero case
        return None

    return ((value or 0) - reference) / float(reference)


def clean_series(start, stop, rollup, series):
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
    assert len(target) == len(other), 'sequence lengths must match'
    return type(target)([function(x, y) for x, y in zip(target, other)])


def merge_mappings(target, other, function=lambda x, y: x + y):
    """
    Merge two mappings into a single mapping. The set of keys in both
    mappings must be equal.
    """
    assert set(target) == set(other), 'keys must match'
    return {k: function(v, other[k]) for k, v in target.items()}


def merge_series(target, other, function=operator.add):
    """
    Merge two series into a single series. Both series must have the same
    start and end points as well as the same resolution.
    """
    missing = object()
    results = []
    for x, y in itertools.izip_longest(target, other, fillvalue=missing):
        assert x is not missing and y is not missing, 'series must be same length'
        assert x[0] == y[0], 'series timestamps must match'
        results.append((x[0], function(x[1], y[1])))
    return results


def prepare_project_series((start, stop), project, rollup=60 * 60 * 24):
    resolution, series = tsdb.get_optimal_rollup_series(start, stop, rollup)
    assert resolution == rollup, 'resolution does not match requested value'
    clean = functools.partial(clean_series, start, stop, rollup)
    return merge_series(
        reduce(
            merge_series,
            map(
                clean,
                tsdb.get_range(
                    tsdb.models.group,
                    project.group_set.filter(
                        status=GroupStatus.RESOLVED,
                        resolved_at__gte=start,
                        resolved_at__lt=stop,
                    ).values_list('id', flat=True),
                    start,
                    stop,
                    rollup=rollup,
                ).values(),
            ),
            clean([(timestamp, 0) for timestamp in series]),
        ),
        clean(
            tsdb.get_range(
                tsdb.models.project,
                [project.id],
                start,
                stop,
                rollup=rollup,
            )[project.id],
        ),
        lambda resolved, total: (
            resolved,
            total - resolved,  # unresolved
        ),
    )


def prepare_project_aggregates((_, stop), project):
    # TODO: This needs to return ``None`` for periods that don't have any data
    # (because the project is not old enough) and possibly extrapolate for
    # periods that only have partial periods.
    segments = 4
    period = timedelta(days=7)
    start = stop - (period * segments)

    def get_aggregate_value(start, stop):
        return tsdb.get_sums(
            tsdb.models.project,
            (project.id,),
            start,
            stop,
            rollup=60 * 60 * 24,
        )[project.id]

    return [
        get_aggregate_value(
            start + (period * i),
            start + (period * (i + 1) - timedelta(seconds=1)),
        ) for i in range(segments)
    ]


def prepare_project_issue_summaries(interval, project):
    start, stop = interval

    queryset = project.group_set.exclude(status=GroupStatus.MUTED)

    # Fetch all new issues.
    new_issue_ids = set(
        queryset.filter(
            first_seen__gte=start,
            first_seen__lt=stop,
        ).values_list('id', flat=True)
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
                Activity.SET_REGRESSION,
                Activity.SET_UNRESOLVED,
            ),
            datetime__gte=start,
            datetime__lt=stop,
        ).distinct().values_list('group_id', flat=True)
    )

    rollup = 60 * 60 * 24

    event_counts = tsdb.get_sums(
        tsdb.models.group,
        new_issue_ids | reopened_issue_ids,
        start,
        stop,
        rollup=rollup,
    )

    new_issue_count = sum(event_counts[id] for id in new_issue_ids)
    reopened_issue_count = sum(event_counts[id] for id in reopened_issue_ids)
    existing_issue_count = max(
        tsdb.get_sums(
            tsdb.models.project,
            [project.id],
            start,
            stop,
            rollup=rollup,
        )[project.id] - new_issue_count - reopened_issue_count,
        0,
    )

    return [
        new_issue_count,
        reopened_issue_count,
        existing_issue_count,
    ]


merge_issue_summaries = merge_sequences


def trim_release_list(value):
    return sorted(
        value,
        key=lambda (id, count): count,
        reverse=True,
    )[:5]


def prepare_project_release_list((start, stop), project):
    return trim_release_list(
        filter(
            lambda item: item[1] > 0,
            tsdb.get_sums(
                tsdb.models.release,
                Release.objects.filter(
                    project=project,
                    version__in=TagValue.objects.filter(
                        project=project,
                        key='sentry:release',
                        last_seen__gte=start,  # lack of upper bound is intentional
                    ).values_list('value', flat=True),
                ).values_list('id', flat=True),
                start,
                stop,
                rollup=60 * 60 * 24,
            ).items(),
        )
    )


def prepare_project_usage_summary((start, stop), project):
    return (
        tsdb.get_sums(
            tsdb.models.project_total_blacklisted,
            [project.id],
            start,
            stop,
            rollup=60 * 60 * 24,
        )[project.id],
        tsdb.get_sums(
            tsdb.models.project_total_rejected,
            [project.id],
            start,
            stop,
            rollup=60 * 60 * 24,
        )[project.id],
    )


def prepare_project_report(interval, project):
    return (
        prepare_project_series(interval, project),
        prepare_project_aggregates(interval, project),
        prepare_project_issue_summaries(interval, project),
        prepare_project_release_list(interval, project),
        prepare_project_usage_summary(interval, project),
    )


class ReportBackend(object):
    def build(self, timestamp, duration, project):
        return prepare_project_report(
            _to_interval(timestamp, duration),
            project,
        )

    def prepare(self, timestamp, duration, organization):
        """
        Build and store reports for all projects in the organization.
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
        return map(
            functools.partial(
                self.build,
                timestamp,
                duration,
            ),
            projects,
        )


class RedisReportBackend(ReportBackend):
    version = 1

    def __init__(self, cluster, ttl, namespace='r'):
        self.cluster = cluster
        self.ttl = ttl
        self.namespace = namespace

    def __make_key(self, timestamp, duration, organization):
        return '{}:{}:{}:{}:{}'.format(
            self.namespace,
            self.version,
            organization.id,
            int(timestamp),
            int(duration),
        )

    def __encode(self, report):
        return zlib.compress(json.dumps(report))

    def __decode(self, value):
        return json.loads(zlib.decompress(value))

    def prepare(self, timestamp, duration, organization):
        reports = {}
        for project in organization.project_set.all():
            reports[project.id] = self.__encode(
                self.build(timestamp, duration, project),
            )

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

        return list(map(self.__decode, result.value))


backend = RedisReportBackend(
    redis.clusters.get('default'),
    60 * 60 * 3,
)


def safe_add(x, y):
    if x is not None and y is not None:
        return x + y
    elif x is not None:
        return x
    elif y is not None:
        return y
    else:
        return None


def merge_reports(target, other):
    return (
        merge_series(
            target[0],
            other[0],
            merge_sequences,
        ),
        merge_sequences(
            target[1],
            other[1],
            safe_add,
        ),
        merge_issue_summaries(
            target[2],
            other[2],
        ),
        trim_release_list(target[3] + other[3]),
        merge_sequences(
            target[4],
            other[4],
        )
    )


@instrumented_task(
    name='sentry.tasks.reports.prepare_reports',
    queue='reports.prepare')
def prepare_reports(*args, **kwargs):
    timestamp, duration = _fill_default_parameters(*args, **kwargs)

    organization_ids = _get_organization_queryset().values_list('id', flat=True)
    for organization_id in organization_ids:
        prepare_organization_report.delay(timestamp, duration, organization_id)


@instrumented_task(
    name='sentry.tasks.reports.prepare_organization_report',
    queue='reports.prepare')
def prepare_organization_report(timestamp, duration, organization_id):
    organization = _get_organization_queryset().get(id=organization_id)

    if not features.has('organizations:reports:prepare', organization):
        return

    backend.prepare(timestamp, duration, organization)

    # If an OrganizationMember row doesn't have an associated user, this is
    # actually a pending invitation, so no report should be delivered.
    member_set = organization.member_set.filter(
        user_id__isnull=False,
        user__is_active=True,
    )

    for user_id in member_set.values_list('user_id', flat=True):
        deliver_organization_user_report.delay(
            timestamp,
            duration,
            organization_id,
            user_id,
        )


def fetch_personal_statistics((start, stop), organization, user):
    resolved_issue_ids = Activity.objects.filter(
        project__organization_id=organization.id,
        user_id=user.id,
        type__in=(
            Activity.SET_RESOLVED,
            Activity.SET_RESOLVED_IN_RELEASE,
        ),
        datetime__gte=start,
        datetime__lt=stop,
        group__status=GroupStatus.RESOLVED,  # only count if the issue is still resolved
    ).distinct().values_list('group_id', flat=True)
    return {
        'resolved': len(resolved_issue_ids),
        'users': tsdb.get_distinct_counts_union(
            tsdb.models.users_affected_by_group,
            resolved_issue_ids,
            start,
            stop,
            60 * 60 * 24,
        ),
    }


Duration = namedtuple(
    'Duration', (
        'adjective',    # e.g. "daily" or "weekly",
        'noun',         # relative to today, e.g. "yesterday" or "this week"
        'date_format',  # date format used for large series x axis labeling
    ))

durations = {
    (60 * 60 * 24 * 7): Duration(
        'weekly',
        'this week',
        'D',
    ),
}


def build_message(timestamp, duration, organization, user, reports):
    start, stop = interval = _to_interval(timestamp, duration)

    duration_spec = durations[duration]
    message = MessageBuilder(
        subject=u'{} Report for {}: {} - {}'.format(
            duration_spec.adjective.title(),
            organization.name,
            date_format(start),
            date_format(stop),
        ),
        template='sentry/emails/reports/body.txt',
        html_template='sentry/emails/reports/body.html',
        type='report.organization',
        context={
            'duration': duration_spec,
            'interval': {
                'start': date_format(start),
                'stop': date_format(stop),
            },
            'organization': organization,
            'personal': fetch_personal_statistics(
                interval,
                organization,
                user,
            ),
            'report': to_context(reports),
            'user': user,
        },
    )

    message.add_users((user.id,))

    return message


DISABLED_ORGANIZATIONS_USER_OPTION_KEY = 'reports:disabled-organizations'


def user_subscribed_to_organization_reports(user, organization):
    return organization.id not in UserOption.objects.get_value(
        user=user,
        project=None,
        key=DISABLED_ORGANIZATIONS_USER_OPTION_KEY,
        default=[],
    )


class Skipped(object):
    NotSubscribed = object()
    NoProjects = object()
    NoReports = object()


def has_valid_aggregates(interval, (project, report)):
    _, aggregates, _, _, _ = report
    return any(bool(value) for value in aggregates)


@instrumented_task(
    name='sentry.tasks.reports.deliver_organization_user_report',
    queue='reports.deliver')
def deliver_organization_user_report(timestamp, duration, organization_id, user_id):
    organization = _get_organization_queryset().get(id=organization_id)
    user = User.objects.get(id=user_id)

    if not user_subscribed_to_organization_reports(user, organization):
        logger.debug(
            'Skipping report for %r to %r, user is not subscribed to reports.',
            organization,
            user,
        )
        return Skipped.NotSubscribed

    projects = set()
    for team in Team.objects.get_for_user(organization, user):
        projects.update(Project.objects.get_for_user(team, user, _skip_team_check=True))

    if not projects:
        logger.debug(
            'Skipping report for %r to %r, user is not associated with any projects.',
            organization,
            user,
        )
        return Skipped.NoProjects

    interval = _to_interval(timestamp, duration)
    projects = list(projects)

    inclusion_predicates = [
        has_valid_aggregates,
    ]

    reports = dict(
        filter(
            lambda item: all(predicate(interval, item) for predicate in inclusion_predicates),
            zip(
                projects,
                backend.fetch(  # TODO: This should handle missing data gracefully, maybe?
                    timestamp,
                    duration,
                    organization,
                    projects,
                ),
            )
        )
    )

    if not reports:
        logger.debug('Skipping report for %r to %r, no qualifying reports to deliver.',
            organization,
            user,
        )
        return Skipped.NoReports

    message = build_message(
        timestamp,
        duration,
        organization,
        user,
        reports,
    )

    if features.has('organizations:reports:deliver', organization):
        message.send()


Point = namedtuple('Point', 'resolved unresolved')
DistributionType = namedtuple('DistributionType', 'label color')


def series_map(function, series):
    return [(timestamp, function(value)) for timestamp, value in series]


colors = [
    '#696dc3',
    '#6288ba',
    '#59aca4',
    '#99d59a',
    '#daeca9',
]


def build_project_breakdown_series(reports):
    Key = namedtuple('Key', 'label url color data')

    def get_legend_data(report):
        series, _, _, _, (filtered, rate_limited) = report
        return {
            'events': sum(sum(value) for timestamp, value in series),
            'filtered': filtered,
            'rate_limited': rate_limited,
        }

    # Find the reports with the most total events. (The number of reports to
    # keep is the same as the number of colors available to use in the legend.)
    instances = map(
        operator.itemgetter(0),
        sorted(
            reports.items(),
            key=lambda (instance, report): sum(sum(values) for timestamp, values in report[0]),
            reverse=True,
        ),
    )[:len(colors)]

    # Starting building the list of items to include in the report chart. This
    # is a list of [Key, Report] pairs, in *ascending* order of the total sum
    # of values in the series. (This is so when we render the series, the
    # largest color blocks are at the bottom and it feels appropriately
    # weighted.)
    selections = map(
        lambda (instance, color): (
            Key(
                instance.slug,
                instance.get_absolute_url(),
                color,
                get_legend_data(reports[instance]),
            ),
            reports[instance],
        ),
        zip(
            instances,
            colors,
        ),
    )[::-1]

    # Collect any reports that weren't in the selection set, merge them
    # together and add it at the top (front) of the stack.
    overflow = set(reports) - set(instances)
    if overflow:
        overflow_report = reduce(
            merge_reports,
            [reports[instance] for instance in overflow],
        )
        selections.insert(0, (
            Key('Other', None, '#f2f0fa', get_legend_data(overflow_report)),
            overflow_report,
        ))

    def summarize(key, points):
        total = sum(points)
        return [(key, total)] if total else []

    # Collect all of the independent series into a single series to make it
    # easier to render, resulting in a series where each value is a sequence of
    # (key, count) pairs.
    series = reduce(
        merge_series,
        [
            series_map(
                functools.partial(summarize, key),
                report[0],
            ) for key, report in selections
        ],
    )

    return {
        'points': [(to_datetime(timestamp), value) for timestamp, value in series],
        'maximum': max(sum(count for key, count in value) for timestamp, value in series),
        'legend': [key for key, value in reversed(selections)],
    }


def to_context(reports):
    series, aggregates, issue_summaries, release_list, usage_summary = reduce(
        merge_reports,
        reports.values(),
    )
    series = [(to_datetime(timestamp), Point(*values)) for timestamp, values in series]

    return {
        'series': {
            'points': series,
            'maximum': max(sum(point) for timestamp, point in series),
            'all': sum([sum(point) for timestamp, point in series]),
            'resolved': sum([point.resolved for timestamp, point in series]),
        },
        'distribution': {
            'types': list(
                zip(
                    (
                        DistributionType('New', '#8477e0'),
                        DistributionType('Reopened', '#6C5FC7'),
                        DistributionType('Existing', '#534a92'),
                    ),
                    issue_summaries,
                ),
            ),
            'total': sum(issue_summaries),
        },
        'comparisons': [
            ('last week', change(aggregates[-1], aggregates[-2])),
            ('four week average', change(
                aggregates[-1],
                mean(aggregates) if all(v is not None for v in aggregates) else None,
            )),
        ],
        'projects': {
            'series': build_project_breakdown_series(reports),
        },
    }
