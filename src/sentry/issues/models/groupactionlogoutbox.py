from django.db import connections, models, router

from sentry.db.models import cell_silo_model
from sentry.hybridcloud.models.outbox import CellOutboxBase


@cell_silo_model
class GroupActionLogOutbox(CellOutboxBase):
    @classmethod
    def reserve_object_identifiers_for_bulk_create(cls, count: int) -> list[int]:
        """Reserve IDs for one bounded ``bulk_create`` operation.

        PostgreSQL sequence values are consumed even if the transaction rolls back or the
        caller does not use them. Prefer ``next_object_identifier`` outside bulk creation.
        """
        if not 0 <= count <= 10_000:
            raise ValueError("bulk identifier reservation count must be between 0 and 10,000")
        if count == 0:
            return []

        using = router.db_for_write(cls)
        with connections[using].cursor() as cursor:
            cursor.execute(
                "SELECT nextval(%s) FROM generate_series(1,%s);",
                [f"{cls._meta.db_table}_id_seq", count],
            )
            return [identifier for (identifier,) in cursor.fetchall()]

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
