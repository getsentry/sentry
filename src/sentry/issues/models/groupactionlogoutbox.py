from django.db import models

from sentry.db.models import cell_silo_model
from sentry.hybridcloud.models.outbox import CellOutboxBase


@cell_silo_model
class GroupActionLogOutbox(CellOutboxBase):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupactionlogoutbox"
        indexes = (
            models.Index(
                fields=(
                    "shard_scope",
                    "shard_identifier",
                    "category",
                    "object_identifier",
                )
            ),
            models.Index(
                fields=(
                    "shard_scope",
                    "shard_identifier",
                    "scheduled_for",
                )
            ),
            models.Index(fields=("shard_scope", "shard_identifier", "id")),
        )
