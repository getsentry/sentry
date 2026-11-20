from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model

__all__ = ("AnomalyDetectionState",)


@cell_silo_model
class AnomalyDetectionState(DefaultFieldsModel):
    """An organization's anomaly evaluator checkpoint and the first minute it hasn't evaluated.

    Project monitors are Workflow Engine Detector rows, which also own activation state. This
    cell-local row holds the organization-wide statistical state that correlates them.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey(
        "sentry.Organization", db_index=False, on_delete=models.CASCADE
    )
    next_minute = models.DateTimeField()
    checkpoint = models.BinaryField()  # See sentry.anomaly_detection.checkpoint.codec.

    class Meta:
        app_label = "sentry"
        db_table = "sentry_anomalydetectionstate"
        constraints = [
            models.UniqueConstraint(fields=["organization"], name="sentry_anomaly_state_org_uniq")
        ]
