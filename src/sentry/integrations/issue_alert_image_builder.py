import logging

import sentry_sdk
from django.conf import settings
from django.core.cache import cache

from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartSize, ChartType
from sentry.integrations.time_utils import get_approx_start_time, get_relative_time
from sentry.integrations.types import ExternalProviderEnum
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.manager import LockManager
from sentry.utils.performance_issues.detectors import utils
from sentry.utils.services import build_instance_from_options_of_type

logger = logging.getLogger("sentry.chartcuterie")
locks = LockManager(
    build_instance_from_options_of_type(LockBackend, settings.SENTRY_DEFAULT_LOCKS_BACKEND_OPTIONS)
)
DEFAULT_CHART_SIZE = ChartSize(width=600, height=200)


class IssueAlertImageBuilder:
    def __init__(self, group: Group, provider: ExternalProviderEnum) -> None:
        self.group = group
        self.provider = provider
        self.cache_key = f"chartcuterie-image:{self.group.id}"
        self.tags = {
            "provider": self.provider,
            "issue_category": self.group.issue_category,
        }
        self.lock = locks.get(key=f"lock_{self.cache_key}", duration=10, name="issue_alert_image")

    def get_image_url(self) -> str | None:
        try:
            metrics.incr("chartcuterie.issue_alert.attempt", tags=self.tags)
            image_url = cache.get(self.cache_key)
            if image_url is None:
                self.lock.blocking_acquire(initial_delay=1, timeout=30)
                # Checking again in case another thread generated the image while
                # this thread was acquiring the lock
                image_url = cache.get(self.cache_key)
                if image_url is None:
                    if self.group.issue_type == PerformanceP95EndpointRegressionGroupType:
                        image_url = self._get_endpoint_regression_image_url()
                    elif self.group.issue_type == ProfileFunctionRegressionType:
                        image_url = self._get_function_regression_image_url()
                self.lock.release()
        except UnableToAcquireLock:
            # There is a chance that another thread generated the image
            image_url = cache.get(self.cache_key)
            if not image_url:
                logger.warning(
                    "issue_alert_chartcuterie_image.lock.failed",
                    extra={"group_id": self.group.id},
                )
        except Exception as e:
            logger.exception(
                "issue_alert_chartcuterie_image.failed",
                extra={"exception": e, "group_id": self.group.id},
            )
            sentry_sdk.capture_exception()
            if self.lock.locked():
                self.lock.release()

        if image_url:
            metrics.incr("chartcuterie.issue_alert.success", tags=self.tags)
            # We don't want to regenerate the image if another type of notification is sending the same one
            # For example slack notification and email notification for the same issue
            cache.set(self.cache_key, image_url, timeout=60 * 5)
            return image_url
        logger.warning(
            "issue_alert_chartcuterie_image.empty_image",
            extra={"group_id": self.group.id},
        )
        return None

    def _get_endpoint_regression_image_url(self) -> str | None:
        organization = self.group.organization
        event = self.group.get_latest_event_for_environments()
        if event is None or event.transaction is None or event.occurrence is None:
            logger.warning(
                "issue_alert_chartcuterie_image.empty_event",
                extra={"event": event},
            )
            return None
        transaction_name = utils.escape_transaction(event.transaction)
        period = get_relative_time(anchor=get_approx_start_time(self.group), relative_days=14)
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events-stats/",
            data={
                "yAxis": ["count()", "p95(transaction.duration)"],
                "referrer": Referrer.API_ENDPOINT_REGRESSION_ALERT_CHARTCUTERIE,
                "query": f'event.type:transaction transaction:"{transaction_name}"',
                "project": self.group.project.id,
                "start": period["start"].strftime("%Y-%m-%d %H:%M:%S"),
                "end": period["end"].strftime("%Y-%m-%d %H:%M:%S"),
                "dataset": "metrics",
            },
        )

        return charts.generate_chart(
            ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
            data={
                "evidenceData": event.occurrence.evidence_data,
                "percentileData": resp.data["p95(transaction.duration)"]["data"],
            },
            size=DEFAULT_CHART_SIZE,
        )

    def _get_function_regression_image_url(self) -> str | None:
        organization = self.group.organization
        event = self.group.get_latest_event_for_environments()
        if event is None or event.occurrence is None:
            logger.warning(
                "issue_alert_chartcuterie_image.empty_event",
                extra={"event": event},
            )
            return None

        period = get_relative_time(anchor=get_approx_start_time(self.group), relative_days=14)
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events-stats/",
            data={
                "dataset": "profileFunctions",
                "referrer": Referrer.API_FUNCTION_REGRESSION_ALERT_CHARTCUTERIE,
                "project": self.group.project.id,
                "start": period["start"].strftime("%Y-%m-%d %H:%M:%S"),
                "end": period["end"].strftime("%Y-%m-%d %H:%M:%S"),
                "yAxis": ["p95()"],
                "query": f"fingerprint:{event.occurrence.evidence_data['fingerprint']}",
            },
        )

        # Convert the aggregate range from nanoseconds to milliseconds
        evidence_data = {
            "aggregate_range_1": event.occurrence.evidence_data["aggregate_range_1"] / 1e6,
            "aggregate_range_2": event.occurrence.evidence_data["aggregate_range_2"] / 1e6,
            "breakpoint": event.occurrence.evidence_data["breakpoint"],
        }

        return charts.generate_chart(
            ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION,
            data={
                "evidenceData": evidence_data,
                "rawResponse": resp.data,
            },
            size=DEFAULT_CHART_SIZE,
        )
