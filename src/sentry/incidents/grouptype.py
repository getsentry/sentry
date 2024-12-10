from dataclasses import dataclass

from sentry.incidents.endpoints.validators import MetricAlertsDetectorValidator
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler


class MetricAlertDetectorHandler(StatefulDetectorHandler[QuerySubscriptionUpdate]):
    pass


# Example GroupType and detector handler for metric alerts. We don't create these issues yet, but we'll use something
# like these when we're sending issues as alerts
@dataclass(frozen=True)
class MetricAlertFire(GroupType):
    type_id = 8001
    slug = "metric_alert_fire"
    description = "Metric alert fired"
    category = GroupCategory.METRIC_ALERT.value
    creation_quota = Quota(3600, 60, 100)
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_handler = MetricAlertDetectorHandler
    detector_validator = MetricAlertsDetectorValidator
    detector_config_schema = {}  # TODO(colleen): update this

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        # TODO - Figure out how to do this correctly
        return True
