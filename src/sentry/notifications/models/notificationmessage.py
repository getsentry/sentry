from __future__ import annotations

from typing import Any

from django.db.models import DateTimeField, Field, IntegerField, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    CharField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)


@region_silo_model
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
    error_details: Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    error_code = IntegerField(null=True, db_index=True)

    # Resulting identifier from the vendor that can be leveraged for future interaction with the notification.
    message_identifier = CharField(null=True)
    # Reference to another notification if we choose to modify the original message or reply to it (like start a thread)
    parent_notification_message = FlexibleForeignKey("self", null=True)

    # Related information regarding Alert Rules (Metric Alerts)
    incident = FlexibleForeignKey("sentry.Incident", null=True)
    trigger_action = FlexibleForeignKey("sentry.AlertRuleTriggerAction", null=True)

    # Related information regarding Rules (Issue Alerts)
    rule_fire_history = FlexibleForeignKey("sentry.RuleFireHistory", null=True)
    rule_action_uuid = CharField(null=True, db_index=True)

    date_added = DateTimeField(default=timezone.now)

    # Related information regarding Action (Workflow Engine)
    action = FlexibleForeignKey("workflow_engine.Action", null=True)
    group = FlexibleForeignKey("sentry.Group", null=True)
    # Key for a specific open period of the group (e.g. metric/uptime issues)
    # This does't have to be set for all actions, only for actions that are related to a group which has a defined open period
    open_period = DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationmessage"
        # A notification message should exist for either issue or metric alert, but never both
        constraints = [
            CheckConstraint(
                condition=(
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
            ),
            UniqueConstraint(
                fields=("incident", "trigger_action"),
                condition=Q(
                    error_code__isnull=True,
                    parent_notification_message__isnull=True,
                    incident__isnull=False,
                    trigger_action__isnull=False,
                ),
                name="singular_parent_message_per_incident_and_trigger_action",
            ),
            UniqueConstraint(
                fields=("rule_fire_history", "rule_action_uuid"),
                condition=Q(
                    error_code__isnull=True,
                    parent_notification_message__isnull=True,
                    rule_fire_history__isnull=False,
                    rule_action_uuid__isnull=False,
                ),
                name="singular_parent_message_per_rule_fire_history_and_rule_action",
            ),
        ]

    __repr__ = sane_repr("release_id", "commit_id", "order")
