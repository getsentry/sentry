from sentry import features
from sentry.integrations.issue_alert_image_builder import IssueAlertImageBuilder
from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.group import Group
from sentry.types.integrations import ExternalProviderEnum

IMAGE_ALT = {
    PerformanceP95EndpointRegressionGroupType: "P95(transaction.duration)",
    ProfileFunctionRegressionType: "P95(function.duration)",
}


class ImageBlockBuilder(BlockSlackMessageBuilder, IssueAlertImageBuilder):
    def __init__(self, group: Group) -> None:
        super().__init__(
            group=group,
            provider=ExternalProviderEnum.SLACK,
        )

    def build_image_block(self) -> SlackBlock | None:
        # TODO @athena: Clean up! These feature flags are basically equal because they're tied within the same launch
        if features.has(
            "organizations:slack-endpoint-regression-image", self.group.organization
        ) or features.has("organizations:slack-function-regression-image", self.group.organization):
            image_url = self.get_image_url()
            if image_url:
                return self.get_image_block(
                    url=image_url,
                    title=self.group.title,
                    alt=IMAGE_ALT.get(self.group.issue_category),
                )
        return None
