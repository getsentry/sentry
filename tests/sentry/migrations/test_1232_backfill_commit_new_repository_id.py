import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip(reason="Migration already applied; test is slow and only useful before merge")
class BackfillCommitNewRepositoryIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1231_drop_group_logger_indexes"
    migrate_to = "1232_backfill_commit_new_repository_id"

    def setup_initial_state(self):
        self.organization = self.create_organization()
        project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(project)
        self.other_repo = self.create_repo(project, name="other-repo")

    def setup_before_migration(self, apps):
        Commit = apps.get_model("sentry", "Commit")

        def create(key, repository_id, **kwargs):
            return Commit.objects.create(
                organization_id=self.organization.id,
                repository_id=repository_id,
                key=key,
                **kwargs,
            )

        self.pending = [create(f"pending-{i}", self.repo.id) for i in range(5)]
        self.pending_other = create("pending-other", self.other_repo.id)
        self.already_set = create("already-set", self.repo.id, new_repository_id=self.repo.id)

        # Historical models skip Commit.save(), so these start out null.
        assert all(c.new_repository_id is None for c in self.pending)

    def test_backfill(self):
        for commit in self.pending:
            commit.refresh_from_db()
            assert commit.new_repository_id == self.repo.id

        self.pending_other.refresh_from_db()
        assert self.pending_other.new_repository_id == self.other_repo.id

        self.already_set.refresh_from_db()
        assert self.already_set.new_repository_id == self.repo.id
