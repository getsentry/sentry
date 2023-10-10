from django.db.models import DateTimeField, Index
from django.db.models.fields import UUIDField
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import CharField, FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class RuleFireHistory(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    rule = FlexibleForeignKey("sentry.Rule")
    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    event_id = CharField("event_id", max_length=32, null=True)
    date_added = DateTimeField(default=timezone.now, db_index=True)
    notification_uuid = UUIDField("notification_uuid", null=True)

    class Meta:
        db_table = "sentry_rulefirehistory"
        app_label = "sentry"
        indexes = [Index(fields=["rule", "date_added"])]

    __repr__ = sane_repr("rule_id", "group_id", "project_id", "event_id", "date_added")
