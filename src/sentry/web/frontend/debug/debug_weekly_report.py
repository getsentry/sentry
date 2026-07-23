import time
from datetime import datetime, timedelta, timezone
from random import Random
from typing import Any

from django.utils.decorators import method_decorator
from django.utils.text import slugify

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import (
    GroupType,
    PerformanceNPlusOneGroupType,
    PerformanceP95EndpointRegressionGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    SIX_HOURS,
    OrganizationReportContext,
    ProjectContext,
)
from sentry.tasks.summaries.weekly_reports import get_group_display, render_template_context
from sentry.types.group import GroupSubStatus
from sentry.utils import loremipsum
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.dates import floor_to_utc_day, to_datetime
from sentry.web.decorators import login_required
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import MailPreviewView


def get_random(request: AuthenticatedHttpRequest) -> Random:
    seed = request.GET.get("seed", str(time.time()))
    return Random(seed)


def make_debug_group(
    *,
    group_id: int,
    project: Project,
    title: str,
    message: str,
    group_type: type[GroupType],
    event_type: str,
    status: int = GroupStatus.UNRESOLVED,
    substatus: int = GroupSubStatus.ONGOING,
) -> Group:
    group = Group(
        id=group_id,
        project=project,
        project_id=project.id,
        message=message,
        status=status,
        substatus=substatus,
        type=group_type.type_id,
        data={"type": event_type, "metadata": {"title": title, "value": message}},
    )
    return group


def make_debug_issue_message(random: Random) -> str:
    return f"{' '.join(random.sample(loremipsum.words, 18))}"


def make_debug_issue_title(random: Random, prefix: str) -> str:
    return f"{prefix}"


