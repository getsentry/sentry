from __future__ import annotations

import abc

from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.mixins import OverwritableConfigMixin
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    Model,
    OptionManager,
    ValidateFunction,
    Value,
    control_silo_only_model,
    region_silo_only_model,
    sane_repr,
)
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
        # These ping options change too frequently to be useful in exports.
        return q & ~models.Q(key__in={"sentry:last_worker_ping", "sentry:last_worker_version"})


@region_silo_only_model
class Option(BaseOption):
    __relocation_scope__ = RelocationScope.Config

    class Meta:
        app_label = "sentry"
        db_table = "sentry_option"

    __repr__ = sane_repr("key", "value")


@control_silo_only_model
class ControlOption(BaseOption):
    __relocation_scope__ = RelocationScope.Config

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloption"

    __repr__ = sane_repr("key", "value")


class HasOption:
    # Logically this is an abstract interface. Leaving off abc.ABC because it clashes
    # with the Model metaclass.

    @abc.abstractmethod
    def get_option(
        self,
        key: str,
        default: Value | None = None,
        validate: ValidateFunction | None = None,
    ) -> Value:
        raise NotImplementedError

    @abc.abstractmethod
    def update_option(self, key: str, value: Value) -> bool:
        raise NotImplementedError

    @abc.abstractmethod
    def delete_option(self, key: str) -> None:
        raise NotImplementedError


class OptionMixin(HasOption):
    @property
    @abc.abstractmethod
    def option_manager(self) -> OptionManager:
        raise NotImplementedError

    def get_option(
        self, key: str, default: Value | None = None, validate: ValidateFunction | None = None
    ) -> Value:
        return self.option_manager.get_value(self, key, default, validate)

    def update_option(self, key: str, value: Value) -> bool:
        return self.option_manager.set_value(self, key, value)

    def delete_option(self, key: str) -> None:
        self.option_manager.unset_value(self, key)
