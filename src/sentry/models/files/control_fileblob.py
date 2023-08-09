from sentry.db.models import control_silo_only_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.control_fileblobowner import ControlFileBlobOwner
from sentry.options.manager import UnknownOption
from sentry.tasks.files import delete_file_control


@control_silo_only_model
class ControlFileBlob(AbstractFileBlob):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblob"

    FILE_BLOB_OWNER_MODEL = ControlFileBlobOwner
    DELETE_FILE_TASK = delete_file_control

    # TODO(hybrid-cloud): This is a temporary measure to allow concurrent production deployments of filestore
    # We override the behavior of only the control silo file storage implementation to use
    # the new control instance while production runs in monolith mode
    @classmethod
    def _storage_config(cls):
        from sentry import options as options_store

        config = None
        try:
            # If these options exist, use them. Otherwise fallback to default behavior
            backend = options_store.get("filestore.control.backend")
            options = options_store.get("filestore.control.options")
            if backend:
                config = {
                    "backend": backend,
                    "options": options,
                }
        except UnknownOption:
            pass
        return config
