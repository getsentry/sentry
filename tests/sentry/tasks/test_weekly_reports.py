import copy
from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives
from django.db import router
from django.db.models import F
from django.utils import timezone as django_timezone

from sentry.constants import DataCategory
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.silo import SiloMode, unguarded_write
from sentry.tasks.weekly_reports import (
    ONE_DAY,
    OrganizationReportContext,
    deliver_reports,
    group_status_to_color,
    organization_project_issue_substatus_summaries,
    organization_project_issue_summaries,
    prepare_organization_report,
    schedule_organizations,
)
from sentry.testutils.cases import OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import floor_to_utc_day, to_timestamp
from sentry.utils.outcomes import Outcome

DISABLED_ORGANIZATIONS_USER_OPTION_KEY = "reports:disabled-organizations"


@region_silo_test
class WeeklyReportsTest(OutcomesSnubaTest, SnubaTestCase):
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_integration(self):
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        now = datetime.now().replace(tzinfo=timezone.utc)

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

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_with_empty_string_user_option(self):
        now = datetime.now().replace(tzinfo=timezone.utc)

        project = self.create_project(
            organization=self.organization, teams=[self.team], date_added=now - timedelta(days=90)
        )
        self.store_event(data={"timestamp": iso_format(before_now(days=1))}, project_id=project.id)
        member_set = set(project.teams.first().member_set.all())
        for member in member_set:
            # some users have an empty string value set for this key, presumably cleared.
            user_option_service.set_option(
                user_id=member.user_id, key="reports:disabled-organizations", value=""
            )

        with self.tasks():
            schedule_organizations(timestamp=to_timestamp(now))
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    @with_feature("organizations:customer-domains")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_message_links_customer_domains(self):
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        now = datetime.now().replace(tzinfo=timezone.utc)

        project = self.create_project(
            organization=self.organization, teams=[self.team], date_added=now - timedelta(days=90)
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(days=1)),
            },
            project_id=project.id,
        )
        with self.tasks():
            schedule_organizations(timestamp=to_timestamp(now))
            assert len(mail.outbox) == 1

            message = mail.outbox[0]
            assert isinstance(message, EmailMultiAlternatives)
            assert self.organization.name in message.subject
            html = message.alternatives[0][0]

            assert isinstance(html, str)
            assert (
                f"http://{self.organization.slug}.testserver/issues/?referrer=weekly_report" in html
            )

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_deliver_reports_respects_settings(self, mock_send_email):
        user = self.user
        organization = self.organization
        ctx = OrganizationReportContext(0, 0, organization)

        def set_option_value(value):
            with assume_test_silo_mode(SiloMode.CONTROL):
                NotificationSettingOption.objects.update_or_create(
                    scope_type="organization",
                    scope_identifier=organization.id,
                    user_id=user.id,
                    type="reports",
                    defaults={"value": value},
                )

        # disabled
        set_option_value("never")
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

        # enabled
        set_option_value("always")
        deliver_reports(ctx)
        mock_send_email.assert_called_once_with(ctx, user.id, dry_run=False)

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_member_disabled(self, mock_send_email):
        ctx = OrganizationReportContext(0, 0, self.organization)

        with unguarded_write(using=router.db_for_write(Project)):
            OrganizationMember.objects.get(user_id=self.user.id).update(
                flags=F("flags").bitor(OrganizationMember.flags["member-limit:restricted"])
            )

        # disabled
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_user_inactive(self, mock_send_email):
        ctx = OrganizationReportContext(0, 0, self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.user.update(is_active=False)

        # disabled
        deliver_reports(ctx)
        assert mock_send_email.call_count == 0

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_invited_member(self, mock_send_email):
        ctx = OrganizationReportContext(0, 0, self.organization)

        # create a member without a user
        OrganizationMember.objects.create(
            organization=self.organization, email="different.email@example.com", token="abc"
        )

        deliver_reports(ctx)
        assert mock_send_email.call_count == 1

    def test_organization_project_issue_summaries(self):
        self.login_as(user=self.user)

        now = django_timezone.now()
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
    def test_transferred_project(self, message_builder):
        self.login_as(user=self.user)

        now = django_timezone.now()
        three_days_ago = now - timedelta(days=3)

        project = self.create_project(
            organization=self.organization, teams=[self.team], name="new-project"
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
                "project_id": project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": three_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )
        project.transfer_to(organization=self.create_organization())

        prepare_organization_report(to_timestamp(now), ONE_DAY * 7, self.organization.id)
        assert message_builder.call_count == 1

    @with_feature("organizations:escalating-issues")
    def test_organization_project_issue_substatus_summaries(self):
        self.login_as(user=self.user)

        now = django_timezone.now()
        min_ago = iso_format(now - timedelta(minutes=1))

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event1.group.substatus = GroupSubStatus.ONGOING
        event1.group.save()

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save()
        timestamp = to_timestamp(now)

        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        organization_project_issue_substatus_summaries(ctx)

        project_ctx = ctx.projects[self.project.id]

        assert project_ctx.new_substatus_count == 1
        assert project_ctx.escalating_substatus_count == 0
        assert project_ctx.ongoing_substatus_count == 1
        assert project_ctx.regression_substatus_count == 0
        assert project_ctx.total_substatus_count == 2

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_message_builder_simple(self, message_builder, record):
        now = django_timezone.now()

        two_days_ago = now - timedelta(days=2)
        three_days_ago = now - timedelta(days=3)

        user = self.create_user()
        self.create_member(teams=[self.team], user=user, organization=self.organization)

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
        group1.substatus = None
        group1.resolved_at = two_days_ago
        group1.save()

        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.resolved_at = two_days_ago
        group2.save()

        prepare_organization_report(to_timestamp(now), ONE_DAY * 7, self.organization.id)

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "all_issue_count": 2,
                "existing_issue_count": 0,
                "new_issue_count": 2,
                "reopened_issue_count": 0,
                # New escalating-issues
                "escalating_substatus_count": 0,
                "new_substatus_count": 0,
                "ongoing_substatus_count": 0,
                "regression_substatus_count": 0,
                "total_substatus_count": 0,
            }
            assert len(context["key_errors"]) == 2
            assert context["trends"]["total_error_count"] == 2
            assert context["trends"]["total_transaction_count"] == 10
            assert "Weekly Report for" in message_params["subject"]

            assert isinstance(context["notification_uuid"], str)

        record.assert_any_call(
            "weekly_report.sent",
            user_id=user.id,
            organization_id=self.organization.id,
            notification_uuid=mock.ANY,
            user_project_count=1,
        )

    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    @with_feature("organizations:escalating-issues")
    def test_message_builder_substatus_simple(self, message_builder):
        now = django_timezone.now()
        three_days_ago = now - timedelta(days=3)

        self.create_member(
            teams=[self.team], user=self.create_user(), organization=self.organization
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
        group1.substatus = GroupSubStatus.NEW
        group1.save()

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
        group2 = event2.group
        group2.substatus = GroupSubStatus.ONGOING
        group2.save()

        prepare_organization_report(to_timestamp(now), ONE_DAY * 7, self.organization.id)

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "all_issue_count": 0,
                "existing_issue_count": 0,
                "new_issue_count": 0,
                "reopened_issue_count": 0,
                "escalating_substatus_count": 0,
                "new_substatus_count": 1,
                "ongoing_substatus_count": 1,
                "regression_substatus_count": 0,
                "total_substatus_count": 2,
            }

    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_message_builder_advanced(self, message_builder):
        now = django_timezone.now()
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
        group1.substatus = None
        group1.resolved_at = two_days_ago
        group1.save()

        prepare_organization_report(timestamp, ONE_DAY * 7, self.organization.id)

        message_params = message_builder.call_args.kwargs
        ctx = message_params["context"]

        assert ctx["trends"]["legend"][0] == {
            "slug": "bar",
            "url": f"http://testserver/organizations/baz/issues/?referrer=weekly_report&notification_uuid={ctx['notification_uuid']}&project={self.project.id}",
            "color": "#422C6E",
            "dropped_error_count": 2,
            "accepted_error_count": 1,
            "accepted_replay_count": 0,
            "dropped_replay_count": 0,
            "dropped_transaction_count": 9,
            "accepted_transaction_count": 3,
        }

        assert ctx["trends"]["series"][-2][1][0] == {
            "color": "#422C6E",
            "error_count": 1,
            "replay_count": 0,
            "transaction_count": 3,
        }

    @mock.patch("sentry.tasks.weekly_reports.send_email")
    def test_empty_report(self, mock_send_email):
        now = django_timezone.now()

        # date is out of range
        ten_days_ago = now - timedelta(days=10)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": iso_format(ten_days_ago),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        prepare_organization_report(to_timestamp(now), ONE_DAY * 7, self.organization.id)
        assert mock_send_email.call_count == 0

    @with_feature("organizations:session-replay")
    @with_feature("organizations:session-replay-weekly_report")
    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_message_builder_replays(self, message_builder):
        now = django_timezone.now()
        two_days_ago = now - timedelta(days=2)
        timestamp = to_timestamp(floor_to_utc_day(now))

        for outcome, category, num in [
            (Outcome.ACCEPTED, DataCategory.REPLAY, 6),
            (Outcome.RATE_LIMITED, DataCategory.REPLAY, 7),
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

        prepare_organization_report(timestamp, ONE_DAY * 7, self.organization.id)

        message_params = message_builder.call_args.kwargs
        ctx = message_params["context"]

        assert ctx["trends"]["legend"][0] == {
            "slug": "bar",
            "url": f"http://testserver/organizations/baz/issues/?referrer=weekly_report&notification_uuid={ctx['notification_uuid']}&project={self.project.id}",
            "color": "#422C6E",
            "dropped_error_count": 0,
            "accepted_error_count": 0,
            "accepted_replay_count": 6,
            "dropped_replay_count": 7,
            "dropped_transaction_count": 0,
            "accepted_transaction_count": 0,
        }

        assert ctx["trends"]["series"][-2][1][0] == {
            "color": "#422C6E",
            "error_count": 0,
            "replay_count": 6,
            "transaction_count": 0,
        }

    def test_group_status_to_color_obj_correct_length(self):
        # We want to check for the values because GroupHistoryStatus.UNRESOVED and GroupHistoryStatus.ONGOING have the same value
        enum_values = set()
        for attr_name in dir(GroupHistoryStatus):
            if not callable(getattr(GroupHistoryStatus, attr_name)) and not attr_name.startswith(
                "__"
            ):
                enum_value = getattr(GroupHistoryStatus, attr_name)
                enum_values.add(enum_value)

        unique_enum_count = len(enum_values)
        assert len(group_status_to_color) == unique_enum_count

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_email_override_simple(self, message_builder, record):
        now = django_timezone.now()
        two_days_ago = now - timedelta(days=2)
        timestamp = to_timestamp(floor_to_utc_day(now))

        user = self.create_user(email="itwasme@dio.xyz")
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        extra_team = self.create_team(organization=self.organization)
        self.create_project(
            teams=[extra_team]
        )  # create an extra project to ensure our email only gets the user's project

        # fill with data so report not skipped
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": two_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )

        prepare_organization_report(
            timestamp,
            ONE_DAY * 7,
            self.organization.id,
            dry_run=False,
            target_user=user,
            email_override="joseph@speedwagon.org",
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == self.organization
            assert context["user_project_count"] == 1
            assert f"Weekly Report for {self.organization.name}" in message_params["subject"]

        with pytest.raises(AssertionError):
            record.assert_any_call(
                "weekly_report.sent",
                user_id=user.id,
                organization_id=self.organization.id,
                notification_uuid=mock.ANY,
                user_project_count=1,
            )

        message_builder.return_value.send.assert_called_with(to=("joseph@speedwagon.org",))

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_email_override_no_target_user(self, message_builder, record):
        now = django_timezone.now()
        two_days_ago = now - timedelta(days=2)
        timestamp = to_timestamp(floor_to_utc_day(now))

        # create some extra projects; we expect to receive a report with all projects included
        self.create_project(organization=self.organization)
        self.create_project(organization=self.organization)

        # fill with data so report not skipped
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": two_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )

        prepare_organization_report(
            timestamp,
            ONE_DAY * 7,
            self.organization.id,
            dry_run=False,
            target_user=None,
            email_override="jonathan@speedwagon.org",
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == self.organization
            assert context["user_project_count"] == 3

        with pytest.raises(AssertionError):
            record.assert_any_call(
                "weekly_report.sent",
                user_id=None,
                organization_id=self.organization.id,
                notification_uuid=mock.ANY,
                user_project_count=1,
            )

        message_builder.return_value.send.assert_called_with(to=("jonathan@speedwagon.org",))

    @mock.patch("sentry.tasks.weekly_reports.logger")
    def test_email_override_invalid_target_user(self, logger):
        now = django_timezone.now()
        two_days_ago = now - timedelta(days=2)
        timestamp = to_timestamp(floor_to_utc_day(now))
        org = self.create_organization()
        proj = self.create_project(organization=org)

        # fill with data so report not skipped
        self.store_outcomes(
            {
                "org_id": org.id,
                "project_id": proj.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": two_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )

        prepare_organization_report(
            timestamp,
            ONE_DAY * 7,
            org.id,
            dry_run=False,
            target_user="dummy",
            email_override="doesntmatter@smad.com",
        )

        logger.error.assert_called_with(
            "Target user must have an ID",
            extra={
                "organization": org.id,
                "target_user": "dummy",
                "email_override": "doesntmatter@smad.com",
            },
        )

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.weekly_reports.MessageBuilder")
    def test_dry_run_simple(self, message_builder, record):
        now = django_timezone.now()
        two_days_ago = now - timedelta(days=2)
        timestamp = to_timestamp(floor_to_utc_day(now))
        org = self.create_organization()
        proj = self.create_project(organization=org)

        # fill with data so report not skipped
        self.store_outcomes(
            {
                "org_id": org.id,
                "project_id": proj.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": two_days_ago,
                "key_id": 1,
            },
            num_times=2,
        )

        prepare_organization_report(
            timestamp,
            ONE_DAY * 7,
            org.id,
            dry_run=True,
            target_user=None,
            email_override="doesntmatter@smad.com",
        )

        with pytest.raises(AssertionError):
            record.assert_any_call(
                "weekly_report.sent",
                user_id=None,
                organization_id=self.organization.id,
                notification_uuid=mock.ANY,
                user_project_count=1,
            )

        message_builder.return_value.send.assert_not_called()
