from __future__ import annotations

from typing import Any

from django.db import models
from django.db.models import ForeignKey

__all__ = ("FlexibleForeignKey",)


class FlexibleForeignKey(ForeignKey):
    def __init__(self, *args: Any, **kwargs: Any):
        kwargs.setdefault("on_delete", models.CASCADE)
        super().__init__(*args, **kwargs)
