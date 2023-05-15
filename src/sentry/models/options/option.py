from django.db import models
from django.utils import timezone

from sentry.db.models import Model, control_silo_only_model, region_silo_only_model, sane_repr
from sentry.db.models.fields.picklefield import PickledObjectField


class BaseOption(Model):  # type: ignore
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __include_in_export__ = True

    key = models.CharField(max_length=128, unique=True)
    last_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True

    value = PickledObjectField()

    __repr__ = sane_repr("key", "value")


@region_silo_only_model
class Option(BaseOption):
    __include_in_export__ = True

    class Meta:
        app_label = "sentry"
        db_table = "sentry_option"

    __repr__ = sane_repr("key", "value")


@control_silo_only_model
class ControlOption(BaseOption):
    __include_in_export__ = True

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloption"

    __repr__ = sane_repr("key", "value")
