# from sentry.models.actor import Actor
# from sentry.models.user import User
# from sentry.testutils.cases import TestMigrations
#
#
# class BackfillActorsTest(TestMigrations):
#     migrate_from = "0402_add_organizationmembermapping_table"
#     migrate_to = "0403_backfill_actors"
#
#     def setup_initial_state(self):
#         self.new_user = self.create_user("b@example.com")
#         organization = self.create_organization(name="New Org", owner=self.new_user)
#         self.new_team = self.create_team(
#             organization=organization, name="New Team", members=[self.user]
#         )
#
#     def setup_before_migration(self, apps):
#         pass
#
#     def test(self):
#         self.new_user = User.objects.get(id=self.new_user.id)
#         assert self.new_user.actor_id
#         assert Actor.objects.get(user_id=self.new_user.id).id == self.new_user.actor_id
#         assert Actor.objects.get(team_id=self.new_team.id).id == self.new_team.actor_id
