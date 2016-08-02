import functools
import itertools
import logging
import operator
from collections import namedtuple
from datetime import timedelta

from django.utils import timezone

from sentry import features
from sentry.app import tsdb
from sentry.models import (
    Activity, Group, GroupStatus, Organization, OrganizationStatus, Project,
    Team, User
)
from sentry.tasks.base import instrumented_task
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.email import MessageBuilder
from sentry.utils.math import mean
from sentry.utils.query import RangeQuerySetWrapper


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


def prepare_project_aggregates((start, stop), project):
    # TODO: This needs to return ``None`` for periods that don't have any data
    # (because the project is not old enough) and possibly extrapolate for
    # periods that only have partial periods.
    period = timedelta(days=7 * 4)
    start = stop - period

    resolutions = project.group_set.filter(
        status=GroupStatus.RESOLVED,
        resolved_at__gte=start,
        resolved_at__lt=stop,
    ).values_list('resolved_at', flat=True)

    periods = [0] * 4
    for resolution in resolutions:
        periods[int((resolution - start).total_seconds() / period.total_seconds())] += 1

    return periods


def trim_issue_list(value):
    return sorted(
        value,
        key=lambda (id, statistics): statistics,
        reverse=True,
    )[:5]


def prepare_project_issue_list((start, stop), queryset, rollup=60 * 60 * 24):
    issue_ids = list(queryset.values_list('id', flat=True))

    events = tsdb.get_sums(
        tsdb.models.group,
        issue_ids,
        start,
        stop,
        rollup=rollup,
    )

    users = tsdb.get_distinct_counts_totals(
        tsdb.models.users_affected_by_group,
        issue_ids,
        start,
        stop,
        rollup=rollup,
    )

    return (
        len(issue_ids),
        trim_issue_list([(id, (events[id], users[id])) for id in issue_ids]),
    )


def prepare_project_issue_lists(interval, project):
    start, stop = interval
    queryset = project.group_set.exclude(status=GroupStatus.MUTED)
    return (
        prepare_project_issue_list(
            interval,
            queryset.filter(
                first_seen__gte=start,
                first_seen__lt=stop,
            ),
        ),
        prepare_project_issue_list(
            interval,
            queryset.filter(
                status=GroupStatus.UNRESOLVED,
                resolved_at__gte=start,
                resolved_at__lt=stop,
            ),
        ),
        prepare_project_issue_list(
            interval,
            queryset.filter(
                last_seen__gte=start,
                last_seen__lt=stop,
            ),
        ),
    )


def merge_issue_lists(target, other):
    return (
        target[0] + other[0],
        trim_issue_list(target[1] + other[1]),
    )


def prepare_project_report(interval, project):
    return (
        prepare_project_series(interval, project),
        prepare_project_aggregates(interval, project),
        prepare_project_issue_lists(interval, project),
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
        merge_sequences(
            target[2],
            other[2],
            merge_issue_lists,
        ),
    )


@instrumented_task(
    name='sentry.tasks.reports.prepare_reports',
    queue='reports.prepare')
def prepare_reports(*args, **kwargs):
    timestamp, duration = _fill_default_parameters(*args, **kwargs)

    organization_ids = _get_organization_queryset().values_list('id', flat=True)
    for organization_id in RangeQuerySetWrapper(organization_ids):
        prepare_organization_report.delay(timestamp, duration, organization_id)


@instrumented_task(
    name='sentry.tasks.reports.prepare_organization_report',
    queue='reports.prepare')
def prepare_organization_report(timestamp, duration, organization_id):
    organization = _get_organization_queryset().get(id=organization_id)

    if not features.has('organizations:reports:prepare', organization):
        return

    # TODO: Build and store project reports here.

    for user_id in organization.member_set.values_list('id', flat=True):
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
    ).values_list('group_id', flat=True)
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


@instrumented_task(
    name='sentry.tasks.reports.deliver_organization_user_report',
    queue='reports.deliver')
def deliver_organization_user_report(timestamp, duration, organization_id, user_id):
    organization = _get_organization_queryset().get(id=organization_id)
    user = User.objects.get(id=user_id)

    projects = set()
    for team in Team.objects.get_for_user(organization, user):
        projects.update(
            Project.objects.get_for_user(team, user, _skip_team_check=True),
        )

    interval = _to_interval(timestamp, duration)
    start, stop = interval

    def fetch_report(project):
        # TODO: Fetch reports from storage, rather than building on demand.
        return prepare_project_report(
            interval,
            project,
        )

    report = reduce(
        merge_reports,
        map(
            fetch_report,
            projects,
        ),
    )

    message = MessageBuilder(
        subject=u'Sentry Report for {}'.format(organization.name),
        template='sentry/emails/reports/body.txt',
        html_template='sentry/emails/reports/body.html',
        type='report.organization',
        context={
            'interval': {
                'start': start,
                'stop': stop,
            },
            'organization': organization,
            'personal': fetch_personal_statistics(
                interval,
                organization,
                user,
            ),
            'report': to_context(report),
            'user': user,
        },
    )

    message.add_users((user.id,))

    if features.has('organizations:reports:deliver', organization):
        message.send()


IssueList = namedtuple('IssueList', 'count issues')
IssueStatistics = namedtuple('IssueStatistics', 'events users')


def rewrite_issue_list((count, issues), fetch_groups=None):
    # XXX: This only exists for removing data dependency in tests.
    if fetch_groups is None:
        fetch_groups = Group.objects.in_bulk

    instances = fetch_groups([id for id, _ in issues])

    def rewrite((id, statistics)):
        instance = instances.get(id)
        if instance is None:
            logger.debug("Could not retrieve group with key %r, skipping...", id)
            return None
        return (instance, IssueStatistics(*statistics))

    return IssueList(
        count,
        filter(None, map(rewrite, issues)),
    )


Point = namedtuple('Point', 'resolved unresolved')


def to_context(report, fetch_groups=None):
    series, aggregates, issue_lists = report
    series = [(timestamp, Point(*values)) for timestamp, values in series]

    return {
        'series': {
            'points': series,
            'maximum': max(sum(point) for timestamp, point in series),
            'all': sum([sum(point) for timestamp, point in series]),
            'resolved': sum([point.resolved for timestamp, point in series]),
        },
        'comparisons': [
            ('last week', change(aggregates[-1], aggregates[-2])),
            ('last month', change(
                aggregates[-1],
                mean(aggregates) if all(v is not None for v in aggregates) else None,
            )),
        ],
        'issues': (
            ('New Issues', rewrite_issue_list(issue_lists[0], fetch_groups)),
            ('Reintroduced Issues', rewrite_issue_list(issue_lists[1], fetch_groups)),
            ('Most Frequently Seen Issues', rewrite_issue_list(issue_lists[2], fetch_groups)),
        ),
    }
