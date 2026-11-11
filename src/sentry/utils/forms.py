from __future__ import annotations

from collections.abc import Sequence

from django import forms
from django.forms import ChoiceField


def set_field_choices(field: forms.Field, choices: Sequence[tuple[object, object]]) -> None:
    """workaround for typeddjango/django-stubs#1514"""
    if not isinstance(field, ChoiceField):
        raise TypeError(f"expected ChoiceField, got {field!r}")
    field.choices = choices
    field.widget.choices = choices
