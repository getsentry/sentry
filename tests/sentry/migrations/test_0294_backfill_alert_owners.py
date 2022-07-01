from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0293_restore_metrics_based_alerts"
    migrate_to = "0294_backfill_alert_owners"

    def setup_before_migration(self, apps):
        new_user = self.create_user("b@example.com")
        organization = self.create_organization(name="New Org", owner=new_user)
        self.alert_rule_user = self.create_alert_rule(
            name="test_alert_user",
            organization=organization,
            projects=[self.project],
            owner=self.user.actor.get_actor_tuple(),
        )

        new_team = self.create_team(
            organization=self.project.organization, name="New Team", members=[self.user]
        )
        self.alert_rule_team = self.create_alert_rule(
            name="test_alert_team",
            organization=self.organization,
            projects=[self.project],
            owner=new_team.actor.get_actor_tuple(),
        )

    def tearDown(self):
        super().tearDown()

    def test(self):
        assert self.alert_rule_user.refresh_from_db() is None
        assert self.alert_rule_team.refresh_from_db() is None
