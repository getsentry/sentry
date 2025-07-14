from datetime import timedelta

from sentry.constants import ObjectStatus
from sentry.incidents.subscription_processor import SubscriptionProcessor
from sentry.snuba.models import QuerySubscription, SnubaQuery
from tests.sentry.incidents.subscription_processor.test_subscription_processor_base import (
    ProcessUpdateBaseClass,
)


class ProcessUpdateEarlyQuitTest(ProcessUpdateBaseClass):
    def test_removed_detector(self):
        message = self.build_subscription_update(self.sub)
        self.metric_detector.delete()
        subscription_id = self.sub.id
        snuba_query = self.sub.snuba_query
        with (
            self.feature(["organizations:incidents", "organizations:performance-view"]),
            self.tasks(),
        ):
            SubscriptionProcessor(self.sub).process_update(message)
        # TODO: replace the metric that early quits if there's no detector for the subscription processor
        assert not QuerySubscription.objects.filter(id=subscription_id).exists()
        assert not SnubaQuery.objects.filter(id=snuba_query.id).exists()

    def test_removed_project(self):
        message = self.build_subscription_update(self.sub)
        self.project.delete()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with("incidents.alert_rules.ignore_deleted_project")

    def test_pending_deletion_project(self):
        message = self.build_subscription_update(self.sub)
        self.project.update(status=ObjectStatus.DELETION_IN_PROGRESS)
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with("incidents.alert_rules.ignore_deleted_project")

    # TODO: test_no_feature will need to be updated with the new logic for gating metric detectors

    def test_skip_already_processed_update(self):
        self.send_update(self.critical_threshold)
        self.metrics.incr.reset_mock()
        self.send_update(self.critical_threshold)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.critical_threshold, timedelta(hours=-1))
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.critical_threshold, timedelta(hours=1))
        assert self.metrics.incr.call_count == 0
