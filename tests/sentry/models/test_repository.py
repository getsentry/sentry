from django.core import mail

from sentry.models.repository import Repository
from sentry.plugins.providers.dummy import DummyRepositoryProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options


class RepositoryDeleteEmailTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            provider="dummy",
        )
        self.provider = DummyRepositoryProvider("dummy")
        self.repo.get_provider = lambda: self.provider

    @with_feature("organizations:notification-platform")
    @override_options({"notifications.platform-rate.unable-to-delete-repository": 1.0})
    def test_send_delete_fail_email_with_notification_platform(self) -> None:
        with self.tasks():
            self.repo.send_delete_fail_email("Failed to connect to GitHub API", self.user.email)

        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert isinstance(email, mail.EmailMultiAlternatives)

        assert email.subject == "Unable to Delete Repository Webhooks"

        text_content = email.body
        assert "We were unable to delete webhooks in Example" in text_content
        assert "getsentry/sentry" in text_content
        assert "Failed to connect to GitHub API" in text_content
        assert "You will need to remove these webhooks manually" in text_content

        [html_alternative] = email.alternatives
        [html_content, content_type] = html_alternative
        html_content = str(html_content)
        assert content_type == "text/html"
        assert "We were unable to delete webhooks in Example" in html_content
        assert "getsentry/sentry" in html_content
        assert "Failed to connect to GitHub API" in html_content

    def test_send_delete_fail_email_without_notification_platform(self) -> None:
        with self.tasks():
            self.repo.send_delete_fail_email("Failed to connect to GitHub API", self.user.email)

        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert email.subject == "Unable to Delete Repository Webhooks"
        assert "Failed to connect to GitHub API" in email.body

    def test_generate_delete_fail_email(self) -> None:
        msg = self.repo.generate_delete_fail_email("Test error message")

        assert msg.subject == "Unable to Delete Repository Webhooks"
        assert msg.template == "sentry/emails/unable-to-delete-repo.txt"
        assert msg.html_template == "sentry/emails/unable-to-delete-repo.html"
        assert msg.context["repo"] == self.repo
        assert msg.context["error_message"] == "Test error message"
        assert msg.context["provider_name"] == "Example"
