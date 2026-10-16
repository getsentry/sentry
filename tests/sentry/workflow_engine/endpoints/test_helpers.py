from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

from django.db.models import QuerySet

from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import APIGate, DetectorAPIOperation


@contextmanager
def override_detector_api_availability(
    detector_type_slug: str, availability: Mapping[DetectorAPIOperation, APIGate]
) -> Iterator[None]:
    settings = detector_settings_registry.get(detector_type_slug)
    with patch.object(settings, "api_availability", availability):
        yield


@contextmanager
def assert_querysets_unchanged(**querysets: QuerySet[Any]) -> Iterator[None]:
    original_state = {
        name: list(queryset.order_by("pk").values()) for name, queryset in querysets.items()
    }
    yield
    for name, queryset in querysets.items():
        assert list(queryset.order_by("pk").values()) == original_state[name], name
