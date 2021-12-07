from unittest import mock

from django.urls import reverse

from sentry.constants import SentryAppStatus
from sentry.models import SentryAppAvatar
from sentry.testutils import APITestCase


class SentryAppPublishRequestTest(APITestCase):
    def upload_logo(self):
        SentryAppAvatar.objects.create(sentry_app=self.sentry_app, avatar_type=1, color=True)

    def upload_issue_link_logo(self):
        SentryAppAvatar.objects.create(sentry_app=self.sentry_app, avatar_type=1, color=False)

    def setUp(self):
        # create user as superuser
        self.user = self.create_user(email="boop@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.url = reverse("sentry-api-0-sentry-app-publish-request", args=[self.sentry_app.slug])
        self.login_as(user=self.user)

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_request(self, send_mail):
        self.upload_logo()
        self.upload_issue_link_logo()
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
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish already published integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_internal(self, send_mail):
        self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish internal integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_no_logo(self, send_mail):
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Must upload a logo for the integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_no_issue_link_logo(self, send_mail):
        """Test that you cannot submit a publication request for an issue link
        integration without having uploaded a black icon."""
        self.upload_logo()
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "Must upload an icon for issue and stack trace linking integrations."
        )
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.send_mail")
    def test_publish_no_stacktrace_link_logo(self, send_mail):
        """Test that you cannot submit a publication request for a stacktrace link
        integration without having uploaded a black icon."""
        stacktrace_link_sentry_app = self.create_sentry_app(
            name="Meowin",
            organization=self.org,
            schema={"elements": [self.create_stacktrace_link_schema()]},
        )
        SentryAppAvatar.objects.create(
            sentry_app=stacktrace_link_sentry_app, avatar_type=1, color=True
        )
        url = reverse(
            "sentry-api-0-sentry-app-publish-request", args=[stacktrace_link_sentry_app.slug]
        )
        response = self.client.post(url, format="json")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "Must upload an icon for issue and stack trace linking integrations."
        )
        send_mail.asssert_not_called()
