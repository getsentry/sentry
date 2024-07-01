from __future__ import annotations

import logging

from django.conf import settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CHECKSTATUS_FAILURE, CheckResult

from sentry.conf.types.kafka_definition import Topic
from sentry.models.project import Project
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.issue_platform import create_issue_platform_occurrence
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription

logger = logging.getLogger(__name__)


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription
    topic_for_codec = Topic.UPTIME_RESULTS

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def handle_result(self, subscription: UptimeSubscription, result: CheckResult):
        project_subscriptions = list(subscription.projectuptimesubscription_set.all())
        if not project_subscriptions:
            # XXX: Hack for now, just create a fake row
            try:
                project = Project.objects.get(id=settings.UPTIME_POC_PROJECT_ID)
            except Project.DoesNotExist:
                pass
            else:
                project_subscriptions = [
                    ProjectUptimeSubscription(
                        id=subscription.id,
                        uptime_subscription=subscription,
                        project=project,
                    )
                ]

        for project_subscription in project_subscriptions:
            if result["status"] == CHECKSTATUS_FAILURE:
                create_issue_platform_occurrence(result, project_subscription)

        logger.info("process_result", extra=result)


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
