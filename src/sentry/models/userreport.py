from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model, sane_repr


class UserReport(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", null=True)
    event_user_id = BoundedBigIntegerField(null=True)
    event_id = models.CharField(max_length=32)
    environment = FlexibleForeignKey("sentry.Environment", null=True)
    name = models.CharField(max_length=128)
    email = models.EmailField(max_length=75)
    comments = models.TextField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userreport"
        index_together = (("project", "event_id"), ("project", "date_added"))
        unique_together = (("project", "event_id"),)

    __repr__ = sane_repr("event_id", "name", "email")

    def notify(self):
        from django.contrib.auth.models import AnonymousUser
        from sentry.api.serializers import serialize, UserReportWithGroupSerializer
        from sentry.tasks.signals import signal

        signal.delay(
            name="user-reports.created",
            project_id=self.project_id,
            payload={"report": serialize(self, AnonymousUser(), UserReportWithGroupSerializer())},
        )
