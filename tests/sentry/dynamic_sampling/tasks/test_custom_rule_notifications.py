import time
from datetime import datetime, timedelta, timezone
from unittest import mock
from unittest.mock import ANY as PARAM_ANY

from sentry.dynamic_sampling.tasks.custom_rule_notifications import (
    MIN_SAMPLES_FOR_NOTIFICATION,
    custom_rule_notifications,
    get_num_samples,
    send_notification,
)
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils.samples import load_data


class CustomRuleNotificationsTest(TestCase, SnubaTestCase):
    def create_transaction(self):
        data = load_data("transaction")
        return self.store_event(data, project_id=self.project.id)

    def setUp(self):
        super().setUp()
        user = self.create_user(email="radu@sentry.io", username="raduw", name="RaduW")

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
            created_by_id=user.id,
        )

    @mock.patch("sentry.dynamic_sampling.tasks.custom_rule_notifications.send_mail")
    def test_send_notification(self, send_mail_mock):
        """
        Tests that the send_notification function sends the correct email
        """
        send_notification(self.rule, 100)
        send_mail_mock.assert_called_once_with(
            PARAM_ANY, PARAM_ANY, PARAM_ANY, ["radu@sentry.io"], fail_silently=PARAM_ANY
        )

    def test_get_num_samples(self):
        """
        Tests that the num_samples function returns the correct number of samples
        """
        num_samples = get_num_samples(self.rule)
        assert num_samples == 0
        self.create_transaction()
        self.create_transaction()
        self.create_transaction()
        num_samples = get_num_samples(self.rule)
        assert num_samples == 3

    @mock.patch("sentry.dynamic_sampling.tasks.custom_rule_notifications.send_mail")
    def test_email_is_sent_when_enough_samples_have_been_collected(self, send_mail_mock):
        for idx in range(MIN_SAMPLES_FOR_NOTIFICATION):
            self.create_transaction()

        # (RaduW) not sure why I need this, store_event seems to take a while
        time.sleep(1.0)

        # the rule should not have notified anybody yet
        self.rule.refresh_from_db()
        assert not self.rule.notification_sent

        # we have enough samples now so an email should be sent
        with self.tasks():
            custom_rule_notifications()

        # test we sent an email
        send_mail_mock.assert_called_once()
        # test the rule was marked as notification_sent
        self.rule.refresh_from_db()
        assert self.rule.notification_sent
