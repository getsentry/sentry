from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr


class GroupEmailThread(Model):
    """
    Keep track of the original Message-Id that was sent
    unique per email destination and Group object.This allows
    the tracking of proper In-Reply-To and References headers
    for email threading.
    """

    __include_in_export__ = False

    email = models.EmailField(max_length=75)
    project = FlexibleForeignKey("sentry.Project", related_name="groupemail_set")
    group = FlexibleForeignKey("sentry.Group", related_name="groupemail_set")
    msgid = models.CharField(max_length=100)
    date = models.DateTimeField(default=timezone.now, db_index=True)

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupemailthread"
        unique_together = (("email", "group"), ("email", "msgid"))

    __repr__ = sane_repr("email", "group_id", "msgid")
