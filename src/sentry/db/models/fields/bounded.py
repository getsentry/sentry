from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

__all__ = (
    "BoundedAutoField",
    "BoundedBigAutoField",
    "BoundedIntegerField",
    "BoundedBigIntegerField",
    "BoundedPositiveIntegerField",
    "BoundedPositiveBigIntegerField",
)


class BoundedIntegerField(models.IntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedPositiveIntegerField(models.PositiveIntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedAutoField(models.AutoField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


if settings.SENTRY_USE_BIG_INTS:

    class BoundedBigIntegerField(models.BigIntegerField):
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def get_internal_type(self) -> str:
            return "BigIntegerField"

        def get_prep_value(self, value: int) -> int:
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return super().get_prep_value(value)

    class BoundedPositiveBigIntegerField(models.PositiveBigIntegerField):
        description = _("Positive big integer")

        MAX_VALUE = 9223372036854775807

        def get_internal_type(self) -> str:
            return "PositiveBigIntegerField"

        def get_prep_value(self, value: int) -> int:
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return super().get_prep_value(value)

    class BoundedBigAutoField(models.BigAutoField):
        description = _("Big Integer")

        MAX_VALUE = 9223372036854775807

        def get_internal_type(self) -> str:
            return "BigAutoField"

        def get_prep_value(self, value: int) -> int:
            if value:
                value = int(value)
                assert value <= self.MAX_VALUE
            return super().get_prep_value(value)

else:
    # we want full on classes for these
    class BoundedBigIntegerField(BoundedIntegerField):  # type: ignore[no-redef]
        pass

    class BoundedPositiveBigIntegerField(BoundedPositiveIntegerField):  # type: ignore[no-redef]
        pass

    class BoundedBigAutoField(BoundedAutoField):  # type: ignore[no-redef]
        pass
