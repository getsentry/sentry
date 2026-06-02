"""Registry for Seer feature result delivery handlers."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

FeatureRunStatus = Literal["completed", "error"]

FeatureDeliveryFn = Callable[
    [int | str, FeatureRunStatus, dict[str, Any] | None, int, str | None, int], None
]

DELIVERY_HANDLERS: dict[str, FeatureDeliveryFn] = {}
