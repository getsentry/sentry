import importlib
from unittest import mock

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1187_backfill_pullrequest_external_id_str")


class BackfillPullRequestExternalIdStrTest(TestMigrations):
    app = "sentry"
    migrate_from = "1186_pullrequest_external_id_str"
    migrate_to = "1187_backfill_pullrequest_external_id_str"

    def setUp(self):
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.repo = self.create_repo(self.create_project(organization=self.organization))

    def setup_before_migration(self, apps):
        PullRequest = apps.get_model("sentry", "PullRequest")

        def create(key, **kwargs):
            return PullRequest.objects.create(
                organization_id=self.organization.id, repository_id=self.repo.id, key=key, **kwargs
            )

        self.pending = [create(str(i), external_id=1000 + i) for i in range(5)]
        self.no_id = create("no-id")
        self.already_set = create("already-set", external_id=7, external_id_str="7")
        self.string_only = create("string-only", external_id_str="pr_01abc")

    def test_backfill(self):
        for i, pr in enumerate(self.pending):
            pr.refresh_from_db()
            assert pr.external_id_str == str(1000 + i)

        self.no_id.refresh_from_db()
        assert self.no_id.external_id_str is None

        self.already_set.refresh_from_db()
        assert self.already_set.external_id_str == "7"

        self.string_only.refresh_from_db()
        assert self.string_only.external_id_str == "pr_01abc"
