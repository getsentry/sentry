from django.urls import reverse

from sentry.models.activity import Activity
from sentry.models.outbox import ControlOutbox, OutboxCategory
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils.email import group_id_to_email

body_plain = "foo bar"


@control_silo_test
class TestMailgunInboundWebhookView(TestCase):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.event = self.store_event(data={"event_id": "a" * 32}, project_id=self.project.id)
        self.mailto = group_id_to_email(self.group.pk)

    def test_invalid_signature(self):
        with self.options({"mail.mailgun-api-key": "a" * 32}):
            resp = self.client.post(
                reverse("sentry-mailgun-inbound-hook"),
                {
                    "recipient": self.mailto,
                    "sender": self.user.email,
                    "body-plain": body_plain,
                    "signature": "",
                    "token": "",
                    "timestamp": "",
                },
            )

        assert resp.status_code == 200
        qs = ControlOutbox.objects.filter(category=OutboxCategory.ISSUE_COMMENT_UPDATE)
        assert qs.exists() is False

    def test_missing_api_key(self):
        resp = self.client.post(
            reverse("sentry-mailgun-inbound-hook"),
            {
                "recipient": self.mailto,
                "sender": self.user.email,
                "body-plain": body_plain,
                "signature": "",
                "token": "",
                "timestamp": "",
            },
        )
        assert resp.status_code == 500
        qs = ControlOutbox.objects.filter(category=OutboxCategory.ISSUE_COMMENT_UPDATE)
        assert qs.exists() is False

    def test_success(self):
        token = "a" * 50
        timestamp = "1422513193"
        signature = "414a4705e6c12a39905748549f9135fbe8b739a5b12b2349ee40f31d3ee12f83"

        with self.options({"mail.mailgun-api-key": "a" * 32}):
            resp = self.client.post(
                reverse("sentry-mailgun-inbound-hook"),
                {
                    "recipient": self.mailto,
                    "sender": self.user.email,
                    "body-plain": body_plain,
                    "signature": signature,
                    "token": token,
                    "timestamp": timestamp,
                },
            )
        assert resp.status_code == 201

        assert ControlOutbox.objects.filter(category=OutboxCategory.ISSUE_COMMENT_UPDATE).exists()
        with outbox_runner():
            pass

        with assume_test_silo_mode(SiloMode.REGION):
            activity = Activity.objects.get(group_id=self.group.id, user_id=self.user.id)
            assert activity.data == {"text": body_plain}

    def test_success_no_duplicates(self):
        token = "a" * 50
        timestamp = "1422513193"
        signature = "414a4705e6c12a39905748549f9135fbe8b739a5b12b2349ee40f31d3ee12f83"

        with self.options({"mail.mailgun-api-key": "a" * 32}):
            for _ in range(2):
                resp = self.client.post(
                    reverse("sentry-mailgun-inbound-hook"),
                    {
                        "recipient": self.mailto,
                        "sender": self.user.email,
                        "body-plain": body_plain,
                        "signature": signature,
                        "token": token,
                        "timestamp": timestamp,
                    },
                )
                assert resp.status_code == 201

        assert (
            ControlOutbox.objects.filter(category=OutboxCategory.ISSUE_COMMENT_UPDATE).count() == 2
        )
        with outbox_runner():
            pass

        with assume_test_silo_mode(SiloMode.REGION):
            qs = Activity.objects.filter(group_id=self.group.id, user_id=self.user.id)
            assert qs.count() == 1
