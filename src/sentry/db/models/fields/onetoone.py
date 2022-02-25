from django.db import models
from django.db.models import OneToOneField

__all__ = ("OneToOneCascadeDeletes",)

from sentry.utils.types import Any


class OneToOneCascadeDeletes(OneToOneField):  # type: ignore
    def __init__(self, *args: Any, **kwargs: Any):
        kwargs.setdefault("on_delete", models.CASCADE)
        super().__init__(*args, **kwargs)
