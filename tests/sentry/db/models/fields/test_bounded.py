import pytest

from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
)


def test_norm_int():
    field = BoundedIntegerField()
    with pytest.raises(AssertionError):
        field.get_prep_value(9223372036854775807)


@pytest.mark.parametrize("cls", (BoundedBigIntegerField, BoundedPositiveIntegerField))
def test_big_int(cls):
    field = cls()
    with pytest.raises(AssertionError):
        field.get_prep_value(9223372036854775808)
