import pytest
from django.db import IntegrityError

from sentry.models.repositorysettings import (
    CodeReviewSettings,
    CodeReviewTrigger,
    RepositorySettings,
)
from sentry.testutils.cases import TestCase


class TestCodeReviewTrigger(TestCase):
    def test_as_choices_returns_tuple_of_tuples(self) -> None:
        choices = CodeReviewTrigger.as_choices()

        assert isinstance(choices, tuple)
        assert len(choices) == 3
        assert ("on_command_phrase", "on_command_phrase") in choices
        assert ("on_new_commit", "on_new_commit") in choices
        assert ("on_ready_for_review", "on_ready_for_review") in choices


class TestCodeReviewSettings(TestCase):
    def test_initialization(self) -> None:
        triggers = [CodeReviewTrigger.ON_COMMAND_PHRASE, CodeReviewTrigger.ON_NEW_COMMIT]
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
                CodeReviewTrigger.ON_COMMAND_PHRASE.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )

        settings = repo_settings.get_code_review_settings()

        assert settings.enabled is True
        assert len(settings.triggers) == 2
        assert CodeReviewTrigger.ON_COMMAND_PHRASE in settings.triggers
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
