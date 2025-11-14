from __future__ import annotations
from typing import int

from django.db import connections, models
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models.signals import pre_migrate

__all__ = ("CIEmailField",)


class CIEmailField(models.EmailField[str, str]):
    def db_type(self, connection: BaseDatabaseWrapper) -> str:
        return "citext"


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
