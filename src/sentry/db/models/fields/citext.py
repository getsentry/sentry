from __future__ import absolute_import, print_function

import six

from django.db import connections, models
from django.db.models.signals import pre_migrate


__all__ = ("CITextField", "CICharField", "CIEmailField")


class CIText(object):
    def db_type(self, connection):
        engine = connection.settings_dict["ENGINE"]
        if "postgres" in engine:
            return "citext"
        return super(CIText, self).db_type(connection)


class CITextField(CIText, models.TextField):
    pass


class CICharField(CIText, models.CharField):
    pass


class CIEmailField(CIText, models.EmailField):
    pass


if hasattr(models, "SubfieldBase"):
    CITextField = six.add_metaclass(models.SubfieldBase)(CITextField)
    CICharField = six.add_metaclass(models.SubfieldBase)(CICharField)
    CIEmailField = six.add_metaclass(models.SubfieldBase)(CIEmailField)


def create_citext_extension(using, **kwargs):
    from sentry.utils.db import is_postgres

    # We always need the citext extension installed for Postgres,
    # and for tests, it's not always guaranteed that we will have
    # run full migrations which installed it.
    if is_postgres(using):
        cursor = connections[using].cursor()
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS citext")
        except Exception:
            pass


pre_migrate.connect(create_citext_extension)
