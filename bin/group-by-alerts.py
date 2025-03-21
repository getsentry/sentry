from sentry.runner import configure

configure()
import logging

import sentry_sdk

from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.snuba.models import SnubaQueryEventType

sentry_sdk.init(None)

logger = logging.getLogger(__name__)

CRITICAL_TRIGGER_LABEL = "critical"


def main():
    org = Organization.objects.get(id=1)
    project = Project.objects.get(id=1)

    # Create a basic alert rule that triggers when error count > 1 in 1 minute
    alert_rule = create_alert_rule(
        organization=org,
        projects=[project],
        name="Basic Error Count Alert",
        query="",  # Empty query means all errors
        aggregate="count()",
        time_window=1,  # 1 minute
        threshold_type=AlertRuleThresholdType.ABOVE,
        threshold_period=1,
        event_types=[SnubaQueryEventType.EventType.ERROR],
    )

    # Create a critical trigger that fires when count > 1
    critical_trigger = create_alert_rule_trigger(
        alert_rule=alert_rule,
        label=CRITICAL_TRIGGER_LABEL,
        alert_threshold=1,
    )

    # Add email action to the critical trigger
    create_alert_rule_trigger_action(
        trigger=critical_trigger,
        type=ActionService.EMAIL,
        target_type=ActionTarget.SPECIFIC,
        target_identifier="admin@sentry.io",
    )

    logger.info("Created alert rule: %s (ID: %s)", alert_rule.name, alert_rule.id)


if __name__ == "__main__":
    main()
