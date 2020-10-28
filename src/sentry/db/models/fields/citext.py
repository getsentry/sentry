from __future__ import absolute_import

from django.db import connections, models
from django.db.models.signals import pre_migrate

from sentry.db.models.utils import Creator

__all__ = ("CITextField", "CICharField", "CIEmailField")


class CIText(object):
    def db_type(self, connection):
        return "citext"


class CITextField(CIText, models.TextField):
    def contribute_to_class(self, cls, name):
        super(CITextField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))


class CICharField(CIText, models.CharField):
    def contribute_to_class(self, cls, name):
        super(CICharField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))


class CIEmailField(CIText, models.EmailField):
    def contribute_to_class(self, cls, name):
        super(CIEmailField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))


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
