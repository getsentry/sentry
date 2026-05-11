from __future__ import annotations

from django.db import models
from django.db.models import DateTimeField, IntegerField, Q
from django.db.models.constraints import UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import CharField, FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.jsonfield import LegacyTextJSONField


@cell_silo_model
class NotificationMessage(Model):
    """
    Data model represents the aggregate for an entire notification message.
    A notification message must always have the resulting identifier that was sent back if there was no error.
    When there is an error, there will be no identifier to leverage or store.

    If a notification message has an error, the resulting error code and details will be saved.
    This information will then be leveraged to show the user which notifications are consistently failing.
    An example of this would be if a Slack channel no longer exists.

    The data model hold the singular gateway for both Metric and Issue Alerts.
    Following the specific data relationship, you should be able to find the specific rule, organization, project, and
    incident or group event that this notification message was enacted.

    If any notification message is in relation to another notification message, you should be able to find the original
    notification message through the parent notification message relation.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Related information regarding failed notifications.
    # Leveraged to help give the user visibility into notifications that are consistently failing.
    error_details = LegacyTextJSONField(null=True)
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
    # Key for a start of aspecific open period of the group (e.g. metric/uptime issues)
    # This doesn't have to be set for all actions, only for actions that are related to a group which has a defined open period
    open_period_start = DateTimeField(null=True)

    class Meta:
        app_label = "notifications"
        db_table = "sentry_notificationmessage"
        indexes = [
            models.Index(
                fields=["group", "action", "date_added"],
                name="idx_notifmsg_group_action_date",
            ),
        ]
        constraints = [
            # 1 parent message per incident and trigger action
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
            # A row is either a metric-alert message (incident + trigger_action)
            # or a workflow-action message (action + group), never both.
            models.CheckConstraint(
                condition=(
                    Q(
                        incident__isnull=False,
                        trigger_action__isnull=False,
                        action__isnull=True,
                        group__isnull=True,
                    )
                    | Q(
                        incident__isnull=True,
                        trigger_action__isnull=True,
                        action__isnull=False,
                        group__isnull=False,
                    )
                ),
                name="notifmsg_metric_or_workflow_exclusive",
            ),
        ]

    __repr__ = sane_repr("id", "message_identifier", "error_code")
