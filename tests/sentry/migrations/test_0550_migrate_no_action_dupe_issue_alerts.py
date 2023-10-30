import pytest

from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("External actor replication won't work with project rule factories")
class MigrateNoActionDupleIssueAlerts(TestMigrations):
    migrate_from = "0549_re_add_groupsubscription_columns"
    migrate_to = "0550_migrate_no_action_dupe_issue_alerts"

    def setup_initial_state(self):
        self.no_action_rule = self.create_project_rule(
            project=self.project, allow_no_action_data=True
        )
        self.rule1 = self.create_project_rule(project=self.project)
        self.rule2 = self.create_project_rule(project=self.project)
        assert self.no_action_rule.status == ObjectStatus.ACTIVE
        assert self.rule2.status == ObjectStatus.ACTIVE
        assert self.rule1.status == ObjectStatus.ACTIVE

    def test(self):
        self.no_action_rule.refresh_from_db()
        self.rule1.refresh_from_db()
        self.rule2.refresh_from_db()
        assert self.no_action_rule.status == ObjectStatus.DISABLED
        assert self.rule1.status == ObjectStatus.DISABLED
        assert self.rule2.status == ObjectStatus.ACTIVE
