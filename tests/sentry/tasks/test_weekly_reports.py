import copy
import functools
from datetime import datetime, timedelta
from unittest import mock

import pytz
from django.core import mail
from django.db.models import F
from django.utils import timezone
from freezegun import freeze_time

from sentry.constants import DataCategory
from sentry.models import GroupStatus, OrganizationMember, Project, UserOption
from sentry.tasks.weekly_reports import (
    ONE_DAY,
    OrganizationReportContext,
    deliver_reports,
    organization_project_issue_summaries,
    prepare_organization_report,
    schedule_organizations,
)
from sentry.testutils.cases import OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.dates import floor_to_utc_day, to_timestamp
from sentry.utils.outcomes import Outcome

DISABLED_ORGANIZATIONS_USER_OPTION_KEY = "reports:disabled-organizations"


class WeeklyReportsTest(OutcomesSnubaTest, SnubaTestCase):
    @with_feature("organizations:weekly-email-refresh")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_integration(self):
        Project.objects.all().delete()

        now = datetime.now().replace(tzinfo=pytz.utc)

        project = self.create_project(
            organization=self.organization, teams=[self.team], date_added=now - timedelta(days=90)
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(days=1)),
            },
            project_id=project.id,
        )

        member_set = set(project.teams.first().member_set.all())

        with self.tasks():
            schedule_organizations(timestamp=to_timestamp(now))
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_deliver_reports_respects_settings(self, mock_send_email):
        user = self.user
        organization = self.organization
        ctx = OrganizationReportContext(0, 0, organization)

        set_option_value = functools.partial(
            UserOption.objects.set_value, user, DISABLED_ORGANIZATIONS_USER_OPTION_KEY
        )

        # disabled
        set_option_value([organization.id])
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

        # enabled
        set_option_value([])
        deliver_reports(ctx)
        mock_send_email.assert_called_once_with(ctx, user, dry_run=False)

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_member_disabled(self, mock_send_email):
        ctx = OrganizationReportContext(0, 0, self.organization)

        OrganizationMember.objects.filter(user=self.user).update(
            flags=F("flags").bitor(OrganizationMember.flags["member-limit:restricted"])
        )

        # disabled
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_user_inactive(self, mock_send_email):
        ctx = OrganizationReportContext(0, 0, self.organization)

        self.user.update(is_active=False)

        # disabled
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

    def test_organization_project_issue_summaries(self):
        self.login_as(user=self.user)

        now = timezone.now()
        min_ago = iso_format(now - timedelta(minutes=1))

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        timestamp = to_timestamp(now)

        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        organization_project_issue_summaries(ctx)

        project_ctx = ctx.projects[self.project.id]

        assert project_ctx.reopened_issue_count == 0
        assert project_ctx.new_issue_count == 2
        assert project_ctx.existing_issue_count == 0
        assert project_ctx.all_issue_count == 2

    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_message_builder_simple(self, message_builder):
        now = timezone.now()

        two_days_ago = now - timedelta(days=2)
        three_days_ago = now - timedelta(days=3)

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": iso_format(three_days_ago),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": iso_format(three_days_ago),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": three_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )

        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.TRANSACTION,
                "timestamp": three_days_ago,
                "key_id": 1,
            },
            num_times=10,
        )

        group1 = event1.group
        group2 = event2.group

        group1.status = GroupStatus.RESOLVED
        group1.resolved_at = two_days_ago
        group1.save()

        group2.status = GroupStatus.RESOLVED
        group2.resolved_at = two_days_ago
        group2.save()

        prepare_organization_report(to_timestamp(now), ONE_DAY * 7, self.organization.id)

        message_params = message_builder.call_args.kwargs
        context = message_params["context"]

        assert message_params["template"] == "sentry/emails/reports/new.txt"
        assert message_params["html_template"] == "sentry/emails/reports/new.html"

        assert context["organization"] == self.organization
        assert context["issue_summary"] == {
            "all_issue_count": 2,
            "existing_issue_count": 0,
            "new_issue_count": 2,
            "reopened_issue_count": 0,
        }
        assert context["trends"]["total_error_count"] == 2
        assert context["trends"]["total_transaction_count"] == 10
        assert "Weekly Report for" in message_params["subject"]

    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_message_builder_advanced(self, message_builder):

        now = timezone.now()
        two_days_ago = now - timedelta(days=2)
        three_days_ago = now - timedelta(days=3)

        timestamp = to_timestamp(floor_to_utc_day(now))

        for outcome, category, num in [
            (Outcome.ACCEPTED, DataCategory.ERROR, 1),
            (Outcome.RATE_LIMITED, DataCategory.ERROR, 2),
            (Outcome.ACCEPTED, DataCategory.TRANSACTION, 3),
            (Outcome.RATE_LIMITED, DataCategory.TRANSACTION, 4),
            # Filtered should be ignored in these emails
            (Outcome.FILTERED, DataCategory.TRANSACTION, 5),
        ]:
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome,
                    "category": category,
                    "timestamp": two_days_ago,
                    "key_id": 1,
                },
                num_times=num,
            )

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": iso_format(three_days_ago),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        group1 = event1.group

        group1.status = GroupStatus.RESOLVED
        group1.resolved_at = two_days_ago
        group1.save()

        prepare_organization_report(timestamp, ONE_DAY * 7, self.organization.id)

        message_params = message_builder.call_args.kwargs
        ctx = message_params["context"]

        assert ctx["trends"]["legend"][0] == {
            "slug": "bar",
            "url": f"http://testserver/organizations/baz/issues/?project={self.project.id}",
            "color": "#422C6E",
            "dropped_error_count": 2,
            "accepted_error_count": 1,
            "dropped_transaction_count": 9,
            "accepted_transaction_count": 3,
        }

        assert ctx["trends"]["series"][-2][1][0] == {
            "color": "#422C6E",
            "error_count": 1,
            "transaction_count": 3,
        }
