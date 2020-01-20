from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils.compat import mock
from sentry.testutils import APITestCase
from sentry.constants import SentryAppStatus


class SentryAppPublishRequestTest(APITestCase):
    def setUp(self):
        # create user as superuser
        self.user = self.create_user(email="boop@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(name="Testin", organization=self.org)

        self.url = reverse("sentry-api-0-sentry-app-publish-request", args=[self.sentry_app.slug])

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_request(self, send_mail):
        self.login_as(user=self.user)
        response = self.client.post(
            self.url,
            format="json",
            data={
                "questionnaire": [
                    {"question": "First question", "answer": "First response"},
                    {"question": "Second question", "answer": "Second response"},
                ]
            },
        )
        assert response.status_code == 201
        message = (
            "User boop@example.com of organization my-org wants to publish testin"
            "\n\n\n>First question\nFirst response"
            "\n\n>Second question\nSecond response"
        )

        send_mail.assert_called_with(
            "Sentry Integration Publication Request from my-org",
            message,
            "root@localhost",
            ["partners@sentry.io"],
            reply_to=[self.user.email],
        )

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_already_published(self, send_mail):
        self.sentry_app.update(status=SentryAppStatus.PUBLISHED)
        self.login_as(user=self.user)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish already published integration"
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_internal(self, send_mail):
        self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        self.login_as(user=self.user)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish internal integration"
        send_mail.asssert_not_called()
