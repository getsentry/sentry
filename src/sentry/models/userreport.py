from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr


@region_silo_model
class UserReport(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project_id = BoundedBigIntegerField(db_index=True)
    group_id = BoundedBigIntegerField(null=True, db_index=True)
    event_id = models.CharField(max_length=32)
    environment_id = BoundedBigIntegerField(null=True, db_index=True)
    name = models.CharField(max_length=128)
    email = models.EmailField(max_length=75)
    comments = models.TextField(
        max_length=4096
    )  # Keep max_length <= "feedback.message.max-size" sentry option.
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userreport"
        indexes = (
            models.Index(fields=("project_id", "event_id")),
            models.Index(fields=("project_id", "date_added")),
        )
        unique_together = (("project_id", "event_id"),)

    __repr__ = sane_repr("event_id", "name", "email")

    def notify(self):
        from django.contrib.auth.models import AnonymousUser

        from sentry.api.serializers import UserReportWithGroupSerializer, serialize
        from sentry.tasks.user_report import user_report

        user_report.delay(
            project_id=self.project_id,
            report=serialize(self, AnonymousUser(), UserReportWithGroupSerializer()),
        )
