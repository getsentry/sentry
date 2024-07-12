from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CHECKSTATUS_FAILURE, CheckResult

from sentry.conf.types.kafka_definition import Topic
from sentry.models.project import Project
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.issue_platform import create_issue_platform_occurrence
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)
LAST_UPDATE_REDIS_TTL = timedelta(days=7)


def build_last_update_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-last-update:{md5_text(project_subscription.id).hexdigest()}"


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription
    topic_for_codec = Topic.UPTIME_RESULTS

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def handle_result(self, subscription: UptimeSubscription, result: CheckResult):
        project_subscriptions = list(subscription.projectuptimesubscription_set.all())
        if not project_subscriptions:
            # XXX: Hack for now, just create a fake row. Once we remove this, we should instead
            # drop the uptime subscription
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

        cluster = _get_cluster()
        last_updates: list[str | None] = cluster.mget(
            build_last_update_key(sub) for sub in project_subscriptions
        )

        for last_update_raw, project_subscription in zip(last_updates, project_subscriptions):
            last_update_ms = 0 if last_update_raw is None else int(last_update_raw)
            self.handle_result_for_project(project_subscription, result, last_update_ms)

        logger.info("process_result", extra=result)

    def handle_result_for_project(
        self,
        project_subscription: ProjectUptimeSubscription,
        result: CheckResult,
        last_update_ms: int,
    ):
        cluster = _get_cluster()
        try:
            if result["scheduled_check_time_ms"] <= last_update_ms:
                # If the scheduled check time is older than the most recent update then we've already processed it.
                # We can end up with duplicates due to Kafka replaying tuples, or due to the uptime checker processing
                # the same check multiple times and sending duplicate results.
                # We only ever want to process the first value related to each check, so we just skip and log here
                metrics.incr("uptime.result_processor.skipping_already_processed_update")
                return

            if result["status"] == CHECKSTATUS_FAILURE:
                create_issue_platform_occurrence(result, project_subscription)
        except Exception:
            logger.exception("Failed to process result for uptime project subscription")

        # Now that we've processed the result for this project subscription we track the last update date
        cluster.set(
            build_last_update_key(project_subscription),
            int(result["scheduled_check_time_ms"]),
            ex=LAST_UPDATE_REDIS_TTL,
        )


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
