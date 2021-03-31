from django.db import models
from django.db.models import signals
from django.utils import timezone

from .fields.bounded import BoundedBigAutoField
from .manager import BaseManager
from .query import update

__all__ = ("BaseModel", "Model", "DefaultFieldsModel", "sane_repr")


def sane_repr(*attrs):
    if "id" not in attrs and "pk" not in attrs:
        attrs = ("id",) + attrs

    def _repr(self):
        cls = type(self).__name__

        pairs = (f"{a}={getattr(self, a, None)!r}" for a in attrs)

        return "<{} at 0x{:x}: {}>".format(cls, id(self), ", ".join(pairs))

    return _repr


class BaseModel(models.Model):
    class Meta:
        abstract = True

    objects = BaseManager()

    update = update

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop("_Model__data", None)
        return d

    def __hash__(self):
        # Django decided that it shouldn't let us hash objects even though they have
        # memory addresses. We need that behavior, so let's revert.
        if self.pk:
            return models.Model.__hash__(self)
        return id(self)

    def __reduce__(self):
        (model_unpickle, stuff, _) = super().__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state):
        self.__dict__.update(state)


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


def __model_pre_save(instance, **kwargs):
    if not isinstance(instance, DefaultFieldsModel):
        return
    instance.date_updated = timezone.now()


def __model_post_save(instance, **kwargs):
    if not isinstance(instance, BaseModel):
        return


def __model_class_prepared(sender, **kwargs):
    if not issubclass(sender, BaseModel):
        return

    if not hasattr(sender, "__core__"):
        raise ValueError(f"{sender!r} model has not defined __core__")


signals.pre_save.connect(__model_pre_save)
signals.post_save.connect(__model_post_save)
signals.class_prepared.connect(__model_class_prepared)
