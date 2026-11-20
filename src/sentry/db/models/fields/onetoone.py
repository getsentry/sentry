from typing import Any

from django.db import models
from django.db.models import OneToOneField

from sentry.db.models.fields.types import FieldGetType, FieldSetType

__all__ = ("OneToOneCascadeDeletes",)


class OneToOneCascadeDeletes(OneToOneField[FieldSetType, FieldGetType]):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("on_delete", models.CASCADE)
        super().__init__(*args, **kwargs)
