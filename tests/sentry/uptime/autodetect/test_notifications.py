from typing import int
from unittest.mock import Mock, patch

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.uptime.autodetect.notifications import (
    generate_uptime_monitor_detail_url,
    generate_uptime_monitor_overview_url,
    get_user_emails_from_project,
    send_auto_detected_notifications,
)
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.types import UptimeMonitorMode
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.workflow_engine.models.detector import Detector


class UptimeAutoDetectedNotificationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.user1 = self.create_user("user1@example.com")
        self.user2 = self.create_user("user2@example.com")
        self.create_member(user=self.user1, organization=self.organization)
        self.create_member(user=self.user2, organization=self.organization)
        self.team = self.create_team(
            organization=self.organization, members=[self.user1, self.user2]
        )
        self.project.add_team(self.team)
        self.features = {"organizations:uptime-auto-detected-monitor-emails": True}

    def create_test_detector(
        self, url: str = "https://example.com"
    ) -> tuple[Detector, UptimeSubscription]:
        uptime_subscription = self.create_uptime_subscription(url=url)
        detector = self.create_uptime_detector(
            project=self.project,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
            uptime_subscription=uptime_subscription,
        )
        return detector, uptime_subscription

    def test_get_user_emails_from_project(self) -> None:
        """Test that we get all project member emails."""
        emails = set(get_user_emails_from_project(self.project))
        assert emails == {"user1@example.com", "user2@example.com"}

    def test_get_user_emails_with_alternate_email(self) -> None:
        """Test that alternate project-specific emails are respected."""
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.create(
                user=self.user1, email="alternate1@example.com", is_verified=True
            )
            UserOption.objects.create(
                user=self.user1,
                key="mail:email",
                project_id=self.project.id,
                value="alternate1@example.com",
            )

        emails = set(get_user_emails_from_project(self.project))
        assert emails == {"alternate1@example.com", "user2@example.com"}

    def test_get_user_emails_skips_unverified(self) -> None:
        """Test that unverified alternate emails are not used."""
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.create(
                user=self.user1, email="unverified@example.com", is_verified=False
            )
            UserOption.objects.create(
                user=self.user1,
                key="mail:email",
                project_id=self.project.id,
                value="unverified@example.com",
            )

        emails = set(get_user_emails_from_project(self.project))
        assert emails == {"user2@example.com"}
        assert "unverified@example.com" not in emails

    def test_generate_uptime_monitor_overview_url(self) -> None:
        """Test URL generation for uptime monitoring overview."""
        url = generate_uptime_monitor_overview_url(self.organization)
        assert f"/organizations/{self.organization.slug}/insights/uptime/" in url

    def test_generate_uptime_monitor_detail_url(self) -> None:
        """Test URL generation for specific detector details."""
        detector, _ = self.create_test_detector()
        url = generate_uptime_monitor_detail_url(self.organization, self.project.slug, detector.id)
        assert f"/organizations/{self.organization.slug}/issues/alerts/rules/uptime/" in url
        assert f"/{self.project.slug}/{detector.id}/details/" in url

    @patch("sentry.uptime.autodetect.notifications.MessageBuilder")
    def test_send_auto_detected_notifications(self, mock_builder: Mock) -> None:
        """Test that email is sent to all project members on graduation."""
        mock_builder.return_value.send_async = Mock()
        detector, uptime_subscription = self.create_test_detector(url="https://api.example.com")

        with self.feature(self.features):
            send_auto_detected_notifications(detector.id)

        assert mock_builder.call_count == 1
        call_kwargs = mock_builder.call_args[1]
        assert call_kwargs["subject"] == "We've Created a Free Uptime Monitor for Your Project"
        assert call_kwargs["template"] == "sentry/emails/uptime/auto-detected-monitors.txt"
        assert call_kwargs["html_template"] == "sentry/emails/uptime/auto-detected-monitors.html"
        assert call_kwargs["type"] == "uptime.auto_detected_monitors"

        context = call_kwargs["context"]
        assert "monitor_url_display" in context
        assert "monitor_detail_url" in context
        assert "project_slug" in context
        assert "date_created" in context
        assert "view_monitors_link" in context

        assert context["monitor_url_display"] == uptime_subscription.url
        assert context["project_slug"] == self.project.slug
        assert (
            f"/organizations/{self.organization.slug}/issues/alerts/rules/uptime/"
            in context["monitor_detail_url"]
        )
        assert context["date_created"] == detector.date_added

        mock_builder.return_value.send_async.assert_called_once()
        email_recipients = mock_builder.return_value.send_async.call_args[0][0]
        assert set(email_recipients) == {"user1@example.com", "user2@example.com"}

    @patch("sentry.uptime.autodetect.notifications.MessageBuilder")
    def test_send_auto_detected_notifications_no_members(self, mock_builder: Mock) -> None:
        """Test that no email is sent if project has no members."""
        empty_org = self.create_organization()
        empty_project = self.create_project(organization=empty_org)
        detector = self.create_uptime_detector(
            project=empty_project,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )

        with self.feature({"organizations:uptime-auto-detected-monitor-emails": True}):
            send_auto_detected_notifications(detector.id)

        mock_builder.return_value.send_async.assert_not_called()

    @patch("sentry.uptime.autodetect.notifications.MessageBuilder")
    def test_send_auto_detected_notifications_multiple_teams(self, mock_builder: Mock) -> None:
        """Test email sent to all members across multiple teams."""
        mock_builder.return_value.send_async = Mock()

        user3 = self.create_user("user3@example.com")
        user4 = self.create_user("user4@example.com")
        self.create_member(user=user3, organization=self.organization)
        self.create_member(user=user4, organization=self.organization)
        team2 = self.create_team(organization=self.organization, members=[user3, user4])
        self.project.add_team(team2)

        detector, _ = self.create_test_detector()
        with self.feature(self.features):
            send_auto_detected_notifications(detector.id)

        email_recipients = mock_builder.return_value.send_async.call_args[0][0]
        assert set(email_recipients) == {
            "user1@example.com",
            "user2@example.com",
            "user3@example.com",
            "user4@example.com",
        }

    @patch("sentry.uptime.autodetect.notifications.MessageBuilder")
    def test_send_auto_detected_notifications_excludes_non_team_members(
        self, mock_builder: Mock
    ) -> None:
        """Test that users not on project teams don't receive emails."""
        mock_builder.return_value.send_async = Mock()

        user_not_in_team = self.create_user("outsider@example.com")
        self.create_member(user=user_not_in_team, organization=self.organization)

        detector, _ = self.create_test_detector()
        with self.feature(self.features):
            send_auto_detected_notifications(detector.id)

        email_recipients = mock_builder.return_value.send_async.call_args[0][0]
        assert set(email_recipients) == {"user1@example.com", "user2@example.com"}
        assert "outsider@example.com" not in email_recipients

    @patch("sentry.uptime.autodetect.notifications.MessageBuilder")
    def test_send_auto_detected_notifications_feature_flag_disabled(
        self, mock_builder: Mock
    ) -> None:
        """Test that no email is sent when feature flag is disabled."""
        mock_builder.return_value.send_async = Mock()
        detector, _ = self.create_test_detector(url="https://api.example.com")

        with self.feature({"organizations:uptime-auto-detected-monitor-emails": False}):
            send_auto_detected_notifications(detector.id)

        mock_builder.return_value.send_async.assert_not_called()
