import pytest
from django.db import IntegrityError

from sentry.models.repositorysettings import (
    CodeReviewSettings,
    CodeReviewTrigger,
    RepositorySettings,
)
from sentry.testutils.cases import TestCase


class TestCodeReviewSettings(TestCase):
    def test_initialization(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW, CodeReviewTrigger.ON_NEW_COMMIT]
        settings = CodeReviewSettings(enabled=True, triggers=triggers)

        assert settings.enabled is True
        assert settings.triggers == triggers


class TestRepositorySettings(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(project=self.project)

    def test_get_code_review_settings_with_defaults(self) -> None:
        repo_settings = RepositorySettings.objects.create(repository=self.repo)

        settings = repo_settings.get_code_review_settings()

        assert settings.enabled is False
        assert settings.triggers == []

    def test_get_code_review_settings_with_enabled_and_triggers(self) -> None:
        repo_settings = RepositorySettings.objects.create(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_NEW_COMMIT.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )

        settings = repo_settings.get_code_review_settings()

        assert settings.enabled is True
        assert len(settings.triggers) == 2
        assert CodeReviewTrigger.ON_NEW_COMMIT in settings.triggers
        assert CodeReviewTrigger.ON_READY_FOR_REVIEW in settings.triggers

    def test_get_code_review_settings_converts_string_triggers_to_enum(self) -> None:
        repo_settings = RepositorySettings.objects.create(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit"],
        )

        settings = repo_settings.get_code_review_settings()

        assert settings.triggers == [CodeReviewTrigger.ON_NEW_COMMIT]
        assert isinstance(settings.triggers[0], CodeReviewTrigger)

    def test_repository_settings_unique_per_repository(self) -> None:
        RepositorySettings.objects.create(repository=self.repo)

        # Creating another settings for the same repo should fail
        with pytest.raises(IntegrityError):
            RepositorySettings.objects.create(repository=self.repo)

    def test_repository_settings_deleted_with_repository(self) -> None:
        repo_settings = RepositorySettings.objects.create(repository=self.repo)
        settings_id = repo_settings.id

        self.repo.delete()

        assert not RepositorySettings.objects.filter(id=settings_id).exists()
