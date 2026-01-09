from sentry.models.repositorysettings import RepositorySettings
from sentry.testutils.cases import TestMigrations


class RemoveOnCommandPhraseTriggerTest(TestMigrations):
    migrate_from = "1015_backfill_self_hosted_sentry_app_emails"
    migrate_to = "1016_remove_on_command_phrase_trigger"

    def setup_initial_state(self) -> None:
        org = self.create_organization()
        self.project1 = self.create_project(organization=org)
        self.repo1 = self.create_repo(project=self.project1, name="org/repo1")
        self.repo_settings1 = RepositorySettings.objects.create(
            repository=self.repo1,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase", "on_ready_for_review", "on_new_commit"],
        )

        self.project2 = self.create_project(organization=org)
        self.repo2 = self.create_repo(project=self.project2, name="org/repo2")
        self.repo_settings2 = RepositorySettings.objects.create(
            repository=self.repo2,
            enabled_code_review=True,
            code_review_triggers=["on_ready_for_review", "on_new_commit"],
        )

        self.project3 = self.create_project(organization=org)
        self.repo3 = self.create_repo(project=self.project3, name="org/repo3")
        self.repo_settings3 = RepositorySettings.objects.create(
            repository=self.repo3,
            enabled_code_review=True,
            code_review_triggers=[],
        )

    def test(self) -> None:
        repo_settings = RepositorySettings.objects.get(id=self.repo_settings1.id)
        assert repo_settings.code_review_triggers == ["on_ready_for_review", "on_new_commit"]
        assert "on_command_phrase" not in repo_settings.code_review_triggers

        repo_settings = RepositorySettings.objects.get(id=self.repo_settings2.id)
        assert repo_settings.code_review_triggers == ["on_ready_for_review", "on_new_commit"]
        assert "on_command_phrase" not in repo_settings.code_review_triggers

        repo_settings = RepositorySettings.objects.get(id=self.repo_settings3.id)
        assert repo_settings.code_review_triggers == []
