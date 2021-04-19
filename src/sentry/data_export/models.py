import logging

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_text

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)
from sentry.utils import json
from sentry.utils.http import absolute_uri

from .base import DEFAULT_EXPIRATION, ExportQueryType, ExportStatus

logger = logging.getLogger(__name__)


class ExportedData(Model):
    """
    Stores references to asynchronous data export jobs
    """

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    file = FlexibleForeignKey(
        "sentry.File", null=True, db_constraint=False, on_delete=models.SET_NULL
    )
    date_added = models.DateTimeField(default=timezone.now)
    date_finished = models.DateTimeField(null=True)
    date_expired = models.DateTimeField(null=True, db_index=True)
    query_type = BoundedPositiveIntegerField(choices=ExportQueryType.as_choices())
    query_info = JSONField()

    @property
    def status(self):
        if self.date_finished is None:
            return ExportStatus.Early
        elif self.date_expired < timezone.now():
            return ExportStatus.Expired
        else:
            return ExportStatus.Valid

    @property
    def payload(self):
        payload = self.query_info.copy()
        payload["export_type"] = ExportQueryType.as_str(self.query_type)
        return payload

    @property
    def file_name(self):
        date = self.date_added.strftime("%Y-%B-%d")
        export_type = ExportQueryType.as_str(self.query_type)
        # Example: Discover_2020-July-21_27.csv
        return f"{export_type}_{date}_{self.id}.csv"

    @staticmethod
    def format_date(date):
        # Example: 12:21 PM on July 21, 2020 (UTC)
        return None if date is None else force_text(date.strftime("%-I:%M %p on %B %d, %Y (%Z)"))

    def delete_file(self):
        if self.file:
            self.file.delete()

    def delete(self, *args, **kwargs):
        self.delete_file()
        super().delete(*args, **kwargs)

    def finalize_upload(self, file, expiration=DEFAULT_EXPIRATION):
        self.delete_file()  # If a file is present, remove it
        current_time = timezone.now()
        expire_time = current_time + expiration
        self.update(file=file, date_finished=current_time, date_expired=expire_time)
        self.email_success()

    def email_success(self):
        from sentry.utils.email import MessageBuilder

        # The following condition should never be true, but it's a safeguard in case someone manually calls this method
        if self.date_finished is None or self.date_expired is None or self.file is None:
            logger.warning(
                "Notification email attempted on incomplete dataset",
                extra={"data_export_id": self.id, "organization_id": self.organization_id},
            )
            return
        url = absolute_uri(
            reverse("sentry-data-export-details", args=[self.organization.slug, self.id])
        )
        msg = MessageBuilder(
            subject="Your data is ready.",
            context={"url": url, "expiration": self.format_date(self.date_expired)},
            type="organization.export-data",
            template="sentry/emails/data-export-success.txt",
            html_template="sentry/emails/data-export-success.html",
        )
        msg.send_async([self.user.email])

    def email_failure(self, message):
        from sentry.utils.email import MessageBuilder

        msg = MessageBuilder(
            subject="We couldn't export your data.",
            context={
                "creation": self.format_date(self.date_added),
                "error_message": message,
                "payload": json.dumps(self.payload, indent=2, sort_keys=True),
            },
            type="organization.export-data",
            template="sentry/emails/data-export-failure.txt",
            html_template="sentry/emails/data-export-failure.html",
        )
        msg.send_async([self.user.email])
        self.delete()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddata"

    __repr__ = sane_repr("query_type", "query_info")


class ExportedDataBlob(Model):
    __core__ = False

    data_export = FlexibleForeignKey("sentry.ExportedData")
    blob = FlexibleForeignKey("sentry.FileBlob", db_constraint=False)
    offset = BoundedBigIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddatablob"
        unique_together = (("data_export", "blob", "offset"),)
