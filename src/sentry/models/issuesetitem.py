from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr


class IssueSetItem(Model):
    group = FlexibleForeignKey("sentry.Group", null=True)
    issue_set = FlexibleForeignKey("sentry.IssueSet", null=True)
    project = FlexibleForeignKey("sentry.Project", null=True)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueset_items"

    __include_in_export__ = False
    __repr__ = sane_repr("group", "organization_id")
    objects = BaseManager()
