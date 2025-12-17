import logging
import random
from dataclasses import dataclass

from sentry import features, options
from sentry.models.organization import Organization
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.organizations.services.organization.model import RpcOrganization

logger = logging.getLogger(__name__)


@dataclass
class NotificationRolloutService:
    """
    Holds all checks and logic for rolling out a new notification to the platform.
      - Checks if the organization has access to the platform via rollout stage Feature Flags
      - Gets the rollout rate for the source from the option mapped to the rollout stage
    """

    organization: RpcOrganization | Organization

    def should_notify(self, source: NotificationTemplateSource) -> bool:
        option_key = self.has_feature_flag_access()
        if option_key is None:
            return False

        source_rollout_rate = self.get_rollout_rate(option_key, source)
        return random.randint(0, 99) < 100 * source_rollout_rate

    def has_feature_flag_access(self) -> str | None:
        internal_testing = features.has(
            "organizations:notification-platform.internal-testing", self.organization
        )
        is_sentry = features.has("organizations:notification-platform.is-sentry", self.organization)
        early_adopter = features.has(
            "organizations:notification-platform.early-adopter", self.organization
        )
        general_access = features.has(
            "organizations:notification-platform.general-access", self.organization
        )

        option_key = None
        if internal_testing:
            option_key = "notifications.platform-rollout.internal-testing"
        elif is_sentry:
            option_key = "notifications.platform-rollout.is-sentry"
        elif early_adopter:
            option_key = "notifications.platform-rollout.early-adopter"
        elif general_access:
            option_key = "notifications.platform-rollout.general-access"

        return option_key

    def get_rollout_rate(self, option_key: str, source: NotificationTemplateSource) -> float:
        try:
            rollout_rates = options.get(option_key)
        except options.UnknownOption:
            logger.warning(
                "notification.platform.has_access.unknown_option",
                extra={
                    "organization_id": self.organization.id,
                    "source": source,
                    "option_key": option_key,
                },
            )
            return 0.0

        try:
            source_rollout_rate = rollout_rates[source]
        except KeyError:
            logger.warning(
                "notification.platform.has_access.unknown_source",
                extra={
                    "organization_id": self.organization.id,
                    "source": source,
                    "option_key": option_key,
                    "rollout_rates": rollout_rates,
                },
            )
            return 0.0

        return source_rollout_rate
