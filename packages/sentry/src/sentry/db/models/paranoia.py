from typing import cast

from django.db import models
from django.db.models.query import QuerySet
from django.utils import timezone

from sentry.db.models import BaseManager, Model


class ParanoidQuerySet(QuerySet):  # type: ignore
    """
    Prevents objects from being hard-deleted. Instead, sets the
    ``date_deleted``, effectively soft-deleting the object.
    """

    def delete(self) -> None:
        self.update(date_deleted=timezone.now())


class ParanoidManager(BaseManager):  # type: ignore
    """
    Only exposes objects that have NOT been soft-deleted.
    """

    def get_queryset(self) -> ParanoidQuerySet:
        return cast(
            ParanoidQuerySet,
            ParanoidQuerySet(self.model, using=self._db).filter(date_deleted__isnull=True),
        )


class ParanoidModel(Model):  # type: ignore
    class Meta:
        abstract = True

    date_deleted = models.DateTimeField(null=True, blank=True)
    objects = ParanoidManager()
    with_deleted = BaseManager()

    def delete(self) -> None:
        self.update(date_deleted=timezone.now())
