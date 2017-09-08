"""
sentry.db.models.fields.citext
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import six

from django.conf import settings
from django.db import connections, models
from django.db.models.signals import pre_syncdb


__all__ = ('CITextField', 'CICharField', 'CIEmailField')


class CIText(object):
    def db_type(self, connection):
        engine = connection.settings_dict['ENGINE']
        if 'postgres' in engine:
            return 'citext'
        return super(CIText, self).db_type(connection)


class CITextField(CIText, models.TextField):
    pass


class CICharField(CIText, models.CharField):
    pass


class CIEmailField(CIText, models.EmailField):
    pass


if hasattr(models, 'SubfieldBase'):
    CITextField = six.add_metaclass(models.SubfieldBase)(CITextField)
    CICharField = six.add_metaclass(models.SubfieldBase)(CICharField)
    CIEmailField = six.add_metaclass(models.SubfieldBase)(CIEmailField)

if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules([], ["^sentry\.db\.models\.fields\.citext\.CITextField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.citext\.CICharField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.citext\.CIEmailField"])


def create_citext_extension(db, **kwargs):
    from sentry.utils.db import is_postgres

    # We always need the citext extension installed for Postgres,
    # and for tests, it's not always guaranteed that we will have
    # run full migrations which installed it.
    if is_postgres(db):
        cursor = connections[db].cursor()
        try:
            cursor.execute('CREATE EXTENSION IF NOT EXISTS citext')
        except Exception:
            pass

pre_syncdb.connect(create_citext_extension)
