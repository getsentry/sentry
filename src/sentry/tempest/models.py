from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class MessageType(models.TextChoices):
    ERROR = "error"
    WARNING = "warning"
    SUCCESS = "success"
    INFO = "info"


@region_silo_model
class TempestCredentials(DefaultFieldsModel):
    # Contains sensitive information which we don't want to export/import - it should be configured again manually
    __relocation_scope__ = RelocationScope.Excluded

    created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    # message that is shown next to the client id/secret pair
    # used to communicate the status of the latest actions with credentials
    message = models.TextField()
    message_type = models.CharField(
        max_length=20, choices=MessageType.choices, default=MessageType.ERROR
    )

    client_id = models.CharField()
    client_secret = models.CharField()

    # id of the latest item fetched via tempest
    latest_fetched_item_id = models.CharField(null=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["client_id", "project"],
                name="sentry_tempestcredentials_client_project_uniq",
            )
        ]

    def get_audit_log_data(self) -> dict:
        return {
            "project_id": self.project.id,
            "client_id": self.client_id,
        }
