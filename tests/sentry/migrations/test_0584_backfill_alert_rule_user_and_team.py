from sentry.models.actor import get_actor_for_user
from sentry.testutils.cases import TestMigrations


class BackfillAlertRuleUserAndTeam(TestMigrations):
    migrate_from = "0583_add_early_adopter_to_organization_mapping"
    migrate_to = "0584_backfill_alert_rule_user_and_team"

    def setup_initial_state(self):
        self.ars = []
        for i in range(10):
            ar = self.create_alert_rule(self.organization, owner=get_actor_for_user(self.user))
            ar.update(user_id=None, team_id=None)
            self.ars.append(ar)

    def test_backfill_of_org_mappings(self):
        for ar in self.ars:
            ar.refresh_from_db()
            ar._validate_actor()
