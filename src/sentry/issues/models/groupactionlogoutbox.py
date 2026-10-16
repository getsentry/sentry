from django.db import models, router, transaction

from sentry.db.models import cell_silo_model
from sentry.hybridcloud.models.outbox import CellOutboxBase, _outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.utils import metrics


@cell_silo_model
class GroupActionLogOutbox(CellOutboxBase):
    def schedule_drain_on_commit(self) -> None:
        if _outbox_context.flushing_enabled:
            transaction.on_commit(
                self._drain_shard_with_metrics, using=router.db_for_write(type(self))
            )

    def record_saved_metric(self, count: int = 1) -> None:
        tags = {"category": OutboxCategory(self.category).name, **self._silo_and_type_tags()}
        metrics.incr("outbox.saved", count, tags=tags)

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
