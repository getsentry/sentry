from __future__ import annotations

from typing import TypeVar

# matches what django-stubs field typevars are
FieldSetType = TypeVar("FieldSetType", contravariant=True)
FieldGetType = TypeVar("FieldGetType", covariant=True)
