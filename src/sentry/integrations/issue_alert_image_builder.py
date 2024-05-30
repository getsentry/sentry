import logging

import sentry_sdk
from django.core.cache import cache

from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.integrations.slack.message_builder.time_utils import (
    get_approx_start_time,
    get_relative_time,
)
from sentry.integrations.types import ExternalProviderEnum
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.performance_issues.detectors import utils

logger = logging.getLogger("sentry.chartcuterie")


class IssueAlertImageBuilder:
    def __init__(self, group: Group, provider: ExternalProviderEnum) -> None:
        self.group = group
        self.provider = provider
        self.cache_key = f"chartcuterie-image:{self.group.id}"
        self.tags = {
            "provider": self.provider,
            "issue_category": self.group.issue_category,
        }

    def get_image_url(self) -> str | None:
        try:
            metrics.incr("chartcuterie.issue_alert.attempt", tags=self.tags)
            image_url = cache.get(self.cache_key)
            if image_url:
                metrics.incr("chartcuterie.issue_alert.success", tags=self.tags)
                return image_url

            lock_key = f"lock_{self.cache_key}"
            lock_acquired = cache.add(key=lock_key, value="locked", timeout=120)
            if lock_acquired:
                # Checking again in case another thread generated the image while
                # this thread was acquiring the lock
                image_url = cache.get(self.cache_key)
                if image_url is None:
                    if self.group.issue_type == PerformanceP95EndpointRegressionGroupType:
                        image_url = self._get_endpoint_regression_image_url()
                    elif self.group.issue_type == ProfileFunctionRegressionType:
                        image_url = self._get_function_regression_image_url()
                if image_url:
                    metrics.incr("chartcuterie.issue_alert.success", tags=self.tags)
                    cache.delete(key=lock_key)
                    return image_url
            else:
                # There is a chance that another thread generated the image
                image_url = cache.get(self.cache_key)
                if image_url:
                    metrics.incr("chartcuterie.issue_alert.success", tags=self.tags)
                    return image_url
        except Exception as e:
            logger.exception(
                "issue_alert_chartcuterie_image.failed",
                extra={"exception": e, "group_id": self.group.id},
            )
            sentry_sdk.capture_exception()
            if lock_acquired:
                cache.delete(key=lock_key)
        return None

    def _get_endpoint_regression_image_url(self) -> str | None:
        organization = self.group.organization
        event = self.group.get_latest_event_for_environments()
        if event is None or event.transaction is None or event.occurrence is None:
            return None
        transaction_name = utils.escape_transaction(event.transaction)
        period = get_relative_time(anchor=get_approx_start_time(self.group), relative_days=14)
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events-stats/",
            data={
                "yAxis": ["count()", "p95(transaction.duration)"],
                "referrer": Referrer.API_ALERTS_CHARTCUTERIE,
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
            cache_key=self.cache_key,
        )

    def _get_function_regression_image_url(self) -> str | None:
        organization = self.group.organization
        event = self.group.get_latest_event_for_environments()
        if event is None or event.occurrence is None:
            return None

        period = get_relative_time(anchor=get_approx_start_time(self.group), relative_days=14)
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events-stats/",
            data={
                "dataset": "profileFunctions",
                "referrer": Referrer.API_ALERTS_CHARTCUTERIE,
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
            cache_key=self.cache_key,
        )
