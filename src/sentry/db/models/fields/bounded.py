from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils.translation import ugettext_lazy as _

__all__ = (
    "BoundedAutoField",
    "BoundedBigAutoField",
    "BoundedIntegerField",
    "BoundedBigIntegerField",
    "BoundedPositiveIntegerField",
)


class BoundedIntegerField(models.IntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedIntegerField, self).get_prep_value(value)


class BoundedPositiveIntegerField(models.PositiveIntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedPositiveIntegerField, self).get_prep_value(value)


class BoundedAutoField(models.AutoField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedAutoField, self).get_prep_value(value)


if settings.SENTRY_USE_BIG_INTS:

    class BoundedBigIntegerField(models.BigIntegerField):
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def get_internal_type(self):
            return "BigIntegerField"

        def get_prep_value(self, value):
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return super(BoundedBigIntegerField, self).get_prep_value(value)

    class BoundedBigAutoField(models.AutoField):
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def db_type(self, connection):
            return "bigserial"

        def get_related_db_type(self, connection):
            return BoundedBigIntegerField().db_type(connection)

        def get_internal_type(self):
            return "BigIntegerField"

        def get_prep_value(self, value):
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return super(BoundedBigAutoField, self).get_prep_value(value)


else:
    # we want full on classes for these
    class BoundedBigIntegerField(BoundedIntegerField):
        pass

    class BoundedBigAutoField(BoundedAutoField):
        pass
