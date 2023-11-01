from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class GroupEmailThread(Model):
    """
    Keep track of the original Message-Id that was sent
    unique per email destination and Group object.This allows
    the tracking of proper In-Reply-To and References headers
    for email threading.
    """

    __relocation_scope__ = RelocationScope.Excluded

    email = models.EmailField(max_length=75)
    project = FlexibleForeignKey("sentry.Project", related_name="groupemail_set")
    group = FlexibleForeignKey("sentry.Group", related_name="groupemail_set")
    msgid = models.CharField(max_length=100)
    date = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupemailthread"
        unique_together = (("email", "group"), ("email", "msgid"))
        indexes = [models.Index(fields=["date", "project", "id"])]

    __repr__ = sane_repr("email", "group_id", "msgid")
