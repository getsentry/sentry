from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, NotRequired, TypedDict

from django import forms
from django.forms import ChoiceField

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise


class _FieldConfig(TypedDict):
    name: str
    label: str | _StrPromise
    placeholder: str | None
    help: str | _StrPromise
    required: bool
    default: object
    type: NotRequired[str]
    choices: NotRequired[object]


def field_to_config(name: str, field: forms.Field) -> _FieldConfig:
    config: _FieldConfig = {
        "name": name,
        "label": field.label or name.replace("_", " ").title(),
        "placeholder": field.widget.attrs.get("placeholder"),
        "help": field.help_text,
        "required": field.required,
        "default": field.initial,
    }
    if isinstance(field, forms.URLField):
        config["type"] = "url"
    elif isinstance(field, forms.IntegerField):
        config["type"] = "number"
    elif isinstance(field, forms.BooleanField):
        config["type"] = "bool"
    elif isinstance(field, forms.EmailField):
        config["type"] = "email"
    elif isinstance(field, forms.CharField):
        if isinstance(field.widget, forms.PasswordInput):
            config["type"] = "secret"
        elif isinstance(field.widget, forms.Textarea):
            config["type"] = "textarea"
        else:
            config["type"] = "text"
    elif isinstance(field, forms.ChoiceField):
        config["type"] = "select"
        config["choices"] = field.choices
    return config


def form_to_config(form: forms.Form) -> list[_FieldConfig]:
    return [field_to_config(name, field) for name, field in form.base_fields.items()]


def set_field_choices(field: forms.Field, choices: Sequence[tuple[object, object]]) -> None:
    """workaround for typeddjango/django-stubs#1514"""
    if not isinstance(field, ChoiceField):
        raise TypeError(f"expected ChoiceField, got {field!r}")
    field.choices = choices
    field.widget.choices = choices
