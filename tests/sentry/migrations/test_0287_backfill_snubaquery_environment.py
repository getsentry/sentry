from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0286_backfill_alertrule_organization"
    migrate_to = "0287_backfill_snubaquery_environment"

    def setup_before_migration(self, apps):
        SnubaQuery = apps.get_model("sentry", "SnubaQuery")

        # the case when environments exists for both orgs that map nicely
        self.to_org = self.create_organization(name="to_org")
        self.transferred_project = self.create_project(
            organization=self.to_org, name="migrate_transfer"
        )
        self.from_env = self.create_environment(
            organization=self.create_organization(name="from_org"), name="production"
        )
        self.to_env = self.create_environment(
            organization=self.to_org, project=self.transferred_project, name="production"
        )
        self.alert_rule = self.create_alert_rule(
            organization=self.to_org, projects=[self.transferred_project], environment=self.to_env
        )

        self.snuba_query = SnubaQuery.objects.get(id=self.alert_rule.snuba_query_id)
        self.snuba_query.environment_id = self.from_env.id
        self.snuba_query.save()

        # the case when an environment exists in the previous org, but not in the new org - need to create an org
        self.create_to_org = self.create_organization(name="to_org")
        self.create_transferred_project = self.create_project(
            organization=self.create_to_org, name="create_migrate_transfer"
        )
        self.create_from_env = self.create_environment(
            organization=self.create_organization(name="create_from_org"), name="production"
        )
        self.create_alert_rule = self.create_alert_rule(
            organization=self.create_to_org,
            projects=[self.create_transferred_project],
        )

        self.create_snuba_query = SnubaQuery.objects.get(id=self.create_alert_rule.snuba_query_id)
        self.create_snuba_query.environment_id = self.create_from_env.id
        self.create_snuba_query.save()

    def tearDown(self):
        super().tearDown()

    def test(self):
        # normal scenario
        self.snuba_query.refresh_from_db()
        self.alert_rule.refresh_from_db()
        assert self.alert_rule.organization_id == self.to_org.id
        assert self.snuba_query.environment_id == self.to_env.id

        # when env needs to be created
        self.create_snuba_query.refresh_from_db()
        self.create_alert_rule.refresh_from_db()
        assert self.create_alert_rule.organization_id == self.create_to_org.id
        assert self.create_snuba_query.environment_id != self.create_from_env.id
        assert self.create_snuba_query.environment.name == self.create_from_env.name
