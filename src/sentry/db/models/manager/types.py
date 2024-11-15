from __future__ import annotations

from django.db.models import Model
from typing_extensions import TypeVar

M = TypeVar("M", bound=Model, covariant=True)
R = TypeVar("R", covariant=True, default=M)
