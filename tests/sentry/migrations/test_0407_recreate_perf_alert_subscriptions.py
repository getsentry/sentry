# from unittest import mock
#
# import pytest
#
# from sentry.snuba.dataset import Dataset
# from sentry.snuba.models import QuerySubscription, SnubaQuery
# from sentry.snuba.tasks import _create_in_snuba
# from sentry.testutils.cases import TestMigrations
#
# pytestmark = pytest.mark.sentry_metrics
#
#
# class BackfillPerfSubscriptionsTest(TestMigrations):
#     migrate_from = "0406_monitor_cleanup"
#     migrate_to = "0407_recreate_perf_alert_subscriptions"
#
#     def setUp(self):
#         super().setUp()
#         self.logging_patch = mock.patch(
#             "sentry.migrations.0407_recreate_perf_alert_subscriptions.logging"
#         )
#         self.logging_mock = self.logging_patch.__enter__()
#
#     def setup_initial_state(self):
#         snuba_query = SnubaQuery.objects.create(
#             type=SnubaQuery.Type.PERFORMANCE.value,
#             dataset=Dataset.PerformanceMetrics.value,
#             query="",
#             time_window=60,
#             resolution=60,
#             environment=self.environment,
#             aggregate="count()",
#         )
#         subscription = QuerySubscription.objects.create(
#             project=self.project,
#             snuba_query=snuba_query,
#             type="something",
#         )
#         subscription.subscription_id = _create_in_snuba(subscription)
#         subscription.save()
#
#     def test(self):
#         assert self.logging_mock.exception.call_count == 0
#
#     def tearDown(self):
#         super().tearDown()
#         self.logging_patch.__exit__(None, None, None)
