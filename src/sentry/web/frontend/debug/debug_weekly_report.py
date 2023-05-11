import time
from datetime import datetime, timedelta
from random import Random

from django.template.defaultfilters import slugify
from django.utils import timezone

from sentry.models import Group, Organization, Project
from sentry.tasks.weekly_reports import (
    ONE_DAY,
    GroupInbox,
    GroupInboxReason,
    OrganizationReportContext,
    ProjectContext,
    render_template_context,
)
from sentry.utils import loremipsum
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp

from .mail import MailPreviewView

DEBUG_ESCALATING_ISSUES = False


def get_random(request):
    seed = request.GET.get("seed", str(time.time()))
    return Random(seed)


class DebugWeeklyReportView(MailPreviewView):
    def get_context(self, request):
        organization = Organization(id=1, slug="myorg", name="MyOrg")

        random = get_random(request)

        duration = 60 * 60 * 24 * 7
        timestamp = to_timestamp(
            floor_to_utc_day(
                to_datetime(
                    random.randint(
                        to_timestamp(datetime(2015, 6, 1, 0, 0, 0, tzinfo=timezone.utc)),
                        to_timestamp(datetime(2016, 7, 1, 0, 0, 0, tzinfo=timezone.utc)),
                    )
                )
            )
        )
        ctx = OrganizationReportContext(timestamp, duration, organization)
        ctx.projects.clear()

        start_timestamp = to_timestamp(ctx.start)

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
            project_context.transaction_count_by_day = {
                start_timestamp + (i * ONE_DAY): random.randint(0, daily_maximum)
                for i in range(0, 7)
            }
            project_context.accepted_transaction_count = sum(
                project_context.transaction_count_by_day.values()
            )
            project_context.accepted_error_count = sum(project_context.error_count_by_day.values())
            project_context.dropped_error_count = int(
                random.weibullvariate(5, 1) * random.paretovariate(0.2)
            )
            project_context.dropped_transaction_count = int(
                random.weibullvariate(5, 1) * random.paretovariate(0.2)
            )
            group_inbox = (
                GroupInbox(reason=GroupInboxReason.ESCALATING) if DEBUG_ESCALATING_ISSUES else None
            )
            project_context.key_errors = [
                (g, None, group_inbox, random.randint(0, 1000)) for g in Group.objects.all()[:3]
            ]

            if DEBUG_ESCALATING_ISSUES:
                # For organizations:issue-states
                project_context.new_inbox_count = random.randint(5, 200)
                project_context.escalating_inbox_count = random.randint(5, 200)
                project_context.regression_inbox_count = random.randint(5, 200)
                project_context.ongoing_inbox_count = random.randint(20, 3000)
                project_context.total_inbox_count = (
                    project_context.new_inbox_count
                    + project_context.escalating_inbox_count
                    + project_context.regression_inbox_count
                    + project_context.ongoing_inbox_count
                )
            else:
                # Removed after organizations:issue-states GA
                project_context.existing_issue_count = random.randint(0, 10000)
                project_context.reopened_issue_count = random.randint(0, 1000)
                project_context.new_issue_count = random.randint(0, 1000)
                project_context.all_issue_count = (
                    project_context.existing_issue_count
                    + project_context.reopened_issue_count
                    + project_context.new_issue_count
                )

            # Array of (transaction_name, count_this_week, p95_this_week, count_last_week, p95_last_week)
            project_context.key_transactions = [
                (
                    f"/test/transaction{random.randint(0, 3)}",
                    random.randint(0, 1000),
                    random.random() * 100,
                    random.randint(0, 1000),
                    random.random() * 100,
                )
                for _ in range(0, 3)
            ]
            project_context.key_performance_issues = [
                (g, None, random.randint(0, 1000))
                for g in Group.objects.filter(type__gte=1000, type__lt=2000).all()[:3]
            ]
            ctx.projects[project.id] = project_context

        return render_template_context(ctx, None)

    @property
    def html_template(self):
        return "sentry/emails/reports/body.html"

    @property
    def text_template(self):
        return "sentry/emails/reports/body.txt"
