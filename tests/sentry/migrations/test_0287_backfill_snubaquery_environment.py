# from sentry.testutils.cases import TestMigrations
#
#
# class TestBackfill(TestMigrations):
#     migrate_from = "0286_backfill_alertrule_organization"
#     migrate_to = "0287_backfill_snubaquery_environment"
#
#     def setup_before_migration(self, apps):
#         SnubaQuery = apps.get_model("sentry", "SnubaQuery")
#
#         self.from_org = self.create_organization(name="from_org")
#         self.to_org = self.create_organization(name="to_org")
#         self.transferred_project = self.create_project(
#             organization=self.to_org, name="migrate_transfer"
#         )
#         self.from_env = self.create_environment(organization=self.from_org, name="production")
#         self.to_env = self.create_environment(
#             organization=self.to_org, project=self.transferred_project, name="production"
#         )
#         self.alert_rule = self.create_alert_rule(
#             organization=self.to_org, projects=[self.transferred_project], environment=self.to_env
#         )
#
#         self.snuba_query = SnubaQuery.objects.get(id=self.alert_rule.snuba_query_id)
#         self.snuba_query.environment_id = self.from_env.id
#         self.snuba_query.save()
#
#     def tearDown(self):
#         super().tearDown()
#
#     def test(self):
#         assert self.alert_rule.organization_id == self.to_org.id
#         assert self.snuba_query.environment_id == self.to_env.id
