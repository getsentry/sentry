import sentry_sdk

from sentry import features
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import TeamStatus
from sentry.snuba.referrer import Referrer
from sentry.tasks.summaries.utils import (
    OrganizationReportContext,
    ProjectContext,
    fetch_key_error_groups,
    fetch_key_performance_issue_groups,
    fetch_past_resolved_issue_links,
    org_key_errors,
    organization_project_issue_summaries,
    project_event_counts_for_organization,
    project_key_performance_issues,
    project_past_resolved_issues,
)
from sentry.tasks.summaries.weekly_report_cache import read_project_metrics
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime
from sentry.utils.tracing import start_span


class OrganizationReportContextFactory:
    timestamp: float
    duration: int
    organization: Organization

    def __init__(self, timestamp: float, duration: int, organization: Organization):
        self.timestamp = timestamp
        self.duration = duration
        self.organization = organization

    @metrics.wraps("weekly_report.create_context.user_project_ownership")
    def _append_user_project_ownership(self, ctx: OrganizationReportContext) -> None:
        """Find the projects associated with each user.
        Populates context.project_ownership which is { user_id: set<project_id> }
        """
        with start_span(
            op="weekly_reports.user_project_ownership", name="weekly_reports.user_project_ownership"
        ):
            for project_id, user_id in OrganizationMember.objects.filter(
                organization_id=ctx.organization.id,
                teams__projectteam__project__isnull=False,
                teams__status=TeamStatus.ACTIVE,
            ).values_list("teams__projectteam__project_id", "user_id"):
                if user_id is not None:
                    ctx.project_ownership.setdefault(user_id, set()).add(project_id)

    @metrics.wraps("weekly_report.create_context.project_event_counts")
    def _append_project_event_counts(self, ctx: OrganizationReportContext) -> None:
        with start_span(
            op="weekly_reports.project_event_counts_for_organization",
            name="weekly_reports.project_event_counts_for_organization",
        ):
            event_counts = project_event_counts_for_organization(
                start=ctx.start, end=ctx.end, ctx=ctx, referrer=Referrer.REPORTS_OUTCOMES.value
            )
            for data in event_counts:
                project_id = data["project_id"]
                # Project no longer in organization, but events still exist
                if project_id not in ctx.projects_context_map:
                    continue
                project_ctx = ctx.projects_context_map[project_id]

                assert isinstance(project_ctx, ProjectContext), (
                    f"Expected a ProjectContext, received {type(project_ctx)}"
                )
                total = data["total"]
                timestamp = int(parse_snuba_datetime(data["time"]).timestamp())
                project_ctx.accepted_error_count += total
                project_ctx.error_count_by_day[timestamp] = (
                    project_ctx.error_count_by_day.get(timestamp, 0) + total
                )

    @metrics.wraps("weekly_report.create_context.previous_week_counts")
    def _append_previous_week_counts(self, ctx: OrganizationReportContext) -> None:
        """Populate previous-week error/transaction/issue counts for week-over-week comparison.

        Reads from Redis cache first (written by cache_project_metrics() at the end of each
        weekly report run), then falls back to Snuba (errors) and Django ORM (issues) for
        any cache misses.
        """
        with start_span(
            op="weekly_reports.previous_week_counts",
            name="weekly_reports.previous_week_counts",
        ):
            project_ids = list(ctx.projects_context_map.keys())
            cached = read_project_metrics(ctx.organization.id, project_ids)

            error_missed_project_ids: set[int] = set()
            issue_missed_project_ids: set[int] = set()

            for project_id, values in cached.items():
                project_ctx = ctx.projects_context_map[project_id]
                if "e" in values:
                    project_ctx.prev_week_accepted_error_count = values["e"]
                else:
                    error_missed_project_ids.add(project_id)
                if "i" in values:
                    project_ctx.prev_week_total_substatus_count = values["i"]
                else:
                    issue_missed_project_ids.add(project_id)

            no_cache_project_ids = set(project_ids) - set(cached.keys())
            error_missed_project_ids |= no_cache_project_ids
            issue_missed_project_ids |= no_cache_project_ids

            prev_start = ctx.start - (ctx.end - ctx.start)
            prev_end = ctx.start

            if error_missed_project_ids:
                event_counts = project_event_counts_for_organization(
                    start=prev_start,
                    end=prev_end,
                    ctx=ctx,
                    referrer=Referrer.REPORTS_OUTCOMES.value,
                )
                for data in event_counts:
                    project_id = data["project_id"]
                    if project_id not in ctx.projects_context_map:
                        continue
                    project_ctx = ctx.projects_context_map[project_id]
                    total = data["total"]
                    if data["outcome"] != Outcome.ACCEPTED:
                        continue
                    if data["category"] in DataCategory.error_categories():
                        if project_id in error_missed_project_ids:
                            project_ctx.prev_week_accepted_error_count += total

            if issue_missed_project_ids:
                issue_data = organization_project_issue_summaries(
                    start=prev_start, end=prev_end, ctx=ctx
                )
                for item in issue_data:
                    project_id = item["project_id"]
                    if project_id not in issue_missed_project_ids:
                        continue
                    if project_id in ctx.projects_context_map:
                        ctx.projects_context_map[
                            project_id
                        ].prev_week_total_substatus_count += item["total"]

    @metrics.wraps("weekly_report.create_context.issue_summaries")
    def _append_organization_project_issue_summaries(self, ctx: OrganizationReportContext) -> None:
        with start_span(
            op="weekly_reports.organization_project_issue_summaries",
            name="weekly_reports.organization_project_issue_summaries",
        ):
            data = organization_project_issue_summaries(start=ctx.start, end=ctx.end, ctx=ctx)
            for item in data:
                project_id = item["project_id"]
                if project_id not in ctx.projects_context_map:
                    continue
                project_ctx = ctx.projects_context_map[project_id]

                substatus = item["substatus"]
                total = item["total"]
                if substatus == GroupSubStatus.NEW:
                    project_ctx.new_substatus_count += total
                elif substatus == GroupSubStatus.ESCALATING:
                    project_ctx.escalating_substatus_count += total
                elif substatus == GroupSubStatus.ONGOING:
                    project_ctx.ongoing_substatus_count += total
                elif substatus == GroupSubStatus.REGRESSED:
                    project_ctx.regression_substatus_count += total
                project_ctx.total_substatus_count += total

                timestamp = int(item["day"].timestamp())
                project_ctx.issue_count_by_day[timestamp] = (
                    project_ctx.issue_count_by_day.get(timestamp, 0) + total
                )

    @metrics.wraps("weekly_report.create_context.project_key_errors")
    def _append_project_key_errors(self, ctx: OrganizationReportContext) -> None:
        with start_span(op="weekly_reports.project_passes", name="weekly_reports.project_passes"):
            organization = ctx.organization

            projects = [
                p for p in organization.project_set.all() if p.id in ctx.projects_context_map
            ]

            eligible_project_ids = [p.id for p in projects if p.first_event]
            try:
                key_errors_by_project = org_key_errors(
                    ctx,
                    project_ids=eligible_project_ids,
                    referrer=Referrer.REPORTS_KEY_ERRORS_BATCHED.value,
                )
            except Exception:
                sentry_sdk.capture_exception()
                key_errors_by_project = {}

            for project_id, key_errors in key_errors_by_project.items():
                project_ctx = ctx.projects_context_map[project_id]
                assert isinstance(project_ctx, ProjectContext), (
                    f"Expected a ProjectContext, received {type(project_ctx)}"
                )
                project_ctx.key_errors_by_id = [
                    (e["events.group_id"], e["count()"]) for e in key_errors
                ]

            for project in projects:
                project_ctx = ctx.projects_context_map[project.id]
                assert isinstance(project_ctx, ProjectContext), (
                    f"Expected a ProjectContext, received {type(project_ctx)}"
                )

                key_performance_issues = project_key_performance_issues(
                    ctx, project, referrer=Referrer.REPORTS_KEY_PERFORMANCE_ISSUES.value
                )
                if key_performance_issues:
                    ctx.projects_context_map[
                        project.id
                    ].key_performance_issues = key_performance_issues

    @metrics.wraps("weekly_report.create_context.hydrate_key_error_groups")
    def _hydrate_key_error_groups(self, ctx: OrganizationReportContext) -> None:
        with start_span(
            op="weekly_reports.fetch_key_error_groups", name="weekly_reports.fetch_key_error_groups"
        ):
            fetch_key_error_groups(ctx)

    @metrics.wraps("weekly_report.create_context.hydrate_key_performance_issues")
    def _hydrate_key_performance_issue_groups(self, ctx: OrganizationReportContext) -> None:
        with start_span(
            op="weekly_reports.fetch_key_performance_issue_groups",
            name="weekly_reports.fetch_key_performance_issue_groups",
        ):
            fetch_key_performance_issue_groups(ctx)

    @metrics.wraps("weekly_report.create_context.project_past_resolved_issues")
    def _append_project_past_resolved_issues(self, ctx: OrganizationReportContext) -> None:
        with start_span(
            op="weekly_reports.project_past_resolved_issues",
            name="weekly_reports.project_past_resolved_issues",
        ):
            for project in ctx.organization.project_set.all():
                if project.id not in ctx.projects_context_map:
                    continue
                project_ctx = ctx.projects_context_map[project.id]
                resolved = project_past_resolved_issues(
                    ctx, project, referrer=Referrer.REPORTS_PAST_RESOLVED_ISSUES.value
                )
                if resolved:
                    project_ctx.past_resolved_issues = resolved

            fetch_past_resolved_issue_links(ctx)

    def create_context(self) -> OrganizationReportContext:
        ctx = OrganizationReportContext(self.timestamp, self.duration, self.organization)

        metrics.distribution(
            "weekly_report.create_context.project_count",
            len(ctx.projects_context_map),
        )

        with metrics.timer("weekly_report.create_context.duration"):
            self._append_user_project_ownership(ctx)
            self._append_project_event_counts(ctx)
            self._append_organization_project_issue_summaries(ctx)
            if features.has("organizations:weekly-report-week-over-week-metric", self.organization):
                self._append_previous_week_counts(ctx)

            # Enhanced privacy flag hides issue titles, transaction names, and source details
            if not self.organization.flags.enhanced_privacy:
                self._append_project_key_errors(ctx)
                self._hydrate_key_error_groups(ctx)
                self._hydrate_key_performance_issue_groups(ctx)
                if features.has("organizations:weekly-report-past-issues", self.organization):
                    self._append_project_past_resolved_issues(ctx)

        return ctx
