from __future__ import annotations

from collections.abc import Container
from typing import TYPE_CHECKING, Any, Generic, Self, overload
from uuid import uuid4

from django.db.models import Field, Model
from django.utils.crypto import get_random_string
from django.utils.text import slugify

from sentry.db.models.fields.types import FieldGetType, FieldSetType

if TYPE_CHECKING:
    from sentry.db.models.base import Model as SentryModel


def unique_db_instance(
    inst: SentryModel,
    base_value: str,
    reserved: Container[str] = (),
    max_length: int = 30,
    field_name: str = "slug",
    *args: Any,
    **kwargs: Any,
) -> None:
    if base_value is not None:
        base_value = base_value.strip()
        if base_value in reserved:
            base_value = ""

    if not base_value:
        base_value = uuid4().hex[:12]

    base_qs = type(inst).objects.all()
    if inst.id:
        base_qs = base_qs.exclude(id=inst.id)
    if args or kwargs:
        base_qs = base_qs.filter(*args, **kwargs)

    setattr(inst, field_name, base_value)

    # Don't further mutate if the value is unique and not entirely numeric
    if (
        not base_qs.filter(**{f"{field_name}__iexact": base_value}).exists()
        and not base_value.isdecimal()
    ):
        return

    # We want to sanely generate the shortest unique slug possible, so
    # we try different length endings until we get one that works, or bail.

    # At most, we have 27 attempts here to derive a unique slug
    sizes = (
        (1, 2),  # (36^2) possibilities, 2 attempts
        (5, 3),  # (36^3) possibilities, 3 attempts
        (20, 5),  # (36^5) possibilities, 20 attempts
        (1, 12),  # (36^12) possibilities, 1 final attempt
    )
    for attempts, size in sizes:
        for i in range(attempts):
            end = get_random_string(size, allowed_chars="abcdefghijklmnopqrstuvwxyz0123456790")
            value = base_value[: max_length - size - 1] + "-" + end
            setattr(inst, field_name, value)
            if not base_qs.filter(**{f"{field_name}__iexact": value}).exists():
                return

    # If at this point, we've exhausted all possibilities, we'll just end up hitting
    # an IntegrityError from database, which is ok, and unlikely to happen


def slugify_instance(
    inst: SentryModel,
    label: str,
    reserved: Container[str] = (),
    max_length: int = 30,
    field_name: str = "slug",
    *args: Any,
    **kwargs: Any,
) -> None:
    value = slugify(label)[:max_length]
    value = value.strip("-")

    return unique_db_instance(inst, value, reserved, max_length, field_name, *args, **kwargs)


class Creator(Generic[FieldSetType, FieldGetType]):
    """
    A descriptor that invokes `to_python` when attributes are set.
    This provides backwards compatibility for fields that used to use
    SubfieldBase which will be removed in Django1.10
    """

    def __init__(self, field: Field[FieldSetType, FieldGetType]) -> None:
        self.field = field

    @overload
    def __get__(self, inst: Model, owner: type[Any]) -> Any: ...

    @overload
    def __get__(self, inst: None, owner: type[Any]) -> Self: ...

    def __get__(self, inst: Model | None, owner: type[Any]) -> Self | Any:
        if inst is None:
            return self
        return inst.__dict__[self.field.name]

    def __set__(self, obj: Model, value: Any) -> None:
        obj.__dict__[self.field.name] = self.field.to_python(value)
