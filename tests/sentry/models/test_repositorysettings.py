import pytest
from django.db import IntegrityError

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope
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
        repo_settings = self.create_repository_settings(repository=self.repo)

        settings = repo_settings.get_code_review_settings()

        assert settings.enabled is False
        assert settings.triggers == []

    def test_get_code_review_settings_with_enabled_and_triggers(self) -> None:
        repo_settings = self.create_repository_settings(
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
        repo_settings = self.create_repository_settings(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit"],
        )

        settings = repo_settings.get_code_review_settings()

        assert settings.triggers == [CodeReviewTrigger.ON_NEW_COMMIT]
        assert isinstance(settings.triggers[0], CodeReviewTrigger)

    def test_repository_settings_unique_per_repository(self) -> None:
        self.create_repository_settings(repository=self.repo)

        # Creating another settings for the same repo should fail
        with pytest.raises(IntegrityError):
            RepositorySettings.objects.create(repository=self.repo)

    def test_repository_settings_deleted_with_repository(self) -> None:
        repo_settings = self.create_repository_settings(repository=self.repo)
        settings_id = repo_settings.id

        self.repo.delete()

        assert not RepositorySettings.objects.filter(id=settings_id).exists()

    def test_write_relocation_import_inserts_new_settings(self) -> None:
        RepositorySettings.objects.filter(repository=self.repo).delete()
        new_settings = RepositorySettings(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[CodeReviewTrigger.ON_NEW_COMMIT.value],
        )

        result = new_settings.write_relocation_import(ImportScope.Global, ImportFlags())
        assert result is not None
        pk, import_kind = result

        assert import_kind == ImportKind.Inserted
        assert pk == new_settings.pk
        saved_settings = RepositorySettings.objects.get(pk=pk)
        assert saved_settings.enabled_code_review is True
        assert saved_settings.code_review_triggers == [CodeReviewTrigger.ON_NEW_COMMIT.value]

    def test_write_relocation_import_overwrites_with_defaults(self) -> None:
        existing_settings = self.create_repository_settings(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[CodeReviewTrigger.ON_NEW_COMMIT.value],
        )
        imported_settings = RepositorySettings(
            repository=self.repo, enabled_code_review=False, code_review_triggers=[]
        )

        result = imported_settings.write_relocation_import(ImportScope.Global, ImportFlags())
        assert result is not None
        pk, import_kind = result

        assert import_kind == ImportKind.Overwrite
        assert pk == existing_settings.pk
        saved_settings = RepositorySettings.objects.get(pk=pk)
        assert saved_settings.enabled_code_review is False
        assert saved_settings.code_review_triggers == []