@internal_cell_silo_view
@method_decorator(login_required, name="dispatch")
class DebugWeeklyReportView(MailPreviewView):
    def get_context(self, request: AuthenticatedHttpRequest) -> dict[str, Any] | None:
        organization = Organization(id=1, slug="myorg", name="MyOrg")

        if request.GET.get("enhanced_privacy"):
            organization.flags.enhanced_privacy = True

        random = get_random(request)

        duration = 60 * 60 * 24 * 7
        timestamp = floor_to_utc_day(
            to_datetime(
                random.randint(
                    int(datetime(2015, 6, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp()),
                    int(datetime(2016, 7, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp()),
                )
            )
        ).timestamp()
        ctx = OrganizationReportContext(timestamp, duration, organization)
        ctx.projects_context_map.clear()

        start_timestamp = ctx.start.timestamp()

        daily_maximum = random.randint(1000, 10000)

        # Initialize projects
        for i in range(0, random.randint(1, 8)):
            name = " ".join(random.sample(loremipsum.words, random.randint(1, 4)))
            project = Project(
                id=i,
                organization=organization,
                slug=slugify(name),
                name=name,
                date_added=ctx.start - timedelta(days=random.randint(0, 120)),
            )
            project_context = ProjectContext(project)
            project_context.error_count_by_day = {
                start_timestamp + (i * ONE_DAY): random.randint(0, daily_maximum)
                for i in range(0, 7)
            }
            project_context.issue_count_by_day = {
                start_timestamp + (i * ONE_DAY): random.randint(0, daily_maximum // 10)
                for i in range(0, 7)
            }

            project_context.accepted_error_count = sum(project_context.error_count_by_day.values())
            project_context.prev_week_accepted_error_count = int(
                project_context.accepted_error_count * random.uniform(0.5, 1.5)
            )
            substatuses = [
                (GroupStatus.UNRESOLVED, GroupSubStatus.NEW),
                (GroupStatus.UNRESOLVED, GroupSubStatus.ESCALATING),
                (GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED),
                (GroupStatus.RESOLVED, GroupSubStatus.NEW),
                (GroupStatus.UNRESOLVED, GroupSubStatus.ONGOING),
            ]
            project_context.key_error_issues = [
                (
                    make_debug_group(
                        group_id=10000 + (project.id * 100) + group_index,
                        project=project,
                        title=make_debug_issue_title(
                            random,
                            random.choice(["TypeError", "ValueError", "RuntimeError"]),
                        ),
                        message=make_debug_issue_message(random),
                        group_type=ErrorGroupType,
                        event_type="error",
                        status=status,
                        substatus=substatus,
                    ),
                    random.randint(100, 1000),
                )
                for group_index, (status, substatus) in enumerate(substatuses)
            ]

            project_context.new_substatus_count = random.randint(5, 200)
            project_context.escalating_substatus_count = random.randint(5, 200)
            project_context.regression_substatus_count = random.randint(5, 200)
            project_context.ongoing_substatus_count = random.randint(20, 3000)
            project_context.total_substatus_count = (
                project_context.new_substatus_count
                + project_context.escalating_substatus_count
                + project_context.regression_substatus_count
                + project_context.ongoing_substatus_count
            )
            project_context.prev_week_total_substatus_count = int(
                project_context.total_substatus_count * random.uniform(0.5, 1.5)
            )

            performance_issue_types = [
                PerformanceSlowDBQueryGroupType,
                PerformanceNPlusOneGroupType,
                PerformanceP95EndpointRegressionGroupType,
            ]
            project_context.key_performance_issues = [
                (
                    make_debug_group(
                        group_id=20000 + (project.id * 100) + group_index,
                        project=project,
                        title=make_debug_issue_title(random, performance_issue_type.description),
                        message=make_debug_issue_message(random),
                        group_type=performance_issue_type,
                        event_type="transaction",
                        status=substatuses[group_index][0],
                        substatus=substatuses[group_index][1],
                    ),
                    None,
                    random.randint(100, 1000),
                )
                for group_index, performance_issue_type in enumerate(performance_issue_types)
            ]

            project_context.past_resolved_issues = [
                (
                    make_debug_group(
                        group_id=30000 + (project.id * 100) + group_index,
                        project=project,
                        title=make_debug_issue_title(
                            random,
                            random.choice(["TypeError", "ValueError", "RuntimeError"]),
                        ),
                        message=make_debug_issue_message(random),
                        group_type=ErrorGroupType,
                        event_type="error",
                        status=GroupStatus.RESOLVED,
                        substatus=GroupSubStatus.NEW,
                    ),
                    random.randint(100, 5000),
                    random.choice([True, False]),
                )
                for group_index in range(3)
            ]

            ctx.projects_context_map[project.id] = project_context

        span_names = [
            "GET /api/0/organizations/{organization_slug}/issues/",
            'db - SELECT "sentry_project"."id", "sentry_project"."name" FROM "sentry_project"',
            "POST /api/0/organizations/{organization_slug}/events/",
            "tasks.store.save_event",
            "GET /api/0/projects/{organization_slug}/{project_slug}/stats/",
        ]
        all_project_ids = set(ctx.projects_context_map.keys())
        ctx.top_spans = [
            {
                "name": name,
                "p95": random.uniform(50, 500),
                "sum": random.uniform(10000, 100000),
            }
            for name in span_names
        ]
        ctx.top_spans_projects = {name: next(iter(all_project_ids)) for name in span_names}
        ctx.spans_count_by_project = {
            pid: random.randint(100000, 1500000) for pid in all_project_ids
        }
        intervals = 28
        for name in span_names:
            ctx.top_spans_timeseries[name] = {
                int(start_timestamp + i * SIX_HOURS): random.uniform(50, 500)
                for i in range(intervals)
            }

        user_id = request.user.id
        ctx.project_ownership[user_id] = {pid for pid in ctx.projects_context_map}
        context = render_template_context(ctx, user_id)
        if context is not None:
            context["show_week_over_week_metric"] = (
                request.GET.get("show_week_over_week_metric", "1") != "0"
            )
            context["show_past_issues"] = True
            context["total_spans_count"] = sum(ctx.spans_count_by_project.values())
            project_by_id = {pid: pctx.project for pid, pctx in ctx.projects_context_map.items()}
            context["top_spans_table"] = [
                {
                    "name": span["name"],
                    "p95": span["p95"],
                    "sum": span["sum"],
                    "project_slugs": project_by_id[ctx.top_spans_projects[span["name"]]].slug
                    if ctx.top_spans_projects.get(span["name"]) in project_by_id
                    else "",
                    "url": "#",
                }
                for span in ctx.top_spans
            ]
            past_issues: list[dict[str, Any]] = []
            for project_ctx in ctx.projects_context_map.values():
                for group, count, has_link in project_ctx.past_resolved_issues:
                    display = get_group_display(group)
                    past_issues.append(
                        {
                            "count": count,
                            "group": group,
                            "title": display["title"],
                            "message": display["message"],
                            "has_linked_pr_or_commit": has_link,
                        }
                    )
            past_issues.sort(key=lambda x: x["count"], reverse=True)
            context["past_issues"] = past_issues[:3]
        return context

    @property
    def html_template(self) -> str:
        return "sentry/emails/reports/body.html"

    @property
    def text_template(self) -> str:
        return "sentry/emails/reports/body.txt"
