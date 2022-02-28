from typing import cast

from django.conf import settings
from django.db import models
from django.db.backends.base.base import BaseDatabaseWrapper
from django.utils.translation import ugettext_lazy as _

__all__ = (
    "BoundedAutoField",
    "BoundedBigAutoField",
    "BoundedIntegerField",
    "BoundedBigIntegerField",
    "BoundedPositiveIntegerField",
)


class BoundedIntegerField(models.IntegerField):  # type: ignore
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return cast(int, super().get_prep_value(value))


class BoundedPositiveIntegerField(models.PositiveIntegerField):  # type: ignore
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return cast(int, super().get_prep_value(value))


class BoundedAutoField(models.AutoField):  # type: ignore
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return cast(int, super().get_prep_value(value))


if settings.SENTRY_USE_BIG_INTS:

    class BoundedBigIntegerField(models.BigIntegerField):  # type: ignore
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def get_internal_type(self) -> str:
            return "BigIntegerField"

        def get_prep_value(self, value: int) -> int:
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return cast(int, super().get_prep_value(value))

    class BoundedBigAutoField(models.AutoField):  # type: ignore
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def db_type(self, connection: BaseDatabaseWrapper) -> str:
            return "bigserial"

        def get_related_db_type(self, connection: BaseDatabaseWrapper) -> str:
            return cast(str, BoundedBigIntegerField().db_type(connection))

        def get_internal_type(self) -> str:
            return "BigIntegerField"

        def get_prep_value(self, value: int) -> int:
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return cast(int, super().get_prep_value(value))


else:
    # we want full on classes for these
    class BoundedBigIntegerField(BoundedIntegerField):  # type: ignore
        pass

    class BoundedBigAutoField(BoundedAutoField):  # type: ignore
        pass
