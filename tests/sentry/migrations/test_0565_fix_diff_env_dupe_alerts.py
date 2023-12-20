import pytest

from sentry.constants import ObjectStatus
from sentry.models.outbox import outbox_context
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("External actor replication won't work with project rule factories")
class FixDiffEnvDupeAlerts(TestMigrations):
    migrate_from = "0564_commitfilechange_delete_language_column"
    migrate_to = "0565_fix_diff_env_dupe_alerts"

    def setup_initial_state(self):
        with outbox_context(flush=False):
            dev_env = self.create_environment(
                self.project, name="dev", organization=self.organization
            )
            prod_env = self.create_environment(
                self.project, name="prod", organization=self.organization
            )
            self.rule1 = self.create_project_rule(project=self.project, environment_id=dev_env.id)
            self.rule2 = self.create_project_rule(project=self.project, environment_id=prod_env.id)
            self.rule2.status = ObjectStatus.DISABLED
            self.rule2.save()

            assert self.rule2.status == ObjectStatus.DISABLED
            assert self.rule1.status == ObjectStatus.ACTIVE

    def test(self):
        self.rule1.refresh_from_db()
        self.rule2.refresh_from_db()
        assert self.rule1.status == ObjectStatus.ACTIVE
        assert self.rule2.status == ObjectStatus.ACTIVE
