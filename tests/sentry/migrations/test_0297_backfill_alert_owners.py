# It seems like when we unapply NOT NULL as part of rolling back the migration in this test that
# the zero downtime migrations library has some problem that causes the not null constraint to not
# be removed. Disabling this test for now.
# from sentry.testutils.cases import TestMigrations
#
#
# class TestBackfill(TestMigrations):
#     migrate_from = "0296_alertrule_type_not_null"
#     migrate_to = "0297_backfill_alert_owners"
#
#     def setup_before_migration(self, apps):
#         new_user = self.create_user("b@example.com")
#         self.alert_rule_invalid_user = self.create_alert_rule(
#             name="test_alert_invalid_user",
#             organization=self.organization,
#             projects=[self.project],
#             owner=new_user.actor.get_actor_tuple(),
#         )
#
#         self.alert_rule_valid_user = self.create_alert_rule(
#             name="test_alert_valid_user",
#             organization=self.project.organization,
#             projects=[self.project],
#             owner=self.user.actor.get_actor_tuple(),
#         )
#
#         organization = self.create_organization(name="New Org", owner=new_user)
#         new_team = self.create_team(organization=organization, name="New Team", members=[self.user])
#         self.alert_rule_invalid_team = self.create_alert_rule(
#             name="test_alert_invalid_team",
#             organization=self.organization,
#             projects=[self.project],
#             owner=new_team.actor.get_actor_tuple(),
#         )
#         self.valid_team = self.team.actor.get_actor_tuple()
#         self.alert_rule_valid_team = self.create_alert_rule(
#             name="test_alert_valid_team",
#             organization=self.organization,
#             projects=[self.project],
#             owner=self.valid_team,
#         )
#
#     def tearDown(self):
#         super().tearDown()
#
#     def test(self):
#         self.alert_rule_invalid_user.refresh_from_db()
#         assert self.alert_rule_invalid_user.owner is None
#
#         self.alert_rule_valid_user.refresh_from_db()
#         assert (
#             self.alert_rule_valid_user.owner.get_actor_identifier()
#             == self.user.actor.get_actor_tuple().get_actor_identifier()
#         )
#
#         self.alert_rule_invalid_team.refresh_from_db()
#         assert self.alert_rule_invalid_team.owner is None
#
#         self.alert_rule_valid_team.refresh_from_db()
#         assert (
#             self.alert_rule_valid_team.owner.get_actor_identifier()
#             == self.valid_team.get_actor_identifier()
#         )
