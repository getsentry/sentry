from __future__ import annotations
from typing import int

from django.db import models
from django.utils.translation import gettext_lazy as _

__all__ = (
    "BoundedAutoField",
    "BoundedBigAutoField",
    "BoundedIntegerField",
    "BoundedBigIntegerField",
    "BoundedPositiveIntegerField",
    "BoundedPositiveBigIntegerField",
    "WrappingU32IntegerField",
)

I32_MAX = 2_147_483_647  # 2**31 - 1
U32_MAX = 4_294_967_295  # 2**32 - 1
I64_MAX = 9_223_372_036_854_775_807  # 2**63 - 1


class BoundedIntegerField(models.IntegerField):
    MAX_VALUE = I32_MAX

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedPositiveIntegerField(models.PositiveIntegerField):
    MAX_VALUE = I32_MAX

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class WrappingU32IntegerField(models.IntegerField):
    """
    This type allows storing a full unsigned `u32` value by manually wrapping it around,
    so it is stored as a signed `i32` value in the database.
    """

    MIN_VALUE = 0
    MAX_VALUE = U32_MAX

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert self.MIN_VALUE <= value <= self.MAX_VALUE

            if value > I32_MAX:
                value = value - 2**32

        return super().get_prep_value(value)

    def from_db_value(self, value: int | None, expression, connection) -> int | None:
        if value is None:
            return None
        if value < 0:
            return value + 2**32
        return value


class BoundedAutoField(models.AutoField):
    MAX_VALUE = I32_MAX

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedBigIntegerField(models.BigIntegerField):
    description = _("Big Integer")

    MAX_VALUE = I64_MAX

    def get_internal_type(self) -> str:
        return "BigIntegerField"

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedPositiveBigIntegerField(models.PositiveBigIntegerField):
    description = _("Positive big integer")

    MAX_VALUE = I64_MAX

    def get_internal_type(self) -> str:
        return "PositiveBigIntegerField"

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)


class BoundedBigAutoField(models.BigAutoField):
    description = _("Big Integer")

    MAX_VALUE = I64_MAX

    def get_internal_type(self) -> str:
        return "BigAutoField"

    def get_prep_value(self, value: int) -> int:
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super().get_prep_value(value)
