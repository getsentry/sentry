"""
sentry.db.models.fields.foreignkey
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from django.db.models import ForeignKey

__all__ = ('FlexibleForeignKey', )


class FlexibleForeignKey(ForeignKey):
    def db_type(self, connection):
        # This is required to support BigAutoField (or anything similar)
        rel_field = self.related_field
        if hasattr(rel_field, 'get_related_db_type'):
            return rel_field.get_related_db_type(connection)
        return super(FlexibleForeignKey, self).db_type(connection)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules(
        [], [
            "^sentry\.db\.models\.fields\.FlexibleForeignKey",
            "^sentry\.db\.models\.fields\.foreignkey\.FlexibleForeignKey",
        ]
    )
