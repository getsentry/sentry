from __future__ import annotations

from django.db import connections, models
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import Model
from django.db.models.signals import pre_migrate

from sentry.db.models.utils import Creator

__all__ = ("CITextField", "CICharField", "CIEmailField")


class CIText:
    def db_type(self, connection: BaseDatabaseWrapper) -> str:
        return "citext"


class CITextField(CIText, models.TextField[str, str]):
    def contribute_to_class(self, cls: type[Model], name: str, private_only: bool = False) -> None:
        super().contribute_to_class(cls, name, private_only=private_only)
        setattr(cls, name, Creator(self))


class CICharField(CIText, models.CharField[str, str]):
    def contribute_to_class(self, cls: type[Model], name: str, private_only: bool = False) -> None:
        super().contribute_to_class(cls, name, private_only=private_only)
        setattr(cls, name, Creator(self))


class CIEmailField(CIText, models.EmailField[str, str]):
    def contribute_to_class(self, cls: type[Model], name: str, private_only: bool = False) -> None:
        super().contribute_to_class(cls, name, private_only=private_only)
        setattr(cls, name, Creator(self))


def create_citext_extension(using: str, **kwargs: object) -> None:
    # We always need the citext extension installed for Postgres,
    # and for tests, it's not always guaranteed that we will have
    # run full migrations which installed it.
    cursor = connections[using].cursor()
    try:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS citext")
    except Exception:
        pass


pre_migrate.connect(create_citext_extension)
