from django.db.models import DateTimeField, Index
from django.utils import timezone

from sentry.db.models import CharField, FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class RuleFireHistory(Model):  # type: ignore
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    rule = FlexibleForeignKey("sentry.Rule")
    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    event_id = CharField("event_id", max_length=32, null=True)
    date_added = DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sentry_rulefirehistory"
        app_label = "sentry"
        indexes = [Index(fields=["rule", "date_added"])]

    __repr__ = sane_repr("rule_id", "group_id", "project_id", "event_id", "date_added")
