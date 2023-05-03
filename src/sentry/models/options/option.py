from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, control_silo_only_model, sane_repr
from sentry.db.models.fields.picklefield import PickledObjectField


class OptionsTypes(Enum):
    """Enumerated type referring to potential sources of Sentry Options"""

    LEGACY = "legacy"
    AUTOMATOR = "automator"
    CLI = "cli"
    KILLSWITCH = "killswitch"

    @classmethod
    def choices(cls):
        return tuple((i.name, i.value) for i in cls)


@control_silo_only_model
class Option(Model):  # type: ignore
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __include_in_export__ = True

    key = models.CharField(max_length=128, unique=True)
    value = PickledObjectField()
    last_updated = models.DateTimeField(default=timezone.now)
    last_updated_by = models.CharField(
        max_length=128, choices=OptionsTypes.choices(), default="legacy"
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_option"

    __repr__ = sane_repr("key", "value")
