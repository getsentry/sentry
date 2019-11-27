from __future__ import absolute_import

from django.db import connections, models
from django.db.models.signals import pre_migrate


__all__ = ("CITextField", "CICharField", "CIEmailField")


class CIText(object):
    def db_type(self, connection):
        return "citext"


class CITextField(CIText, models.TextField):
    pass


class CICharField(CIText, models.CharField):
    pass


class CIEmailField(CIText, models.EmailField):
    pass


def create_citext_extension(using, **kwargs):
    # We always need the citext extension installed for Postgres,
    # and for tests, it's not always guaranteed that we will have
    # run full migrations which installed it.
    cursor = connections[using].cursor()
    try:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS citext")
    except Exception:
        pass


pre_migrate.connect(create_citext_extension)
