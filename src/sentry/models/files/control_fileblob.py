from __future__ import annotations

from typing import Any

from sentry import options
from sentry.celery import SentryTask
from sentry.db.models import control_silo_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.control_fileblobowner import ControlFileBlobOwner
from sentry.options.manager import UnknownOption
from sentry.tasks.files import delete_file_control


def control_file_storage_config() -> dict[str, Any] | None:
    """
    When sentry is deployed in a siloed mode file relations
    used by control silo models are stored separately from
    region silo resources.

    While we consistently write to the ControlFile django
    model for control silo resources, we can't ensure
    that each deployment has separate control + region storage
    backends. We coalesce those options here. None means use the
    global default storage options.
    """
    try:
        # If these options exist, use them. Otherwise fallback to default behavior
        storage_backend = options.get("filestore.control.backend")
        storage_options = options.get("filestore.control.options")
        if storage_backend:
            return {
                "backend": storage_backend,
                "options": storage_options,
            }
    except UnknownOption:
        pass
    return None


@control_silo_model
class ControlFileBlob(AbstractFileBlob[ControlFileBlobOwner]):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblob"

    @classmethod
    def _storage_config(cls) -> dict[str, Any] | None:
        return control_file_storage_config()

    def _create_blob_owner(self, organization_id: int) -> ControlFileBlobOwner:
        return ControlFileBlobOwner.objects.create(organization_id=organization_id, blob=self)

    def _delete_file_task(self) -> SentryTask:
        return delete_file_control
