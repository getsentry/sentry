from typing import ClassVar, Self

from django.db import models
from django.utils import timezone

from sentry.db.models import BaseModel, sane_repr
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.db.models.manager.types import M


def _bogus_delete_return_value() -> tuple[int, dict[str, int]]:
    # django'd delete returns (# deleted, dict[model name, # deleted])
    # but we never use this value (and aren't actually deleting!) so...
    return (0, {})


class ParanoidQuerySet(BaseQuerySet[M]):
    """
    Prevents objects from being hard-deleted. Instead, sets the
    ``date_deleted``, effectively soft-deleting the object.
    """

    def delete(self) -> tuple[int, dict[str, int]]:
        self.update(date_deleted=timezone.now())
        return _bogus_delete_return_value()


class ParanoidManager(BaseManager[M]):
    """
    Only exposes objects that have NOT been soft-deleted.
    """

    def get_queryset(self) -> ParanoidQuerySet[M]:
        return ParanoidQuerySet(self.model, using=self._db).filter(date_deleted__isnull=True)


class ParanoidModel(BaseModel):
    class Meta:
        abstract = True

    date_deleted = models.DateTimeField(null=True, blank=True)
    objects: ClassVar[ParanoidManager[Self]] = ParanoidManager()
    with_deleted: ClassVar[BaseManager[Self]] = BaseManager()

    def delete(
        self, using: str | None = None, keep_parents: bool = False
    ) -> tuple[int, dict[str, int]]:
        self.update(using=using, date_deleted=timezone.now())
        return _bogus_delete_return_value()

    __repr__ = sane_repr("id")
