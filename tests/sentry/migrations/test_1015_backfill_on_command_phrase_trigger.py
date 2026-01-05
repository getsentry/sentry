import pytest

from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.testutils.cases import TestMigrations


@pytest.mark.migrations
class BackfillOnCommandPhraseTriggerTest(TestMigrations):
    migrate_from = "1014_add_pkce_to_apigrant"
    migrate_to = "1015_backfill_on_command_phrase_trigger"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization()

        self.repo_empty = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo",
            provider="integrations:github",
        )
        self.setting_empty = RepositorySettings.objects.create(
            repository=self.repo_empty,
            enabled_code_review=True,
            code_review_triggers=[],
        )

        self.repo_with_triggers = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo-2",
            provider="integrations:github",
        )
        self.setting_with_triggers = RepositorySettings.objects.create(
            repository=self.repo_with_triggers,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit", "on_ready_for_review"],
        )

        self.repo_already_has = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo-3",
            provider="integrations:github",
        )
        self.setting_already_has = RepositorySettings.objects.create(
            repository=self.repo_already_has,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase", "on_new_commit"],
        )

    def test_backfills_on_command_phrase_trigger(self) -> None:
        self.setting_empty.refresh_from_db()
        assert set(self.setting_empty.code_review_triggers) == {"on_command_phrase"}
        assert len(self.setting_empty.code_review_triggers) == 1

        self.setting_with_triggers.refresh_from_db()
        assert set(self.setting_with_triggers.code_review_triggers) == {
            "on_command_phrase",
            "on_new_commit",
            "on_ready_for_review",
        }
        assert len(self.setting_with_triggers.code_review_triggers) == 3

        self.setting_already_has.refresh_from_db()
        assert self.setting_already_has.code_review_triggers.count("on_command_phrase") == 1
        assert set(self.setting_already_has.code_review_triggers) == {
            "on_command_phrase",
            "on_new_commit",
        }
