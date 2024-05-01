import logging

import sentry_sdk

from sentry import features
from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.time_utils import (
    get_approx_start_time,
    get_relative_time,
)
from sentry.issues.grouptype import PerformanceP95EndpointRegressionGroupType
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.utils.performance_issues.detectors.utils import escape_transaction

logger = logging.getLogger("sentry.integrations.slack")


class ImageBlockBuilder(BlockSlackMessageBuilder):
    def __init__(self, group: Group) -> None:
        super().__init__()
        self.group = group

    def build_image_block(self) -> SlackBlock | None:
        if (
            features.has("organizations:slack-endpoint-regression-image", self.group.organization)
            and self.group.issue_type == PerformanceP95EndpointRegressionGroupType
        ):
            return self._build_endpoint_regression_image_block()

        # TODO: Add support for other issue alerts
        return None

    def _build_endpoint_regression_image_block(self) -> SlackBlock | None:
        logger.info(
            "build_endpoint_regression_image.attempt",
            extra={
                "group_id": self.group.id,
            },
        )

        try:
            organization = self.group.organization
            event = self.group.get_latest_event_for_environments()
            if event is None or event.transaction is None or event.occurrence is None:
                return None
            transaction_name = escape_transaction(event.transaction)
            period = get_relative_time(anchor=get_approx_start_time(self.group), relative_days=14)
            resp = client.get(
                auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
                user=None,
                path=f"/organizations/{organization.slug}/events-stats/",
                data={
                    "yAxis": ["count()", "p95(transaction.duration)"],
                    "referrer": Referrer.API_ALERTS_CHARTCUTERIE,
                    "query": f"event.type:transaction transaction:{transaction_name}",
                    "project": self.group.project.id,
                    "start": period["start"].strftime("%Y-%m-%d %H:%M:%S"),
                    "end": period["end"].strftime("%Y-%m-%d %H:%M:%S"),
                    "dataset": "metrics",
                },
            )

            url = charts.generate_chart(
                ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
                data={
                    "evidenceData": event.occurrence.evidence_data,
                    "percentileData": resp.data["p95(transaction.duration)"]["data"],
                },
            )

            return self.get_image_block(
                url=url,
                title=self.group.title,
                alt="P95(transaction.duration)",
            )

        except Exception as e:
            logger.exception(
                "build_endpoint_regression_image.failed",
                extra={
                    "exception": e,
                },
            )
            sentry_sdk.capture_exception()
            return None
