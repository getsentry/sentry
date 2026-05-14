from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, cell_silo_model


@cell_silo_model
class OptionSeen(Model):
    """
    Tripwire: a row exists iff options.get() has been called for this key
    at least once since tracking was enabled.  Written at most once per key,
    ever.  Used to identify registered options that are never read in
    production so they can be safely removed.
    """

    __relocation_scope__ = RelocationScope.Excluded

    key = models.CharField(max_length=128, primary_key=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_option_seen"
