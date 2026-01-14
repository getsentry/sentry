import zoneinfo
from datetime import timedelta
from typing import cast
from unittest import mock

import pytest
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives
from django.db import router
from django.db.models import F
from django.utils import timezone

from sentry.analytics.events.weekly_report import WeeklyReportSent
from sentry.constants import DataCategory
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.team import TeamStatus
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.snuba.referrer import Referrer
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    OrganizationReportContext,
    ProjectContext,
    organization_project_issue_substatus_summaries,
    project_key_errors,
    user_project_ownership,
)
from sentry.tasks.summaries.weekly_reports import (
    OrganizationReportBatch,
    date_format,
    group_status_to_color,
    prepare_organization_report,
    prepare_template_context,
    schedule_organizations,
)
from sentry.testutils.cases import OutcomesSnubaTest, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.group import GroupSubStatus
from sentry.users.models.user_option import UserOption
from sentry.users.services.user_option import user_option_service
from sentry.utils import redis
from sentry.utils.dates import floor_to_utc_day, to_datetime
from sentry.utils.outcomes import Outcome

DISABLED_ORGANIZATIONS_USER_OPTION_KEY = "reports:disabled-organizations"


class WeeklyReportsTest(OutcomesSnubaTest, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.timestamp = floor_to_utc_day(self.now).timestamp()
        self.two_days_ago = self.now - timedelta(days=2)
        self.three_days_ago = self.now - timedelta(days=3)

    _dummy_batch_id = "20bd6c5b-7fac-4f31-9548-d6f8bb63226d"

    def store_event_outcomes(
        self,
        organization_id,
        project_id,
        timestamp,
        num_times,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
    ):
        self.store_outcomes(
            {
                "org_id": organization_id,
                "project_id": project_id,
                "outcome": outcome,
                "category": category,
                "timestamp": timestamp,
                "key_id": 1,
            },
            num_times=num_times,
        )

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_integration(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()
        project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            date_added=self.now - timedelta(days=90),
        )
        member_set = set(project.teams.get().member_set.all())
        self.store_event(
            data={
                "timestamp": before_now(days=1).isoformat(),
            },
            project_id=project.id,
        )

        with self.tasks():
            schedule_organizations(timestamp=self.now.timestamp())
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_with_empty_string_user_option(self) -> None:
        project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            date_added=self.now - timedelta(days=90),
        )
        self.store_event(data={"timestamp": before_now(days=1).isoformat()}, project_id=project.id)
        member_set = set(project.teams.get().member_set.all())
        for member in member_set:
            # some users have an empty string value set for this key, presumably cleared.
            user_option_service.set_option(
                user_id=member.user_id, key="reports:disabled-organizations", value=""
            )

        with self.tasks():
            schedule_organizations(timestamp=self.now.timestamp())
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    @with_feature("system:multi-region")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_message_links_customer_domains(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            date_added=self.now - timedelta(days=90),
        )
        self.store_event(
            data={
                "timestamp": before_now(days=1).isoformat(),
            },
            project_id=project.id,
        )
        with self.tasks():
            schedule_organizations(timestamp=self.now.timestamp())
            assert len(mail.outbox) == 1

            message = mail.outbox[0]
            assert isinstance(message, EmailMultiAlternatives)
            assert self.organization.name in message.subject
            html = message.alternatives[0][0]

            assert isinstance(html, str)
            assert (
                f"http://{self.organization.slug}.testserver/issues/?referrer=weekly_report" in html
            )

    def _set_option_value(self, value):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.update_or_create(
                scope_type="organization",
                scope_identifier=self.organization.id,
                user_id=self.user.id,
                type="reports",
                defaults={"value": value},
            )

    def _set_timezone(self, user, value):
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.set_value(user=user, key="timezone", value=value)

    @mock.patch("sentry.tasks.summaries.weekly_reports.prepare_template_context")
    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_deliver_reports_respects_settings(
        self, mock_send_email, mock_prepare_template_context
    ):
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(0, 0, organization=self.organization)
        user_project_ownership(ctx)
        template_context = prepare_template_context(ctx, [self.user.id])
        mock_prepare_template_context.return_value = template_context
        batch_id = "77a1d368-33d5-47cd-88cf-d66c97b38333"

        # disabled
        self._set_option_value("never")
        OrganizationReportBatch(ctx, batch_id).deliver_reports()
        assert mock_send_email.call_count == 0

        # enabled
        self._set_option_value("always")
        OrganizationReportBatch(ctx, batch_id).deliver_reports()
        assert mock_send_email.call_count == 1
        mock_send_email.assert_called_once_with(
            template_ctx=template_context[0].get("context"),
            user_id=template_context[0].get("user_id"),
        )

    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_member_disabled(self, mock_send_email: mock.MagicMock) -> None:
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(0, 0, self.organization)
        user_project_ownership(ctx)

        with unguarded_write(using=router.db_for_write(Project)):
            OrganizationMember.objects.get(user_id=self.user.id).update(
                flags=F("flags").bitor(OrganizationMember.flags["member-limit:restricted"])
            )

        # disabled
        OrganizationReportBatch(ctx, self._dummy_batch_id).deliver_reports()
        assert mock_send_email.call_count == 0

    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_user_inactive(self, mock_send_email: mock.MagicMock) -> None:
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(0, 0, self.organization)
        user_project_ownership(ctx)

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.user.update(is_active=False)

        # disabled
        OrganizationReportBatch(ctx, self._dummy_batch_id).deliver_reports()
        assert mock_send_email.call_count == 0

    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_invited_member(self, mock_send_email: mock.MagicMock) -> None:
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(0, 0, self.organization)
        user_project_ownership(ctx)

        # create a member without a user
        OrganizationMember.objects.create(
            organization=self.organization, email="different.email@example.com", token="abc"
        )

        OrganizationReportBatch(ctx, self._dummy_batch_id).deliver_reports()
        assert mock_send_email.call_count == 1

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_transferred_project(self, message_builder: mock.MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.create_project(
            organization=self.organization, teams=[self.team], name="new-project"
        )
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.three_days_ago, num_times=2
        )
        self.store_event_outcomes(
            self.organization.id, project.id, self.three_days_ago, num_times=2
        )
        project.transfer_to(organization=self.create_organization())

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )
        assert message_builder.call_count == 1

    @with_feature("organizations:escalating-issues")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_organization_project_issue_substatus_summaries(self) -> None:
        self.login_as(user=self.user)
        min_ago = (self.now - timedelta(minutes=1)).isoformat()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event1.group.substatus = GroupSubStatus.ONGOING
        event1.group.save()

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save()
        timestamp = self.now.timestamp()

        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)
        organization_project_issue_substatus_summaries(ctx)

        project_ctx = cast(ProjectContext, ctx.projects_context_map[self.project.id])

        assert project_ctx.new_substatus_count == 1
        assert project_ctx.escalating_substatus_count == 0
        assert project_ctx.ongoing_substatus_count == 1
        assert project_ctx.regression_substatus_count == 0
        assert project_ctx.total_substatus_count == 2

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_organization_project_issue_status(self) -> None:
        self.login_as(user=self.user)
        self.project.first_event = self.now - timedelta(days=3)
        min_ago = (self.now - timedelta(minutes=1)).isoformat()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group2 = event2.group
        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.resolved_at = self.now - timedelta(minutes=1)
        group2.save()

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)
        key_errors = project_key_errors(ctx, self.project, Referrer.REPORTS_KEY_ERRORS.value)
        assert key_errors == [{"events.group_id": event1.group.id, "count()": 1}]

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_simple(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        user = self.create_user()
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.three_days_ago, num_times=2
        )
        self.store_event_outcomes(
            self.organization.id,
            self.project.id,
            self.three_days_ago,
            num_times=10,
            category=DataCategory.TRANSACTION,
        )

        group1 = event1.group
        group2 = event2.group

        group1.status = GroupStatus.RESOLVED
        group1.substatus = None
        group1.resolved_at = self.two_days_ago
        group1.save()

        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.resolved_at = self.two_days_ago
        group2.save()
        perf_event_1 = self.create_performance_issue(
            fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group1"
        )
        perf_event_2 = self.create_performance_issue(
            fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group2"
        )
        assert perf_event_1.group is not None
        assert perf_event_2.group is not None
        perf_event_1.group.update(substatus=GroupSubStatus.ONGOING)
        perf_event_2.group.update(substatus=GroupSubStatus.ONGOING)

        # store a crons issue just to make sure it's not counted in key_performance_issues
        self.create_group(type=MonitorIncidentType.type_id)

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "escalating_substatus_count": 0,
                "new_substatus_count": 0,
                "ongoing_substatus_count": 2,
                "regression_substatus_count": 0,
                "total_substatus_count": 2,
            }
            assert len(context["key_errors"]) == 0
            assert len(context["key_performance_issues"]) == 2
            assert context["trends"]["total_error_count"] == 2
            assert context["trends"]["total_transaction_count"] == 10
            assert "Weekly Report for" in message_params["subject"]

            assert isinstance(context["notification_uuid"], str)

        assert_any_analytics_event(
            record,
            WeeklyReportSent(
                user_id=user.id,
                organization_id=self.organization.id,
                notification_uuid="mock.ANY",
                user_project_count=1,
            ),
            exclude_fields=["notification_uuid"],
        )

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_filter_resolved(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        """Test that we filter resolved issues out of key errors"""
        user = self.create_user()
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.three_days_ago, num_times=2
        )
        self.store_event_outcomes(
            self.organization.id,
            self.project.id,
            self.three_days_ago,
            num_times=10,
            category=DataCategory.TRANSACTION,
        )

        self.create_performance_issue(fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group1")
        self.create_performance_issue(fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group2")

        # store a crons issue just to make sure it's not counted in key_performance_issues
        self.create_group(type=MonitorIncidentType.type_id)
        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "escalating_substatus_count": 0,
                "new_substatus_count": 4,
                "ongoing_substatus_count": 0,
                "regression_substatus_count": 0,
                "total_substatus_count": 4,
            }
            assert len(context["key_errors"]) == 2
            assert len(context["key_performance_issues"]) == 2
            assert context["trends"]["total_error_count"] == 2
            assert context["trends"]["total_transaction_count"] == 10
            assert "Weekly Report for" in message_params["subject"]

            assert isinstance(context["notification_uuid"], str)

        assert_any_analytics_event(
            record,
            WeeklyReportSent(
                user_id=user.id,
                organization_id=self.organization.id,
                notification_uuid="mock.ANY",
                user_project_count=1,
            ),
            exclude_fields=["notification_uuid"],
        )

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_filter_to_error_level(self, message_builder: mock.MagicMock) -> None:
        """Test that we filter non-error level issues out of key errors"""
        user = self.create_user()
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
                "level": "info",
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-2"],
                "level": "error",
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.three_days_ago, num_times=2
        )
        self.store_event_outcomes(
            self.organization.id,
            self.project.id,
            self.three_days_ago,
            num_times=10,
            category=DataCategory.TRANSACTION,
        )

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "escalating_substatus_count": 0,
                "new_substatus_count": 2,
                "ongoing_substatus_count": 0,
                "regression_substatus_count": 0,
                "total_substatus_count": 2,
            }
            assert len(context["key_errors"]) == 1

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_multiple_users_prevent_resend(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        user = self.create_user()
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        user2 = self.create_user()
        self.create_member(teams=[self.team], user=user2, organization=self.organization)

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.three_days_ago, num_times=2
        )
        self.store_event_outcomes(
            self.organization.id,
            self.project.id,
            self.three_days_ago,
            num_times=10,
            category=DataCategory.TRANSACTION,
        )

        group1 = event1.group
        group2 = event2.group

        group1.status = GroupStatus.RESOLVED
        group1.substatus = None
        group1.resolved_at = self.two_days_ago
        group1.save()

        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.resolved_at = self.two_days_ago
        group2.save()

        # TODO(RyanSkonnord): Make sure this doesn't cause false negatives after
        #  batch IDs are also used to prevent duplicate sends
        batch_id = "ea18c80c-d44f-48a4-8973-b0daa3169c44"

        with (
            mock.patch(
                "sentry.tasks.summaries.weekly_reports.prepare_template_context",
                side_effect=ValueError("oh no!"),
            ),
            mock.patch(
                "sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email"
            ) as mock_send_email,
        ):
            with pytest.raises(Exception):
                prepare_organization_report(
                    self.now.timestamp(), ONE_DAY * 7, self.organization.id, batch_id
                )
                mock_send_email.assert_not_called()

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, batch_id
        )
        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "escalating_substatus_count": 0,
                "new_substatus_count": 0,
                "ongoing_substatus_count": 0,
                "regression_substatus_count": 0,
                "total_substatus_count": 0,
            }
            assert len(context["key_errors"]) == 0
            assert context["trends"]["total_error_count"] == 2
            assert context["trends"]["total_transaction_count"] == 10
            assert "Weekly Report for" in message_params["subject"]

            assert isinstance(context["notification_uuid"], str)

        assert_any_analytics_event(
            record,
            WeeklyReportSent(
                user_id=user.id,
                organization_id=self.organization.id,
                notification_uuid="mock.ANY",
                user_project_count=1,
            ),
            exclude_fields=["notification_uuid"],
        )
        assert_any_analytics_event(
            record,
            WeeklyReportSent(
                user_id=user2.id,
                organization_id=self.organization.id,
                notification_uuid="mock.ANY",
                user_project_count=1,
            ),
            exclude_fields=["notification_uuid"],
        )

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    @with_feature("organizations:escalating-issues")
    def test_message_builder_substatus_simple(self, message_builder: mock.MagicMock) -> None:
        self.create_member(
            teams=[self.team], user=self.create_user(), organization=self.organization
        )
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group1 = event1.group
        group1.substatus = GroupSubStatus.NEW
        group1.save()

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group2 = event2.group
        group2.substatus = GroupSubStatus.ONGOING
        group2.save()

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert message_params["template"] == "sentry/emails/reports/body.txt"
            assert message_params["html_template"] == "sentry/emails/reports/body.html"

            assert context["organization"] == self.organization
            assert context["issue_summary"] == {
                "escalating_substatus_count": 0,
                "new_substatus_count": 1,
                "ongoing_substatus_count": 1,
                "regression_substatus_count": 0,
                "total_substatus_count": 2,
            }

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_advanced(self, message_builder: mock.MagicMock) -> None:
        for outcome, category, num in [
            (Outcome.ACCEPTED, DataCategory.ERROR, 1),
            (Outcome.RATE_LIMITED, DataCategory.ERROR, 2),
            (Outcome.ACCEPTED, DataCategory.TRANSACTION, 3),
            (Outcome.RATE_LIMITED, DataCategory.TRANSACTION, 4),
            # Filtered should be ignored in these emails
            (Outcome.FILTERED, DataCategory.TRANSACTION, 5),
        ]:
            self.store_event_outcomes(
                self.organization.id,
                self.project.id,
                self.two_days_ago,
                num_times=num,
                outcome=outcome,
                category=category,
            )

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.three_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        group1 = event1.group
        group1.status = GroupStatus.RESOLVED
        group1.substatus = None
        group1.resolved_at = self.two_days_ago
        group1.save()

        prepare_organization_report(
            self.timestamp, ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

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
            "dropped_log_count": 0,
            "accepted_log_count": 0,
        }

        assert ctx["trends"]["series"][-2][1][0] == {
            "color": "#422C6E",
            "error_count": 1,
            "replay_count": 0,
            "transaction_count": 3,
            "log_count": 0,
        }

    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_empty_report(self, mock_send_email: mock.MagicMock) -> None:
        # date is out of range
        ten_days_ago = self.now - timedelta(days=10)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": ten_days_ago.isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )

        prepare_organization_report(
            self.now.timestamp(), ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )
        assert mock_send_email.call_count == 0

    @with_feature("organizations:session-replay")
    @with_feature("organizations:session-replay-weekly_report")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_replays(self, message_builder: mock.MagicMock) -> None:
        for outcome, category, num in [
            (Outcome.ACCEPTED, DataCategory.REPLAY, 6),
            (Outcome.RATE_LIMITED, DataCategory.REPLAY, 7),
        ]:
            self.store_event_outcomes(
                self.organization.id,
                self.project.id,
                self.two_days_ago,
                num_times=num,
                outcome=outcome,
                category=category,
            )

        prepare_organization_report(
            self.timestamp, ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

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

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_message_builder_timezone(self, message_builder: mock.MagicMock) -> None:
        # fill with data so report not skipped
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )

        self._set_timezone(self.user, "US/Pacific")

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            self.organization.id,
            self._dummy_batch_id,
            dry_run=False,
            target_user=self.user.id,
        )

        utc_start = to_datetime(self.timestamp - ONE_DAY * 7)
        utc_end = to_datetime(self.timestamp)

        local_timezone = zoneinfo.ZoneInfo("US/Pacific")
        local_start = date_format(utc_start.astimezone(local_timezone))
        local_end = date_format(utc_end.astimezone(local_timezone))

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == self.organization
            assert context["user_project_count"] == 1
            assert context["start"] == local_start
            assert context["end"] == local_end
            assert f"Weekly Report for {self.organization.name}" in message_params["subject"]
            assert local_start in message_params["subject"]

    def test_group_status_to_color_obj_correct_length(self) -> None:
        # We want to check for the values because GroupHistoryStatus.UNRESOLVED and GroupHistoryStatus.ONGOING have the same value
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
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_email_override_simple(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        user = self.create_user(email="itwasme@dio.xyz")
        user_id = user.id
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        extra_team = self.create_team(organization=self.organization)
        # create an extra project to ensure our email only gets the user's project
        self.create_project(teams=[extra_team])
        # fill with data so report not skipped
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            self.organization.id,
            self._dummy_batch_id,
            dry_run=False,
            target_user=user_id,
            email_override="joseph@speedwagon.org",
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == self.organization
            assert context["user_project_count"] == 1
            assert f"Weekly Report for {self.organization.name}" in message_params["subject"]

        with pytest.raises(AssertionError):
            assert_any_analytics_event(
                record,
                WeeklyReportSent(
                    user_id=user.id,
                    organization_id=self.organization.id,
                    notification_uuid="mock.ANY",
                    user_project_count=1,
                ),
            )

        message_builder.return_value.send.assert_called_with(to=("joseph@speedwagon.org",))

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_user_with_team_and_no_projects(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        user = self.create_user(email="itwasme@dio.xyz")
        user_id = user.id
        extra_team = self.create_team(organization=organization, members=[])
        self.create_member(teams=[extra_team], user=user, organization=organization)

        self.store_event_outcomes(organization.id, project.id, self.two_days_ago, num_times=2)

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            organization.id,
            self._dummy_batch_id,
            dry_run=False,
            target_user=user_id,
        )

        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]

            assert context["organization"] == organization
            assert context["user_project_count"] == 0
            assert f"Weekly Report for {organization.name}" in message_params["subject"]

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_email_override_no_target_user(
        self, message_builder: mock.MagicMock, record: mock.MagicMock
    ) -> None:
        # create some extra projects; we expect to receive a report with all projects included
        self.create_project(organization=self.organization)
        self.create_project(organization=self.organization)
        # fill with data so report not skipped
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            self.organization.id,
            self._dummy_batch_id,
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
            assert_any_analytics_event(
                record,
                WeeklyReportSent(
                    user_id=None,
                    organization_id=self.organization.id,
                    notification_uuid="mock.ANY",
                    user_project_count=1,
                ),
            )

            message_builder.return_value.send.assert_called_with(to=("jonathan@speedwagon.org",))

    @mock.patch("sentry.tasks.summaries.weekly_reports.logger")
    def test_email_override_invalid_target_user(self, logger: mock.MagicMock) -> None:
        org = self.create_organization()
        proj = self.create_project(organization=org)
        # fill with data so report not skipped
        self.store_event_outcomes(org.id, proj.id, self.two_days_ago, num_times=2)

        batch_id = "ef61f1d1-41a3-4530-8160-615466937076"
        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            org.id,
            batch_id=batch_id,
            dry_run=False,
            target_user="dummy",
            email_override="doesntmatter@smad.com",
        )

        logger.error.assert_called_with(
            "Target user must have an ID",
            extra={
                "batch_id": str(batch_id),
                "organization": org.id,
                "target_user": "dummy",
                "email_override": "doesntmatter@smad.com",
            },
        )

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_dry_run_simple(self, message_builder: mock.MagicMock, record: mock.MagicMock) -> None:
        org = self.create_organization()
        proj = self.create_project(organization=org)
        # fill with data so report not skipped
        self.store_event_outcomes(org.id, proj.id, self.two_days_ago, num_times=2)

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            org.id,
            self._dummy_batch_id,
            dry_run=True,
            target_user=None,
            email_override="doesntmatter@smad.com",
        )

        with pytest.raises(AssertionError):
            assert_any_analytics_event(
                record,
                WeeklyReportSent(
                    user_id=None,
                    organization_id=self.organization.id,
                    notification_uuid="mock.ANY",
                    user_project_count=1,
                ),
            )

        message_builder.return_value.send.assert_not_called()

    @mock.patch("sentry.tasks.summaries.weekly_reports.logger")
    @mock.patch("sentry.tasks.summaries.weekly_reports.prepare_template_context")
    @mock.patch("sentry.tasks.summaries.weekly_reports.OrganizationReportBatch.send_email")
    def test_duplicate_detection(
        self,
        mock_send_email: mock.MagicMock,
        mock_prepare_template_context: mock.MagicMock,
        mock_logger: mock.MagicMock,
    ) -> None:
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(0, 0, organization=self.organization)
        ctx = OrganizationReportContext(0, 0, self.organization)
        user_project_ownership(ctx)
        template_context = prepare_template_context(ctx, [self.user.id])
        mock_prepare_template_context.return_value = template_context
        batch1_id = "abe8ba3e-90af-4a98-b925-5f30250ae6a0"
        batch2_id = "abe8ba3e-90af-4a98-b925-5f30250ae6a1"
        self._set_option_value("always")

        # First send
        OrganizationReportBatch(ctx, batch1_id).deliver_reports()
        assert mock_send_email.call_count == 1
        mock_logger.error.assert_not_called()

        # Duplicate send
        OrganizationReportBatch(ctx, batch2_id).deliver_reports()
        assert mock_send_email.call_count == 1
        assert mock_logger.error.call_count == 1
        mock_logger.error.assert_called_once_with(
            "weekly_report.delivery_record.duplicate_detected",
            extra={
                "batch_id": str(batch2_id),
                "organization": self.organization.id,
                "user_id": self.user.id,
                "has_email_override": False,
                "report_date": "1970-01-01",
            },
        )

    @mock.patch("sentry.tasks.summaries.weekly_reports.prepare_organization_report")
    def test_schedule_organizations_with_redis_tracking(
        self, mock_prepare_organization_report: mock.MagicMock
    ) -> None:
        """Test that schedule_organizations uses Redis to track minimum organization ID."""
        timestamp = self.timestamp
        redis_cluster = redis.clusters.get("default").get_local_client_for_key(
            "weekly_reports_org_id_min"
        )

        # Create multiple organizations
        org1 = self.organization  # Use existing organization
        org2 = self.create_organization(name="Another Org")
        org3 = self.create_organization(name="Third Org")

        # Set initial Redis value to simulate a previous run that was interrupted
        redis_cluster.set(f"weekly_reports_org_id_min:{timestamp}", org1.id)

        # Run the task
        schedule_organizations(timestamp=timestamp)

        # Verify that prepare_organization_report was called for org2 and org3 but not org1
        # because we started from org1.id
        mock_prepare_organization_report.delay.assert_any_call(
            timestamp, ONE_DAY * 7, org2.id, mock.ANY, dry_run=False
        )
        mock_prepare_organization_report.delay.assert_any_call(
            timestamp, ONE_DAY * 7, org3.id, mock.ANY, dry_run=False
        )

        # Verify that Redis key was deleted after completion
        assert redis_cluster.get(f"weekly_reports_org_id_min:{timestamp}") is None

        # Reset call counts for the next test
        mock_prepare_organization_report.reset_mock()

        # Run again with no Redis value set
        schedule_organizations(timestamp=timestamp)

        # Verify that prepare_organization_report was called for all organizations
        assert mock_prepare_organization_report.delay.call_count == 3

    @mock.patch("sentry.tasks.summaries.weekly_reports.prepare_organization_report")
    def test_schedule_organizations_updates_redis_during_processing(
        self, mock_prepare_organization_report
    ):
        """Test that schedule_organizations updates Redis with the current organization ID during processing."""
        timestamp = self.timestamp

        # Create multiple organizations
        orgs = [
            self.organization,
            self.create_organization(name="Org 2"),
            self.create_organization(name="Org 3"),
        ]

        # Sort organizations by ID
        orgs.sort(key=lambda org: org.id)

        # Use a spy to track Redis set calls
        with mock.patch("redis.client.Redis.set") as mock_redis_set:
            # Run the task
            schedule_organizations(timestamp=timestamp)

            # Verify that redis.set was called for each organization
            expected_key = f"weekly_reports_org_id_min:{timestamp}"

            # Check that set was called at least once for each organization except the last one
            assert mock_redis_set.call_count > 0, "Redis set was not called"

            # Get the keys that were set
            set_keys = [args[0] for args, _ in mock_redis_set.call_args_list]

            # Verify that the expected key was used
            assert expected_key in set_keys, f"Expected key {expected_key} not found in {set_keys}"

    @mock.patch("sentry.tasks.summaries.weekly_reports.prepare_organization_report")
    def test_schedule_organizations_starts_from_beginning_when_no_redis_key(
        self, mock_prepare_organization_report
    ):
        """Test that schedule_organizations starts from the beginning when no Redis key exists."""
        timestamp = self.timestamp
        redis_cluster = redis.clusters.get("default").get_local_client_for_key(
            "weekly_reports_org_id_min"
        )

        # Ensure Redis key doesn't exist
        redis_cluster.delete(f"weekly_reports_org_id_min:{timestamp}")

        # Create multiple organizations
        orgs = [
            self.organization,
            self.create_organization(name="Org 2"),
            self.create_organization(name="Org 3"),
        ]

        # Sort organizations by ID
        orgs.sort(key=lambda org: org.id)

        # Run the task
        schedule_organizations(timestamp=timestamp)

        # Verify that prepare_organization_report was called for all organizations
        assert mock_prepare_organization_report.delay.call_count == len(orgs)

        # Verify that each organization was processed
        for org in orgs:
            mock_prepare_organization_report.delay.assert_any_call(
                timestamp, ONE_DAY * 7, org.id, mock.ANY, dry_run=False
            )

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_user_does_not_see_deleted_team_data(self, message_builder: mock.MagicMock) -> None:
        user = self.create_user(email="test@example.com")
        self.create_member(teams=[self.team], user=user, organization=self.organization)

        self.team.status = TeamStatus.PENDING_DELETION
        self.team.save()

        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )

        prepare_organization_report(
            self.timestamp,
            ONE_DAY * 7,
            self.organization.id,
            self._dummy_batch_id,
            dry_run=False,
            target_user=user.id,
        )

        # Verify the report is empty as the user's team is pending deletion
        for call_args in message_builder.call_args_list:
            message_params = call_args.kwargs
            context = message_params["context"]
            assert len(context["trends"]["legend"]) == 0

    @mock.patch("sentry.tasks.summaries.weekly_reports.MessageBuilder")
    def test_log_fields_in_context(self, message_builder: mock.MagicMock) -> None:
        """Verify log fields are present in template context even with no log data."""
        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=5
        )

        prepare_organization_report(
            self.timestamp, ONE_DAY * 7, self.organization.id, self._dummy_batch_id
        )

        message_params = message_builder.call_args.kwargs
        ctx = message_params["context"]

        # Verify trends include log fields
        assert "total_log_count" in ctx["trends"]
        assert "log_maximum" in ctx["trends"]

        # Verify legend includes log counts (should be 0 with no log data)
        legend = ctx["trends"]["legend"][0]
        assert "accepted_log_count" in legend
        assert "dropped_log_count" in legend
        assert legend["accepted_log_count"] == 0
        assert legend["dropped_log_count"] == 0

        # Verify series includes log counts
        series_data = ctx["trends"]["series"][0][1][0]
        assert "log_count" in series_data
        assert series_data["log_count"] == 0

        # Verify log-specific sections exist
        assert "key_error_logs" in ctx
        assert "log_volume_by_severity" in ctx
        assert isinstance(ctx["key_error_logs"], list)
        assert isinstance(ctx["log_volume_by_severity"], dict)

        # With no log data, these should be empty
        assert len(ctx["key_error_logs"]) == 0
        assert ctx["log_volume_by_severity"]["total_count"] == 0
