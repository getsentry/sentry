from __future__ import annotations

from typing import Any, Callable, Iterable, Mapping, Tuple, Type, TypeVar, cast

from django.apps.config import AppConfig
from django.db import models
from django.db.models import signals
from django.utils import timezone

from sentry.silo import SiloLimit, SiloMode

from .fields.bounded import BoundedBigAutoField
from .manager import BaseManager, M
from .query import update

__all__ = (
    "BaseModel",
    "Model",
    "DefaultFieldsModel",
    "sane_repr",
    "get_model_if_available",
    "control_silo_with_replication_model",
    "control_silo_only_model",
    "region_silo_only_model",
)


def sane_repr(*attrs: str) -> Callable[[models.Model], str]:
    if "id" not in attrs and "pk" not in attrs:
        attrs = ("id",) + attrs

    def _repr(self: models.Model) -> str:
        cls = type(self).__name__

        pairs = (f"{a}={getattr(self, a, None)!r}" for a in attrs)

        return "<{} at 0x{:x}: {}>".format(cls, id(self), ", ".join(pairs))

    return _repr


class BaseModel(models.Model):  # type: ignore
    class Meta:
        abstract = True

    objects = BaseManager[M]()

    update = update

    def __getstate__(self) -> Mapping[str, Any]:
        d = self.__dict__.copy()
        # we can't serialize weakrefs
        d.pop("_Model__data", None)
        return d

    def __hash__(self) -> int:
        # Django decided that it shouldn't let us hash objects even though they have
        # memory addresses. We need that behavior, so let's revert.
        if self.pk:
            return cast(int, models.Model.__hash__(self))
        return id(self)

    def __reduce__(
        self,
    ) -> Tuple[Callable[[int], models.Model], Tuple[Tuple[str, str]], Mapping[str, Any]]:
        (model_unpickle, stuff, _) = super().__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state: Mapping[str, Any]) -> None:
        self.__dict__.update(state)

    def set_cached_field_value(self, field_name: str, value: Any) -> None:
        # Explicitly set a field's cached value.
        # This only works for relational fields, and is useful when
        # you already have the value and can therefore use this
        # to populate Django's cache before accessing the attribute
        # and triggering a duplicate, unnecessary query.
        self._meta.get_field(field_name).set_cached_value(self, value)

    def get_cached_field_value(self, field_name: str) -> Any:
        # Get a relational field's cached value.
        # It's recommended to only use this in testing code,
        # for when you would like to inspect the cache.
        # In production, you should guard `model.field` with an
        # `if model.is_field_cached`.
        name = self._meta.get_field(field_name).get_cache_name()
        return self._state.fields_cache.get(name, None)

    def delete_cached_field_value(self, field_name: str) -> None:
        name = self._meta.get_field(field_name).get_cache_name()
        if name in self._state.fields_cache:
            del self._state.fields_cache[name]

    def is_field_cached(self, field_name: str) -> bool:
        # Ask if a relational field has a cached value.
        name = self._meta.get_field(field_name).get_cache_name()
        return name in self._state.fields_cache


class Model(BaseModel):
    id = BoundedBigAutoField(primary_key=True)

    class Meta:
        abstract = True

    __repr__ = sane_repr("id")


class DefaultFieldsModel(Model):
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        abstract = True


def __model_pre_save(instance: models.Model, **kwargs: Any) -> None:
    if not isinstance(instance, DefaultFieldsModel):
        return
    instance.date_updated = timezone.now()


def __model_post_save(instance: models.Model, **kwargs: Any) -> None:
    if not isinstance(instance, BaseModel):
        return


def __model_class_prepared(sender: Any, **kwargs: Any) -> None:
    if not issubclass(sender, BaseModel):
        return

    if not hasattr(sender, "__include_in_export__"):
        raise ValueError(
            f"{sender!r} model has not defined __include_in_export__. This is used to determine "
            f"which models we export from sentry as part of our migration workflow: \n"
            f"https://docs.sentry.io/product/sentry-basics/migration/#3-export-your-data.\n"
            f"This should be True for core, low volume models used to configure Sentry. Things like "
            f"Organization, Project  and related settings. It should be False for high volume models "
            f"like Group."
        )


signals.pre_save.connect(__model_pre_save)
signals.post_save.connect(__model_post_save)
signals.class_prepared.connect(__model_class_prepared)


def get_model_if_available(app_config: AppConfig, model_name: str) -> Type[models.Model] | None:
    """Get a named model class if it exists and is available in this silo mode."""
    try:
        model = app_config.get_model(model_name)
    except LookupError:
        return None
    assert isinstance(model, type) and issubclass(model, models.Model)

    silo_limit = getattr(model._meta, "silo_limit", None)  # type: ignore
    if silo_limit is not None:
        assert isinstance(silo_limit, ModelSiloLimit)
        if not silo_limit.is_available():
            return None

    return model


ModelClass = TypeVar("ModelClass")


class ModelSiloLimit(SiloLimit):
    def __init__(
        self,
        *modes: SiloMode,
        read_only: SiloMode | Iterable[SiloMode] = (),
    ) -> None:
        super().__init__(*modes)
        self.read_only = frozenset([read_only] if isinstance(read_only, SiloMode) else read_only)

    @staticmethod
    def _recover_model_name(obj: Any) -> str | None:
        # obj may be a model, manager, or queryset
        if isinstance(obj, Model):
            return type(obj).__name__
        model_attr = getattr(obj, "model", None)
        if model_attr and isinstance(model_attr, type) and issubclass(model_attr, Model):
            return model_attr.__name__
        return None

    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        def handle(obj: Any, *args: Any, **kwargs: Any) -> None:
            model_name = self._recover_model_name(obj)
            method_name = (model_name + "." if model_name else "") + original_method.__name__
            mode_str = ", ".join(str(m) for m in available_modes)
            message = (
                f"Called `{method_name}` on server in {current_mode} mode. "
                f"{model_name or 'The model'} is available only in: {mode_str}"
            )
            raise self.AvailabilityError(message)

        return handle

    def __call__(self, model_class: ModelClass) -> Type[ModelClass]:
        if not (isinstance(model_class, type) and issubclass(model_class, BaseModel)):
            raise TypeError("`@ModelSiloLimit ` must decorate a Model class")
        assert isinstance(model_class.objects, BaseManager)

        model_class.objects = model_class.objects.create_silo_limited_copy(self, self.read_only)

        # On the model (not manager) class itself, find all methods that are tagged
        # with the `alters_data` meta-attribute and replace them with overrides.
        for model_attr_name in dir(model_class):
            model_attr = getattr(model_class, model_attr_name)
            if callable(model_attr) and getattr(model_attr, "alters_data", False):
                override = self.create_override(model_attr)
                override.alters_data = True  # type: ignore

                # We have to resort to monkey-patching here. Dynamically extending
                # and replacing the model class is not an option, because that would
                # trigger hooks in Django's ModelBase metaclass a second time.
                setattr(model_class, model_attr_name, override)

        model_class._meta.silo_limit = self

        return model_class


control_silo_with_replication_model = ModelSiloLimit(SiloMode.CONTROL, read_only=SiloMode.REGION)
control_silo_only_model = ModelSiloLimit(SiloMode.CONTROL)
region_silo_only_model = ModelSiloLimit(SiloMode.REGION)
