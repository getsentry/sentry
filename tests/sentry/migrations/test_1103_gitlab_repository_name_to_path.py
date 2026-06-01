from django.db import router

from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import assume_test_silo_mode


class GitlabRepositoryNameToPathTest(TestMigrations):
    migrate_from = "1102_activity_project_type_index"
    migrate_to = "1103_gitlab_repository_name_to_path"

    def setup_before_migration(self, apps):
        Repository = apps.get_model("sentry", "Repository")

        with (
            assume_test_silo_mode(SiloMode.MONOLITH),
            unguarded_write(using=router.db_for_write(Repository)),
        ):
            org = self.create_organization()
            self.org_id = org.id

            # GitLab repo with a display name + path slug in config -> name rewritten.
            self.display_name_repo = Repository.objects.create(
                organization_id=org.id,
                name="Get Sentry / Example Repo",
                provider="integrations:gitlab",
                external_id="example.gitlab.com:1",
                config={"instance": "example.gitlab.com", "path": "getsentry/example-repo"},
            )

            # GitLab repo already aligned -> left untouched.
            self.aligned_repo = Repository.objects.create(
                organization_id=org.id,
                name="getsentry/already-aligned",
                provider="integrations:gitlab",
                external_id="example.gitlab.com:2",
                config={"instance": "example.gitlab.com", "path": "getsentry/already-aligned"},
            )

            # GitLab repo missing config["path"] -> left untouched (older row).
            self.no_path_repo = Repository.objects.create(
                organization_id=org.id,
                name="Get Sentry / No Path",
                provider="integrations:gitlab",
                external_id="example.gitlab.com:3",
                config={"instance": "example.gitlab.com"},
            )

            # Non-GitLab repo -> never touched even with a spaced name + path.
            self.github_repo = Repository.objects.create(
                organization_id=org.id,
                name="getsentry/sentry",
                provider="integrations:github",
                external_id="gh:1",
                config={"path": "should-not-be-used"},
            )

    def test(self) -> None:
        Repository = self.apps.get_model("sentry", "Repository")

        with assume_test_silo_mode(SiloMode.MONOLITH):
            display_name_repo = Repository.objects.get(id=self.display_name_repo.id)
            aligned_repo = Repository.objects.get(id=self.aligned_repo.id)
            no_path_repo = Repository.objects.get(id=self.no_path_repo.id)
            github_repo = Repository.objects.get(id=self.github_repo.id)

        # Rewritten to the path slug; config is otherwise unchanged.
        assert display_name_repo.name == "getsentry/example-repo"
        assert display_name_repo.config["path"] == "getsentry/example-repo"

        # Already aligned, missing path, and non-GitLab rows are unchanged.
        assert aligned_repo.name == "getsentry/already-aligned"
        assert no_path_repo.name == "Get Sentry / No Path"
        assert github_repo.name == "getsentry/sentry"
