import time
from datetime import datetime, timedelta, timezone
from unittest import mock

from django.core import mail
from django.utils.html import escape

from sentry.dynamic_sampling.tasks.custom_rule_notifications import (
    MIN_SAMPLES_FOR_NOTIFICATION,
    clean_custom_rule_notifications,
    custom_rule_notifications,
    get_num_samples,
)
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.notifications.platform.templates.custom_rule import format_datetime
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.utils.samples import load_data


class CustomRuleNotificationsTest(TestCase, SnubaTestCase):
    def create_transaction(self) -> Event:
        data = load_data("transaction")
        return self.store_event(data, project_id=self.project.id)

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="radu@sentry.io", username="raduw", name="RaduW")

        now = datetime.now(timezone.utc) - timedelta(minutes=2)

        condition = {
            "op": "and",
            "inner": [
                {"op": "eq", "name": "event.environment", "value": "dev"},
                {"op": "eq", "name": "event.tags.event.type", "value": "transaction"},
            ],
        }
        query = "event.type:transaction environment:dev"

        self.rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=now,
            end=now + timedelta(days=1),
            project_ids=[],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query=query,
            created_by_id=self.user.id,
        )

    def _generate_samples(self, num_samples: int) -> None:
        for idx in range(num_samples):
            self.create_transaction()

        # (RaduW) not sure why I need this, store_event seems to take a while
        time.sleep(1.0)

    def test_get_num_samples(self) -> None:
        """
        Tests that the num_samples function returns the correct number of samples
        """
        # We cannot query the discover_transactions entity without a project being defined for the org
        self.create_project()
        num_samples = get_num_samples(self.rule)
        assert num_samples == 0
        self.create_transaction()
        self.create_transaction()
        self.create_transaction()
        num_samples = get_num_samples(self.rule)
        assert num_samples == 3

    @mock.patch("sentry.dynamic_sampling.tasks.custom_rule_notifications.send_notification")
    def test_email_is_sent_when_enough_samples_have_been_collected(
        self, send_notification_mock: mock.MagicMock
    ) -> None:
        self._generate_samples(MIN_SAMPLES_FOR_NOTIFICATION)

        # the rule should not have notified anybody yet
        self.rule.refresh_from_db()
        assert not self.rule.notification_sent

        # we have enough samples now so an email should be sent
        with self.tasks():
            custom_rule_notifications()

        # test we sent an email
        send_notification_mock.assert_called_once()
        # test the rule was marked as notification_sent
        self.rule.refresh_from_db()
        assert self.rule.notification_sent

    def test_clean_custom_rule_notifications(self) -> None:
        """
        Tests that expired rules are deactivated
        """

        # create an expired rule
        start = datetime.now(timezone.utc) - timedelta(hours=2)
        end = datetime.now(timezone.utc) - timedelta(minutes=2)

        condition = {"op": "eq", "name": "event.tags.event.type", "value": "transaction"}
        query = "event.type:transaction"

        expired_rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=start,
            end=end,
            project_ids=[],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query=query,
            created_by_id=self.user.id,
        )
        # not expired yet
        assert expired_rule.is_active
        assert self.rule.is_active

        with self.tasks():
            clean_custom_rule_notifications()

        self.rule.refresh_from_db()
        assert self.rule.is_active

        expired_rule.refresh_from_db()
        assert not expired_rule.is_active

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"custom-rule-samples-fulfilled": 1.0}}
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_custom_rule_samples_with_notification_platform(self) -> None:
        self._generate_samples(MIN_SAMPLES_FOR_NOTIFICATION)

        # the rule should not have notified anybody yet
        self.rule.refresh_from_db()
        assert not self.rule.notification_sent

        # we have enough samples now so an email should be sent
        with self.tasks():
            custom_rule_notifications()

        # Verify email was sent
        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert isinstance(email, mail.EmailMultiAlternatives)

        query_text = self.rule.query if self.rule.query else "your custom rule"
        assert (
            email.subject
            == f"We've collected {MIN_SAMPLES_FOR_NOTIFICATION} samples for the query: {query_text} you made"
        )

        text_content = email.body
        assert escape("We have samples!") in text_content
        assert (
            escape(
                f"We've collected {MIN_SAMPLES_FOR_NOTIFICATION} samples for your custom sampling rule, from {format_datetime(self.rule.start_date)} to {format_datetime(self.rule.end_date)}, with the query:"
            )
            in text_content
        )
        assert query_text in text_content
        assert (
            escape(
                "We'll stop giving special priority to samples for your query once we collected 100 samples matching your query or 48 hours have passed from rule creation."
            )
            in text_content
        )
        # Check for the action link
        assert "View in Discover" in text_content

        [html_alternative] = email.alternatives
        [html_content, content_type] = html_alternative
        assert content_type == "text/html"

        # Check HTML content
        assert "We have samples!" in str(html_content)
        assert (
            f"We've collected {MIN_SAMPLES_FOR_NOTIFICATION} samples for your custom sampling rule, from {format_datetime(self.rule.start_date)} to {format_datetime(self.rule.end_date)}, with the query:"
            in str(html_content)
        )
        assert query_text in str(html_content)
        assert (
            "We'll stop giving special priority to samples for your query once we collected 100 samples matching your query or 48 hours have passed from rule creation."
            in str(html_content)
        )
        assert "View in Discover" in str(html_content)

        # test the rule was marked as notification_sent
        self.rule.refresh_from_db()
        assert self.rule.notification_sent is True
