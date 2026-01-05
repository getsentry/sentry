from unittest.mock import patch

import pytest
from django.core import mail

from sentry.constants import DEFAULT_CODE_REVIEW_TRIGGERS
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings
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

    @with_feature("organizations:notification-platform.internal-testing")
    @override_options(
        {"notifications.platform-rollout.internal-testing": {"unable-to-delete-repository": 1.0}}
    )
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
    """Tests for auto-enabling code review settings on repository creation."""

    def test_no_settings_created_when_auto_enable_disabled(self):
        org = self.create_organization()

        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        assert not RepositorySettings.objects.filter(repository=repo).exists()

    def test_settings_created_when_auto_enable_enabled(self):
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

        settings = RepositorySettings.objects.get(repository=repo)
        assert settings.enabled_code_review is True
        assert settings.code_review_triggers == DEFAULT_CODE_REVIEW_TRIGGERS

    def test_settings_created_with_triggers(self):
        org = self.create_organization()

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
        assert settings.code_review_triggers == [
            "on_new_commit",
            "on_ready_for_review",
            "on_command_phrase",
        ]

    def test_no_settings_for_unsupported_provider(self):
        org = self.create_organization()

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

        assert not RepositorySettings.objects.filter(repository=repo).exists()

    def test_invalid_triggers_type_defaults_to_empty_list(self):
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
        assert settings.code_review_triggers == DEFAULT_CODE_REVIEW_TRIGGERS

    def test_settings_not_duplicated_on_update(self):
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

        repo.name = "updated-repo"
        repo.save()

        assert RepositorySettings.objects.filter(repository=repo).count() == 1

    def test_transaction_rollback_on_auto_enable_failure(self):
        org = self.create_organization()

        OrganizationOption.objects.set_value(
            organization=org,
            key="sentry:auto_enable_code_review",
            value=True,
        )

        initial_repo_count = Repository.objects.filter(organization_id=org.id).count()

        with patch.object(
            Repository,
            "_handle_auto_enable_code_review",
            side_effect=Exception("Test exception"),
        ):
            with pytest.raises(Exception, match="Test exception"):
                Repository.objects.create(
                    organization_id=org.id,
                    name="test-repo",
                    provider="integrations:github",
                )

        # Neither Repository nor RepositorySettings should be saved due to transaction rollback
        assert Repository.objects.filter(organization_id=org.id).count() == initial_repo_count
        assert not RepositorySettings.objects.filter(repository__organization_id=org.id).exists()

    def test_both_repository_and_settings_saved_atomically(self):
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

        # Both should exist
        assert Repository.objects.filter(id=repo.id).exists()
        assert RepositorySettings.objects.filter(repository=repo).exists()

        # Verify the settings are correct
        settings = RepositorySettings.objects.get(repository=repo)
        assert settings.enabled_code_review is True

    def test_save_adds_on_command_phrase_when_triggers_empty(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=[],
        )

        settings.refresh_from_db()
        assert settings.code_review_triggers == [CodeReviewTrigger.ON_COMMAND_PHRASE.value]

    def test_save_adds_on_command_phrase_when_missing(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_NEW_COMMIT.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )

        settings.refresh_from_db()
        assert set(settings.code_review_triggers) == {
            CodeReviewTrigger.ON_COMMAND_PHRASE.value,
            CodeReviewTrigger.ON_NEW_COMMIT.value,
            CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
        }
        assert len(settings.code_review_triggers) == 3

    def test_save_does_not_duplicate_on_command_phrase(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_COMMAND_PHRASE.value,
                CodeReviewTrigger.ON_NEW_COMMIT.value,
            ],
        )

        settings.refresh_from_db()
        assert set(settings.code_review_triggers) == {
            CodeReviewTrigger.ON_COMMAND_PHRASE.value,
            CodeReviewTrigger.ON_NEW_COMMIT.value,
        }
        assert len(settings.code_review_triggers) == 2

    def test_save_enforces_on_command_phrase_on_update(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            name="test-repo",
            provider="integrations:github",
        )

        settings = self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_NEW_COMMIT.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )

        settings.code_review_triggers = [
            CodeReviewTrigger.ON_NEW_COMMIT.value,
            CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
        ]
        settings.save()

        settings.refresh_from_db()
        assert set(settings.code_review_triggers) == {
            CodeReviewTrigger.ON_COMMAND_PHRASE.value,
            CodeReviewTrigger.ON_NEW_COMMIT.value,
            CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
        }
        assert len(settings.code_review_triggers) == 3
