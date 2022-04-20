from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0285_add_organization_member_team_role"
    migrate_to = "0286_backfill_alertrule_organization"

    def setup_before_migration(self, apps):
        AlertRule = apps.get_model("sentry", "AlertRule")

        # typical case
        self.alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project]
        )

        ar = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)
        ar.organization_id = self.create_organization(name="diff_org").id
        ar.save()

        # somehow alert rule org got nulled out
        self.alert_rule_no_org = self.create_alert_rule(
            organization=self.create_organization(), projects=[self.create_project()]
        )
        self.alert_rule_no_org.organization_id = None
        self.alert_rule_no_org.save()

    def tearDown(self):
        super().tearDown()

    def test(self):
        assert self.alert_rule.organization_id == self.project.organization.id
        assert not self.alert_rule_no_org.organization_id
