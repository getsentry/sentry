from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
from django.conf import settings
from django.db import models, router, transaction
from django.urls import reverse
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.files.file import File
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.templates.data_export import DataExportFailure, DataExportSuccess
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.users.services.user.service import user_service

from .base import DEFAULT_EXPIRATION, ExportQueryType, ExportStatus

logger = logging.getLogger(__name__)


@region_silo_model
class ExportedData(Model):
    """
    Stores references to asynchronous data export jobs
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    file_id = BoundedBigIntegerField(null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_finished = models.DateTimeField(null=True)
    date_expired = models.DateTimeField(null=True, db_index=True)
    query_type = BoundedPositiveIntegerField(choices=ExportQueryType.as_choices())
    query_info: models.Field[dict[str, Any], dict[str, Any]] = JSONField()

    @property
    def status(self) -> ExportStatus:
        if self.date_finished is None:
            return ExportStatus.Early
        elif self.date_expired is not None and self.date_expired < timezone.now():
            return ExportStatus.Expired
        else:
            return ExportStatus.Valid

    @property
    def payload(self) -> dict[str, Any]:
        payload = self.query_info.copy()
        payload["export_type"] = ExportQueryType.as_str(self.query_type)
        return payload

    @property
    def file_name(self) -> str:
        date = self.date_added.strftime("%Y-%B-%d")
        export_type = ExportQueryType.as_str(self.query_type)
        # Example: Discover_2020-July-21_27.csv
        return f"{export_type}_{date}_{self.id}.csv"

    @staticmethod
    def format_date(date: datetime | None) -> str | None:
        # Example: 12:21 PM on July 21, 2020 (UTC)
        return None if date is None else date.strftime("%-I:%M %p on %B %d, %Y (%Z)")

    def delete_file(self) -> None:
        file = self._get_file()
        if file:
            file.delete()

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, Any]]:
        self.delete_file()
        return super().delete(*args, **kwargs)

    def finalize_upload(self, file: File, expiration: timedelta = DEFAULT_EXPIRATION) -> None:
        self.delete_file()  # If a file is present, remove it
        current_time = timezone.now()
        expire_time = current_time + expiration
        self.update(file_id=file.id, date_finished=current_time, date_expired=expire_time)
        transaction.on_commit(lambda: self.email_success(), router.db_for_write(ExportedData))

    def email_success(self) -> None:
        from sentry.utils.email import MessageBuilder

        user_email = None
        if self.user_id is not None:
            user = user_service.get_user(user_id=self.user_id)
            if user:
                user_email = user.email

        # The following condition should never be true, but it's a safeguard in case someone manually calls this method
        if self.date_finished is None or self.date_expired is None or self._get_file() is None:
            logger.warning(
                "Notification email attempted on incomplete dataset",
                extra={"data_export_id": self.id, "organization_id": self.organization_id},
            )
            return
        url = self.organization.absolute_url(
            reverse("sentry-data-export-details", args=[self.organization.slug, self.id])
        )

        if not user_email:
            return

        data = DataExportSuccess(
            export_url=url,
            expiration_date=self.date_expired,
        )
        has_access = NotificationService.has_access(self.organization, data.source)
        logger.info(
            "notification.platform.data-export-success.has_access",
            extra={
                "organization_id": self.organization.id,
                "data_export_id": self.id,
                "data_source": data.source,
                "has_access": has_access,
                "user_email": user_email,
            },
        )

        if has_access:
            NotificationService(data=data).notify_async(
                targets=[
                    GenericNotificationTarget(
                        provider_key=NotificationProviderKey.EMAIL,
                        resource_type=NotificationTargetResourceType.EMAIL,
                        resource_id=user_email,
                    )
                ]
            )
        else:
            msg = MessageBuilder(
                subject="Your data is ready.",
                context={"url": url, "expiration": self.format_date(self.date_expired)},
                type="organization.export-data",
                template="sentry/emails/data-export-success.txt",
                html_template="sentry/emails/data-export-success.html",
            )
            msg.send_async([user_email])

    def email_failure(self, message: str) -> None:
        from sentry.utils.email import MessageBuilder

        if self.user_id is None:
            return
        user = user_service.get_user(user_id=self.user_id)
        if user is None or not user.email:
            return

        data = DataExportFailure(
            error_message=message,
            error_payload=self.payload,
            creation_date=self.date_added,
        )
        if NotificationService.has_access(self.organization, data.source):
            NotificationService(data=data).notify_async(
                targets=[
                    GenericNotificationTarget(
                        provider_key=NotificationProviderKey.EMAIL,
                        resource_type=NotificationTargetResourceType.EMAIL,
                        resource_id=user.email,
                    )
                ]
            )

        else:
            msg = MessageBuilder(
                subject="We couldn't export your data.",
                context={
                    "creation": self.format_date(self.date_added),
                    "error_message": message,
                    "payload": orjson.dumps(self.payload).decode(),
                },
                type="organization.export-data",
                template="sentry/emails/data-export-failure.txt",
                html_template="sentry/emails/data-export-failure.html",
            )
            msg.send_async([user.email])
        self.delete()

    def _get_file(self) -> File | None:
        if self.file_id:
            try:
                return File.objects.get(pk=self.file_id)
            except File.DoesNotExist:
                self.update(file_id=None)
        return None

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddata"

    __repr__ = sane_repr("query_type", "query_info")


@region_silo_model
class ExportedDataBlob(Model):
    __relocation_scope__ = RelocationScope.Excluded

    data_export = FlexibleForeignKey("sentry.ExportedData")
    blob_id = BoundedBigIntegerField(db_index=True)
    offset = BoundedBigIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddatablob"
        unique_together = (("data_export", "blob_id", "offset"),)
