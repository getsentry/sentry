from collections import defaultdict
from functools import partial, reduce
from typing import TYPE_CHECKING, Mapping

from django.utils import dateformat

from sentry.app import tsdb
from sentry.models import (
    Activity,
    Group,
    GroupHistory,
    GroupHistoryStatus,
    GroupStatus,
    Organization,
    Project,
    User,
)
from sentry.tasks.reports.types import DistributionType
from sentry.tasks.reports.types.duration import DURATIONS
from sentry.tasks.reports.utils.build import (
    build_key_transactions_ctx,
    build_project_breakdown_series,
)
from sentry.tasks.reports.utils.color import STATUS_TO_COLOR
from sentry.tasks.reports.utils.constants import ONE_DAY
from sentry.tasks.reports.utils.util import _to_interval, change
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.compat import zip
from sentry.utils.email import MessageBuilder
from sentry.utils.math import mean

if TYPE_CHECKING:
    from sentry.tasks.reports import Report

date_format = partial(dateformat.format, format_string="F jS, Y")


def fetch_personal_statistics(start__stop, organization, user):
    start, stop = start__stop
    resolved_issue_ids = set(
        Activity.objects.filter(
            project__organization_id=organization.id,
            user_id=user.id,
            type__in=(
                ActivityType.SET_RESOLVED.value,
                ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ),
            datetime__gte=start,
            datetime__lt=stop,
            group__status=GroupStatus.RESOLVED,  # only count if the issue is still resolved
        )
        .distinct()
        .values_list("group_id", flat=True)
    )

    if resolved_issue_ids:
        users = tsdb.get_distinct_counts_union(
            tsdb.models.users_affected_by_group,
            resolved_issue_ids,
            start,
            stop,
            ONE_DAY,
        )
    else:
        users = {}

    return {"resolved": len(resolved_issue_ids), "users": users}


def build_key_errors_ctx(key_events, organization):
    # Join with DB
    groups = Group.objects.filter(
        id__in=map(lambda i: i[0], key_events),
    ).all()

    group_id_to_group_history = defaultdict(lambda: (GroupHistoryStatus.NEW, "New Issue"))
    group_history = (
        GroupHistory.objects.filter(
            group__id__in=map(lambda i: i[0], key_events), organization=organization
        )
        .order_by("date_added")
        .all()
    )
    # The order_by ensures that the group_id_to_group_history contains the latest GroupHistory entry
    for g in group_history:
        group_id_to_group_history[g.group.id] = (g.status, g.get_status_display())

    group_id_to_group = {}
    for group in groups:
        group_id_to_group[group.id] = group

    return [
        {
            "group": group_id_to_group[e[0]],
            "count": e[1],
            # For new issues, group history would be None and we default to Unresolved
            "status": group_id_to_group_history[e[0]][1],
            "status_color": STATUS_TO_COLOR.get(group_id_to_group_history[e[0]][0], "#DBD6E1"),
        }
        for e in filter(lambda e: e[0] in group_id_to_group, key_events)
    ]


def to_context(organization, interval, reports):
    from sentry.tasks.reports import merge_reports

    report = reduce(merge_reports, reports.values())
    return {
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
        "key_errors": build_key_errors_ctx(report.key_events, organization),
        "key_transactions": build_key_transactions_ctx(
            report.key_transactions, organization, reports.keys()
        ),
    }


def build_message(
    timestamp: float,
    duration: float,
    organization: Organization,
    user: User,
    reports: Mapping[Project, "Report"],
) -> MessageBuilder:
    start, stop = interval = _to_interval(timestamp, duration)

    duration_spec = DURATIONS[duration]
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
