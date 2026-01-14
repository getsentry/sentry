import sentry_sdk

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
    organization_project_issue_substatus_summaries,
    project_event_counts_for_organization,
    project_key_error_logs,
    project_key_errors,
    project_key_performance_issues,
    project_key_transactions_last_week,
    project_key_transactions_this_week,
    project_log_volume_by_severity,
    project_log_volume_timeseries,
)
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime


class OrganizationReportContextFactory:
    timestamp: float
    duration: int
    organization: Organization

    def __init__(self, timestamp: float, duration: int, organization: Organization):
        self.timestamp = timestamp
        self.duration = duration
        self.organization = organization

    def _append_user_project_ownership(self, ctx: OrganizationReportContext) -> None:
        """Find the projects associated with each user.
        Populates context.project_ownership which is { user_id: set<project_id> }
        """
        with sentry_sdk.start_span(op="weekly_reports.user_project_ownership"):
            for project_id, user_id in OrganizationMember.objects.filter(
                organization_id=ctx.organization.id,
                teams__projectteam__project__isnull=False,
                teams__status=TeamStatus.ACTIVE,
            ).values_list("teams__projectteam__project_id", "user_id"):
                if user_id is not None:
                    ctx.project_ownership.setdefault(user_id, set()).add(project_id)

    def _append_project_event_counts(self, ctx: OrganizationReportContext) -> None:
        with sentry_sdk.start_span(op="weekly_reports.project_event_counts_for_organization"):
            event_counts = project_event_counts_for_organization(
                start=ctx.start, end=ctx.end, ctx=ctx, referrer=Referrer.REPORTS_OUTCOMES.value
            )
            for data in event_counts:
                project_id = data["project_id"]
                # Project no longer in organization, but events still exist
                if project_id not in ctx.projects_context_map:
                    continue
                project_ctx = ctx.projects_context_map[project_id]

                assert isinstance(
                    project_ctx, ProjectContext
                ), f"Expected a ProjectContext, received {type(project_ctx)}"
                total = data["total"]
                timestamp = int(parse_snuba_datetime(data["time"]).timestamp())
                if data["category"] == DataCategory.TRANSACTION:
                    # Transaction outcome
                    if (
                        data["outcome"] == Outcome.RATE_LIMITED
                        or data["outcome"] == Outcome.FILTERED
                    ):
                        project_ctx.dropped_transaction_count += total
                    else:
                        project_ctx.accepted_transaction_count += total
                        project_ctx.transaction_count_by_day[timestamp] = total
                elif data["category"] == DataCategory.REPLAY:
                    # Replay outcome
                    if (
                        data["outcome"] == Outcome.RATE_LIMITED
                        or data["outcome"] == Outcome.FILTERED
                    ):
                        project_ctx.dropped_replay_count += total
                    else:
                        project_ctx.accepted_replay_count += total
                        project_ctx.replay_count_by_day[timestamp] = total
                else:
                    # Error outcome
                    if (
                        data["outcome"] == Outcome.RATE_LIMITED
                        or data["outcome"] == Outcome.FILTERED
                    ):
                        project_ctx.dropped_error_count += total
                    else:
                        project_ctx.accepted_error_count += total
                        project_ctx.error_count_by_day[timestamp] = (
                            project_ctx.error_count_by_day.get(timestamp, 0) + total
                        )

    def _append_organization_project_issue_substatus_summaries(
        self, ctx: OrganizationReportContext
    ) -> None:
        with sentry_sdk.start_span(
            op="weekly_reports.organization_project_issue_substatus_summaries"
        ):
            organization_project_issue_substatus_summaries(ctx)

    def _append_project_key_errors(self, ctx: OrganizationReportContext) -> None:
        with sentry_sdk.start_span(op="weekly_reports.project_passes"):
            organization = ctx.organization
            # Run project passes
            for project in organization.project_set.all():
                key_errors = project_key_errors(
                    ctx, project, referrer=Referrer.REPORTS_KEY_ERRORS.value
                )
                if project.id not in ctx.projects_context_map:
                    continue

                project_ctx = ctx.projects_context_map[project.id]
                assert isinstance(
                    project_ctx, ProjectContext
                ), f"Expected a ProjectContext, received {type(project_ctx)}"

                if key_errors:
                    project_ctx.key_errors_by_id = [
                        (e["events.group_id"], e["count()"]) for e in key_errors
                    ]

                key_transactions_this_week = project_key_transactions_this_week(ctx, project)
                if key_transactions_this_week:
                    project_ctx.key_transactions = [
                        (i["transaction_name"], i["count"], i["p95"])
                        for i in key_transactions_this_week
                    ]
                    query_result = project_key_transactions_last_week(
                        ctx, project, key_transactions_this_week
                    )
                    # Join this week with last week
                    last_week_data = {
                        i["transaction_name"]: (i["count"], i["p95"]) for i in query_result["data"]
                    }

                    project_ctx.key_transactions = [
                        (i["transaction_name"], i["count"], i["p95"])
                        + last_week_data.get(i["transaction_name"], (0, 0))
                        for i in key_transactions_this_week
                    ]

                key_performance_issues = project_key_performance_issues(
                    ctx, project, referrer=Referrer.REPORTS_KEY_PERFORMANCE_ISSUES.value
                )
                if key_performance_issues:
                    ctx.projects_context_map[project.id].key_performance_issues = (
                        key_performance_issues
                    )

    def _hydrate_key_error_groups(self, ctx: OrganizationReportContext) -> None:
        with sentry_sdk.start_span(op="weekly_reports.fetch_key_error_groups"):
            fetch_key_error_groups(ctx)

    def _hydrate_key_performance_issue_groups(self, ctx: OrganizationReportContext) -> None:
        with sentry_sdk.start_span(op="weekly_reports.fetch_key_performance_issue_groups"):
            fetch_key_performance_issue_groups(ctx)

    def _append_project_log_data(self, ctx: OrganizationReportContext) -> None:
        with sentry_sdk.start_span(op="weekly_reports.project_log_data"):
            project_ids = list(ctx.projects_context_map.keys())

            # Query log volume timeseries
            log_counts_by_project = project_log_volume_timeseries(
                ctx, project_ids, Referrer.REPORTS_KEY_LOGS.value
            )

            for project_id, counts_by_day in log_counts_by_project.items():
                if project_id in ctx.projects_context_map:
                    project_ctx = ctx.projects_context_map[project_id]
                    if isinstance(project_ctx, ProjectContext):
                        for timestamp, count in counts_by_day.items():
                            project_ctx.log_count_by_day[timestamp] = count
                            project_ctx.accepted_log_count += count

            # Query log volume by severity
            severity_counts = project_log_volume_by_severity(
                ctx, project_ids, Referrer.REPORTS_KEY_LOGS.value
            )

            for project_id, severities in severity_counts.items():
                if project_id in ctx.projects_context_map:
                    project_ctx = ctx.projects_context_map[project_id]
                    if isinstance(project_ctx, ProjectContext):
                        project_ctx.log_volume_by_severity = severities

            # Query top error logs for each project
            for project in ctx.organization.project_set.all():
                if project.id in ctx.projects_context_map:
                    key_logs = project_key_error_logs(ctx, project, Referrer.REPORTS_KEY_LOGS.value)
                    project_ctx = ctx.projects_context_map[project.id]
                    if isinstance(project_ctx, ProjectContext) and key_logs:
                        project_ctx.key_error_logs = key_logs

    def create_context(self) -> OrganizationReportContext:
        ctx = OrganizationReportContext(self.timestamp, self.duration, self.organization)
        self._append_user_project_ownership(ctx)
        self._append_project_event_counts(ctx)
        self._append_organization_project_issue_substatus_summaries(ctx)
        self._append_project_key_errors(ctx)
        self._hydrate_key_error_groups(ctx)
        self._hydrate_key_performance_issue_groups(ctx)
        self._append_project_log_data(ctx)
        return ctx
