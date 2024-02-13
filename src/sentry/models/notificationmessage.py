from django.db.models import DateTimeField
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
    A notification message must always have the request and response that it took, along with the resulting identifier
    that was sent back.

    The data model hold the singular gateway for both Metric, and Issue, Alerts.
    Following the specific data relationship, you should be able to find the specific rule, organization, project, and
    incident or group event that this notification message was enacted.

    If any notification message is in relation to another notification message, you should be able to find the original
    notification message through the parent notification message relation.
    """

    __relocation_scope__ = RelocationScope.Excluded

    request = JSONField(null=False)
    response = JSONField(null=False)
    message_identifier = CharField(null=False, blank=False, db_index=True)
    parent_notification_message = FlexibleForeignKey("self", null=True)

    # related information regarding Alert Rules (Metric Alerts)
    incident = FlexibleForeignKey("sentry.Incident", null=True)
    trigger_action = FlexibleForeignKey("sentry.AlertRuleTriggerAction", null=True, db_index=True)

    # related information regarding Rules (Issue Alerts)
    rule_fire_history = FlexibleForeignKey("sentry.RuleFireHistory", null=True)
    rule_action_uuid = CharField(null=True, db_index=True)

    date_added = DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationmessage"

    __repr__ = sane_repr("release_id", "commit_id", "order")
