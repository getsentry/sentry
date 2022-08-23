from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr


class IssueSet(Model):
    name = models.CharField(max_length=128)
    organization = FlexibleForeignKey("sentry.Organization", null=True)
    items = models.ManyToManyField("sentry.Group", blank=True, through="sentry.IssueSetItem")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueset"

    __include_in_export__ = False
    __repr__ = sane_repr("name", "organization_id")
    objects = BaseManager()
