from collections.abc import Mapping
from unittest.mock import patch

import pytest

from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.utils.api_availability import (
    get_excluded_types,
    is_api_operation_available,
)
from sentry.workflow_engine.types import (
    APIGate,
    FeatureGate,
    WorkflowEngineAPIAvailability,
    WorkflowEngineAPIOperation,
)
from tests.sentry.workflow_engine.endpoints.test_helpers import GATE_FEATURE

FEATURES_HAS = "sentry.workflow_engine.endpoints.utils.api_availability.features.has"

CLOSED_AVAILABILITY = {operation: False for operation in WorkflowEngineAPIOperation}


def create_settings(
    availability: Mapping[WorkflowEngineAPIOperation, APIGate],
) -> type[WorkflowEngineAPIAvailability]:
    class Settings(WorkflowEngineAPIAvailability):
        api_availability = availability

    return Settings


@pytest.mark.parametrize("operation", list(WorkflowEngineAPIOperation))
def test_operation_without_a_gate_is_available(operation: WorkflowEngineAPIOperation) -> None:
    settings = create_settings({})

    assert is_api_operation_available(settings, operation, Organization())


@pytest.mark.parametrize("gate", [True, False])
def test_boolean_gate_is_the_availability(gate: bool) -> None:
    settings = create_settings({WorkflowEngineAPIOperation.PUT: gate})

    availability = is_api_operation_available(
        settings, WorkflowEngineAPIOperation.PUT, Organization()
    )

    assert availability is gate


def test_excludes_types_that_close_the_operation() -> None:
    settings_by_type = {
        "open": create_settings({}),
        "closed": create_settings({WorkflowEngineAPIOperation.PUT: False}),
    }

    excluded_types = get_excluded_types(
        settings_by_type, WorkflowEngineAPIOperation.PUT, Organization()
    )

    assert excluded_types == ["closed"]


@pytest.mark.parametrize(
    "operation",
    [WorkflowEngineAPIOperation.LIST, WorkflowEngineAPIOperation.DISCOVER, "HEAD"],
)
def test_operation_requires_get(operation: WorkflowEngineAPIOperation | str) -> None:
    settings_by_type = {"unreadable": create_settings({WorkflowEngineAPIOperation.GET: False})}

    excluded_types = get_excluded_types(settings_by_type, operation, Organization())

    assert excluded_types == ["unreadable"]


def test_list_gate_does_not_close_get() -> None:
    settings_by_type = {"unlisted": create_settings({WorkflowEngineAPIOperation.LIST: False})}

    excluded_types = get_excluded_types(
        settings_by_type, WorkflowEngineAPIOperation.GET, Organization()
    )

    assert excluded_types == []


def test_request_method_resolves_to_its_operation() -> None:
    settings_by_type = {"undeletable": create_settings({WorkflowEngineAPIOperation.DELETE: False})}

    excluded_types = get_excluded_types(settings_by_type, "DELETE", Organization())

    assert excluded_types == ["undeletable"]


@pytest.mark.parametrize("operation", ["OPTIONS", None])
def test_operation_without_a_mapping_excludes_nothing(operation: str | None) -> None:
    settings_by_type = {"closed": create_settings(CLOSED_AVAILABILITY)}

    excluded_types = get_excluded_types(settings_by_type, operation, Organization())

    assert excluded_types == []


class FeatureGateTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.gated_settings = create_settings(
            {
                WorkflowEngineAPIOperation.PUT: FeatureGate(GATE_FEATURE),
                WorkflowEngineAPIOperation.DISCOVER: FeatureGate(GATE_FEATURE),
            }
        )

    def test_available_when_the_flag_is_on(self) -> None:
        with self.feature({GATE_FEATURE: True}):
            availability = is_api_operation_available(
                self.gated_settings, WorkflowEngineAPIOperation.PUT, self.organization
            )

        assert availability is True

    def test_unavailable_when_the_flag_is_off(self) -> None:
        with self.feature({GATE_FEATURE: False}):
            availability = is_api_operation_available(
                self.gated_settings, WorkflowEngineAPIOperation.PUT, self.organization
            )

        assert availability is False

    def test_row_operation_checks_the_actor(self) -> None:
        with patch(FEATURES_HAS, return_value=True) as has_feature:
            is_api_operation_available(
                self.gated_settings,
                WorkflowEngineAPIOperation.PUT,
                self.organization,
                actor=self.user,
            )

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=self.user)

    def test_discover_ignores_the_actor(self) -> None:
        with patch(FEATURES_HAS, return_value=True) as has_feature:
            is_api_operation_available(
                self.gated_settings,
                WorkflowEngineAPIOperation.DISCOVER,
                self.organization,
                actor=self.user,
            )

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=None)

    def test_excluded_types_forward_the_actor(self) -> None:
        settings_by_type = {"gated": self.gated_settings}

        with patch(FEATURES_HAS, return_value=False) as has_feature:
            excluded_types = get_excluded_types(
                settings_by_type, WorkflowEngineAPIOperation.PUT, self.organization, actor=self.user
            )

        assert excluded_types == ["gated"]

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=self.user)
