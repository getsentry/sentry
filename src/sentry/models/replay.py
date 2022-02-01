from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class Replay(Model):
    __include_in_export__ = True

    project_id = BoundedBigIntegerField(db_index=True)
    event_id = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_replay"
        index_together = (("project_id", "event_id"), ("project_id", "date_added"))
        unique_together = (("project_id", "event_id"),)

    __repr__ = sane_repr("event_id")

    # def notify(self):
    #     from django.contrib.auth.models import AnonymousUser

    #     from sentry.api.serializers import UserReportWithGroupSerializer, serialize
    #     from sentry.tasks.user_report import user_report

    #     user_report.delay(
    #         project_id=self.project_id,
    #         report=serialize(self, AnonymousUser(), UserReportWithGroupSerializer()),
    #     )
