from typing import int
import pytest

from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
    WrappingU32IntegerField,
)


def test_norm_int() -> None:
    field = BoundedIntegerField()
    with pytest.raises(AssertionError):
        field.get_prep_value(9223372036854775807)


@pytest.mark.parametrize("cls", (BoundedBigIntegerField, BoundedPositiveIntegerField))
def test_big_int(cls) -> None:
    field = cls()
    with pytest.raises(AssertionError):
        field.get_prep_value(9223372036854775808)


def test_u32_wraparound() -> None:
    field = WrappingU32IntegerField()

    assert field.get_prep_value(2**31) == -(2**31)  # I32_MAX + 1 wraps to I32_MIN
    assert field.get_prep_value(2**32 - 1) == -1  # U32_MAX wraps to -1

    assert field.from_db_value(-(2**31), None, None) == 2**31
    assert field.from_db_value(-1, None, None) == 2**32 - 1

    assert field.from_db_value(field.get_prep_value(3_000_000_000), None, None) == 3_000_000_000
