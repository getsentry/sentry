from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model

__all__ = ("AnomalyDetectionState",)


@cell_silo_model
class AnomalyDetectionState(DefaultFieldsModel):
    """Cell-local evaluation checkpoint and issue delivery queue for one organization."""

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey(
        "sentry.Organization", db_index=False, on_delete=models.CASCADE
    )
    next_minute = models.DateTimeField(null=True)
    checkpoint = models.JSONField(null=True)
    delivery = models.JSONField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_anomalydetectionstate"
        constraints = [
            models.UniqueConstraint(fields=["organization"], name="sentry_anomaly_state_org_uniq")
        ]
