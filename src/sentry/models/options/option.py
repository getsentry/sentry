from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.mixins import OverwritableConfigMixin
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model, region_silo_model, sane_repr
from sentry.db.models.fields.picklefield import PickledObjectField
from sentry.options.manager import UpdateChannel


class BaseOption(OverwritableConfigMixin, Model):
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    # Subclasses should overwrite the relocation scope as appropriate.
    __relocation_scope__ = RelocationScope.Excluded
    __relocation_custom_ordinal__ = ["key"]

    key = models.CharField(max_length=128, unique=True)
    last_updated = models.DateTimeField(default=timezone.now)
    last_updated_by = models.CharField(
        max_length=16, choices=UpdateChannel.choices(), default=UpdateChannel.UNKNOWN.value
    )

    class Meta:
        abstract = True

    value = PickledObjectField()

    __repr__ = sane_repr("key", "value")

    @classmethod
    def query_for_relocation_export(cls, q: models.Q, pk_map: PrimaryKeyMap) -> models.Q:
        # These ping options change too frequently, or necessarily with each install, to be useful
        # in exports. More broadly, we don't really care about comparing them for accuracy.
        return q & ~models.Q(
            key__in={
                "sentry:install-id",  # Only used on self-hosted
                "sentry:latest_version",  # Auto-generated periodically, which defeats comparison
                "sentry:last_worker_ping",  # Changes very frequently
                "sentry:last_worker_version",  # Changes very frequently
            }
        )


@region_silo_model
class Option(BaseOption):
    __relocation_scope__ = RelocationScope.Config

    class Meta:
        app_label = "sentry"
        db_table = "sentry_option"

    __repr__ = sane_repr("key", "value")


@control_silo_model
class ControlOption(BaseOption):
    __relocation_scope__ = RelocationScope.Config

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloption"

    __repr__ = sane_repr("key", "value")
