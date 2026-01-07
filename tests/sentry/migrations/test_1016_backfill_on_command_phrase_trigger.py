import pytest

from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.testutils.cases import TestMigrations


@pytest.mark.migrations
class BackfillOnCommandPhraseTriggerTest(TestMigrations):
    migrate_from = "1015_backfill_self_hosted_sentry_app_emails"
    migrate_to = "1016_backfill_on_command_phrase_trigger"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization()

        self.repo_empty = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo",
            provider="integrations:github",
        )

        self.repo_with_triggers = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo-2",
            provider="integrations:github",
        )

        self.repo_already_has = Repository.objects.create(
            organization_id=self.org.id,
            name="test-repo-3",
            provider="integrations:github",
        )

    def setup_before_migration(self, apps) -> None:
        RepositorySettings = apps.get_model("sentry", "RepositorySettings")
        OrganizationOption = apps.get_model("sentry", "OrganizationOption")

        self.setting_empty = RepositorySettings.objects.create(
            repository_id=self.repo_empty.id,
            enabled_code_review=True,
            code_review_triggers=[],
        )

        self.setting_with_triggers = RepositorySettings.objects.create(
            repository_id=self.repo_with_triggers.id,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit", "on_ready_for_review"],
        )

        self.setting_already_has = RepositorySettings.objects.create(
            repository_id=self.repo_already_has.id,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase", "on_new_commit"],
        )

        self.org_option_empty = OrganizationOption.objects.create(
            organization_id=self.org.id,
            key="sentry:default_code_review_triggers",
            value=[],
        )

        self.org_option_with_triggers = OrganizationOption.objects.create(
            organization_id=self.create_organization().id,
            key="sentry:default_code_review_triggers",
            value=["on_new_commit", "on_ready_for_review"],
        )

        self.org_option_already_has = OrganizationOption.objects.create(
            organization_id=self.create_organization().id,
            key="sentry:default_code_review_triggers",
            value=["on_command_phrase", "on_new_commit"],
        )

    def test_backfills_on_command_phrase_trigger(self) -> None:
        # Test repository settings backfill
        setting_empty = RepositorySettings.objects.get(id=self.setting_empty.id)
        assert set(setting_empty.code_review_triggers) == {"on_command_phrase"}
        assert len(setting_empty.code_review_triggers) == 1

        setting_with_triggers = RepositorySettings.objects.get(id=self.setting_with_triggers.id)
        assert set(setting_with_triggers.code_review_triggers) == {
            "on_command_phrase",
            "on_new_commit",
            "on_ready_for_review",
        }
        assert len(setting_with_triggers.code_review_triggers) == 3

        setting_already_has = RepositorySettings.objects.get(id=self.setting_already_has.id)
        assert setting_already_has.code_review_triggers.count("on_command_phrase") == 1
        assert set(setting_already_has.code_review_triggers) == {
            "on_command_phrase",
            "on_new_commit",
        }

        # Test organization options backfill
        org_option_empty = OrganizationOption.objects.get(id=self.org_option_empty.id)
        assert org_option_empty.value == ["on_command_phrase"]

        org_option_with_triggers = OrganizationOption.objects.get(
            id=self.org_option_with_triggers.id
        )
        assert org_option_with_triggers.value == [
            "on_new_commit",
            "on_ready_for_review",
            "on_command_phrase",
        ]

        org_option_already_has = OrganizationOption.objects.get(id=self.org_option_already_has.id)
        assert org_option_already_has.value == [
            "on_command_phrase",
            "on_new_commit",
        ]
