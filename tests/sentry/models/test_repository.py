from django.core import mail

from sentry.models import OrganizationOption
from sentry.models.repository import Repository
from sentry.models.repository_settings import RepositorySettings
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


class RepositoryCodeReviewSettingsTest(TestCase):
    """Tests for the post_save signal that creates RepositorySettings on repository creation."""

    def test_no_settings_created_when_auto_enable_disabled(self):
        """When auto_enable_code_review is False, no RepositorySettings should be created."""
        org = self.create_organization()

        # Ensure auto_enable is not set (defaults to False)
        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        # No settings should be created
        assert not RepositorySettings.objects.filter(repository=repo).exists()

    def test_settings_created_when_auto_enable_enabled(self):
        """When auto_enable_code_review is True, RepositorySettings should be created."""
        org = self.create_organization()

        # Enable auto code review for the organization
        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        # Settings should be created with code review enabled
        settings = RepositorySettings.objects.get(repository=repo)
        assert settings.enabled_code_review is True
        assert settings.code_review_triggers == []

    def test_settings_created_with_triggers(self):
        """When triggers are configured, they should be copied to RepositorySettings."""
        org = self.create_organization()

        # Enable auto code review with triggers
        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )
        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:default_code_review_triggers",
            value=["on_new_commit", "on_ready_for_review"],
        )

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = RepositorySettings.objects.get(repository=repo)
        assert settings.enabled_code_review is True
        assert settings.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

    def test_no_settings_for_unsupported_provider(self):
        """Repositories with unsupported providers should not get settings."""
        org = self.create_organization()

        # Enable auto code review
        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="unsupported_provider",
        )

        # No settings should be created for unsupported provider
        assert not RepositorySettings.objects.filter(repository=repo).exists()

    def test_invalid_triggers_type_defaults_to_empty_list(self):
        """When triggers is not a list, it should default to empty list."""
        org = self.create_organization()

        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )
        # Set invalid triggers type (string instead of list)
        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:default_code_review_triggers",
            value="invalid_string",
        )

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = RepositorySettings.objects.get(repository=repo)
        assert settings.code_review_triggers == []

    def test_settings_not_duplicated_on_update(self):
        """Updating a repository should not create duplicate settings."""
        org = self.create_organization()

        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        # Update the repository
        repo.name = "updated-repo"
        repo.save()

        # Should still have exactly one settings record
        assert RepositorySettings.objects.filter(repository=repo).count() == 1
