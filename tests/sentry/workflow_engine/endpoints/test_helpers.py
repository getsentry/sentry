from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from types import MappingProxyType
from typing import Any
from unittest.mock import patch

from django.db.models import QuerySet

from sentry.workflow_engine.registry import detector_settings_registry, workflow_settings_registry
from sentry.workflow_engine.types import APIGate, WorkflowEngineAPIOperation, WorkflowType

# Any registered organization feature works as a FeatureGate in tests; this one has no
# effect on the detector endpoints themselves.
GATE_FEATURE = "organizations:workflow-engine-log-evaluations"

GET_AND_PUT_ONLY_AVAILABILITY = MappingProxyType(
    {
        operation: operation in (WorkflowEngineAPIOperation.GET, WorkflowEngineAPIOperation.PUT)
        for operation in WorkflowEngineAPIOperation
    }
)


@contextmanager
def override_detector_api_availability(
    detector_type_slug: str, availability: Mapping[WorkflowEngineAPIOperation, APIGate]
) -> Iterator[None]:
    settings = detector_settings_registry.get(detector_type_slug)

    with patch.object(settings, "api_availability", availability):
        yield


@contextmanager
def override_workflow_api_availability(
    workflow_type: WorkflowType, availability: Mapping[WorkflowEngineAPIOperation, APIGate]
) -> Iterator[None]:
    settings = workflow_settings_registry.get(workflow_type)

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
