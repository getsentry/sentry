from django.db.models import CheckConstraint, DateTimeField, IntegerField, Q
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    CharField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_only_model,
    sane_repr,
)


@region_silo_only_model
class NotificationMessage(Model):
    """
    Data model represents the aggregate for an entire notification message.
    A notification message must always have the resulting identifier that was sent back if there was no error.
    When there is an error, there will be no identifier to leverage or store.

    If a notification message has an error, the resulting error code and details will be saved.
    This information will then be leveraged to show the user which notifications are consistently failing.
    An example of this would be if a Slack channel no longer exists.

    The data model hold the singular gateway for both Metric, and Issue, Alerts.
    Following the specific data relationship, you should be able to find the specific rule, organization, project, and
    incident or group event that this notification message was enacted.

    If any notification message is in relation to another notification message, you should be able to find the original
    notification message through the parent notification message relation.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Related information regarding failed notifications.
    # Leveraged to help give the user visibility into notifications that are consistently failing.
    error_details = JSONField(null=True)
    error_code = IntegerField(null=True, db_index=True)

    # Resulting identifier from the vendor that can be leveraged for future interaction with the notification.
    message_identifier = CharField(null=True, db_index=True)
    # Reference to another notification if we choose to modify the original message or reply to it (like start a thread)
    parent_notification_message = FlexibleForeignKey("self", null=True)

    # Related information regarding Alert Rules (Metric Alerts)
    incident = FlexibleForeignKey("sentry.Incident", null=True)
    trigger_action = FlexibleForeignKey("sentry.AlertRuleTriggerAction", null=True)

    # Related information regarding Rules (Issue Alerts)
    rule_fire_history = FlexibleForeignKey("sentry.RuleFireHistory", null=True)
    rule_action_uuid = CharField(null=True, db_index=True)

    date_added = DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationmessage"
        # A notification message should exist for either issue or metric alert, but never both
        constraints = [
            CheckConstraint(
                check=(
                    (
                        Q(incident__isnull=False, trigger_action__isnull=False)
                        & Q(rule_fire_history__isnull=True, rule_action_uuid__isnull=True)
                    )
                    | (
                        Q(incident__isnull=True, trigger_action__isnull=True)
                        & Q(rule_fire_history__isnull=False, rule_action_uuid__isnull=False)
                    )
                ),
                name="notification_for_issue_xor_metric_alert",
            )
        ]

    __repr__ = sane_repr("release_id", "commit_id", "order")
