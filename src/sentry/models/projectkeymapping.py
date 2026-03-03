from __future__ import annotations

from django.db import models
from django.db.models.functions import Now, TruncSecond

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, sane_repr
from sentry.db.models.base import Model, control_silo_model
from sentry.db.models.indexes import IndexWithPostgresNameLimits
from sentry.hybridcloud.rpc import REGION_NAME_LENGTH


@control_silo_model
class ProjectKeyMapping(Model):
    """
    Maps a ProjectKey public_key to its region, enabling global uniqueness enforcement
    and routing from the control silo.

    This model is autocreated via an outbox write from the regional ProjectKey it
    references, so there is no need to explicitly include it in the export.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project_key_id = BoundedBigIntegerField(db_index=True)
    public_key = models.CharField(max_length=32, unique=True, db_index=True)
    cell_name = models.CharField(max_length=REGION_NAME_LENGTH)
    date_updated = models.DateTimeField(db_default=Now(), auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectkeymapping"
        indexes = [
            IndexWithPostgresNameLimits(
                TruncSecond("date_updated"),
                "id",
                name="sentry_projkeymapping_date_updated_id_idx",
            )
        ]

    __repr__ = sane_repr("public_key", "cell_name")
