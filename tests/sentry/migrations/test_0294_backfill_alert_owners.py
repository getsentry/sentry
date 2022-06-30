from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0293_restore_metrics_based_alerts"
    migrate_to = "0294_backfill_alert_owners"

    def setup_before_migration(self, apps):
        AlertRule = apps.get_model("sentry", "AlertRule")

        alert_owner = self.create_user(email="test@example.com")
        # typical case
        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            owner=alert_owner.actor.get_actor_tuple,
        )

        ar = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)
        ar.save()

    def tearDown(self):
        super().tearDown()

    def test(self):
        assert self.alert_rule.owner is None
