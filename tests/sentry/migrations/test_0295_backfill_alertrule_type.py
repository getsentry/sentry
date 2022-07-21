# It seems like when we unapply NOT NULL as part of rolling back the migration in this test that
# the zero downtime migrations library has some problem that causes the not null constraint to not
# be removed. Disabling this test for now.
# from sentry.snuba.dataset import Dataset
# from sentry.testutils.cases import TestMigrations
#
#
# class BackfillAlertRuleTypeTest(TestMigrations):
#     migrate_from = "0294_alertrule_type"
#     migrate_to = "0295_backfill_alertrule_type"
#
#     def setup_initial_state(self):
#         self.alerts = [
#             self.create_alert_rule(query="", dataset=dataset) for dataset in Dataset
#         ]
#
#     def setup_before_migration(self, apps):
#         AlertRule = apps.get_model("sentry", "AlertRule")
#         # Make sure type is null, since this will be autofilled later on
#         AlertRule.objects_with_snapshots.filter(id__in=[alert.id for alert in self.alerts]).update(type=None)
#
#     def test(self):
#         AlertRule = self.apps.get_model("sentry", "AlertRule")
#         for alert, expected_type in zip(
#             self.alerts,
#             [
#                 AlertRule.Type.ERROR,
#                 AlertRule.Type.PERFORMANCE,
#                 AlertRule.Type.CRASH_RATE,
#                 AlertRule.Type.CRASH_RATE,
#             ],
#         ):
#             alert = AlertRule.objects.get(id=alert.id)
#             assert alert.type == expected_type.value
