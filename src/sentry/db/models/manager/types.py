from __future__ import annotations

from typing import int, TypeVar

from django.db.models import Model

M = TypeVar("M", bound=Model, covariant=True)
R = TypeVar("R", covariant=True, default=M)
