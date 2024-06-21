from __future__ import annotations

import logging

from django.conf import settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CHECKSTATUS_FAILURE, CheckResult

from sentry.models.project import Project
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.remote_subscriptions.models import RemoteSubscription
from sentry.uptime.issue_platform import create_issue_platform_occurrence
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription

logger = logging.getLogger(__name__)


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def handle_result(self, result: CheckResult):
        try:
            uptime_subscription = self.get_subscription(result)
        except (UptimeSubscription.DoesNotExist, RemoteSubscription.DoesNotExist):
            # XXX: Create fake rows for now
            remote_subscription = RemoteSubscription(
                type="test", subscription_id=result["subscription_id"]
            )
            uptime_subscription = UptimeSubscription(
                remote_subscription=remote_subscription,
                url="https://sentry.io/",
                interval_seconds=300,
                timeout_ms=500,
            )

        project_subscriptions = list(uptime_subscription.projectuptimesubscription_set.all())
        if not project_subscriptions:
            # XXX: Hack for now, just create a fake row
            try:
                project = Project.objects.get(id=settings.UPTIME_POC_PROJECT_ID)
            except Project.DoesNotExist:
                pass
            else:
                project_subscriptions = [
                    ProjectUptimeSubscription(
                        id=uptime_subscription.id,
                        uptime_subscription=uptime_subscription,
                        project=project,
                    )
                ]

        for project_subscription in project_subscriptions:
            if result["status"] == CHECKSTATUS_FAILURE:
                create_issue_platform_occurrence(result, project_subscription)

        logger.info("process_result", extra=result)


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
