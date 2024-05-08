from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class Actor(Model):
    """
    XXX: This model is being removed. Do not use.
    """

    __relocation_scope__ = RelocationScope.Excluded

    type = models.PositiveSmallIntegerField()
    user_id = models.BigIntegerField(null=True)
    team = FlexibleForeignKey("sentry.Team", null=True, db_index=False, db_constraint=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"
