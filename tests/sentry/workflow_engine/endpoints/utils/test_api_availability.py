from collections.abc import Mapping
from unittest.mock import patch

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

_FEATURES_HAS = "sentry.workflow_engine.endpoints.utils.api_availability.features.has"

_CLOSED_AVAILABILITY = {operation: False for operation in WorkflowEngineAPIOperation}


def _create_settings(
    availability: Mapping[WorkflowEngineAPIOperation, APIGate],
) -> type[WorkflowEngineAPIAvailability]:
    class Settings(WorkflowEngineAPIAvailability):
        api_availability = availability

    return Settings


class IsAPIOperationAvailableTest(TestCase):
    def test_operation_missing_from_the_settings_is_available(self) -> None:
        settings = _create_settings(
            {
                WorkflowEngineAPIOperation.GET: True,
                WorkflowEngineAPIOperation.LIST: True,
            }
        )

        availability = is_api_operation_available(
            settings, WorkflowEngineAPIOperation.DISCOVER, self.organization
        )

        assert availability is True

    def test_true_gate_is_available(self) -> None:
        settings = _create_settings({WorkflowEngineAPIOperation.PUT: True})

        availability = is_api_operation_available(
            settings, WorkflowEngineAPIOperation.PUT, self.organization
        )

        assert availability is True

    def test_false_gate_is_unavailable(self) -> None:
        settings = _create_settings({WorkflowEngineAPIOperation.PUT: False})

        availability = is_api_operation_available(
            settings, WorkflowEngineAPIOperation.PUT, self.organization
        )

        assert availability is False

    def test_feature_gate_is_available_when_the_flag_is_on(self) -> None:
        settings = _create_settings({WorkflowEngineAPIOperation.PUT: FeatureGate(GATE_FEATURE)})

        with self.feature({GATE_FEATURE: True}):
            availability = is_api_operation_available(
                settings, WorkflowEngineAPIOperation.PUT, self.organization
            )

        assert availability is True

    def test_feature_gate_is_unavailable_when_the_flag_is_off(self) -> None:
        settings = _create_settings({WorkflowEngineAPIOperation.PUT: FeatureGate(GATE_FEATURE)})

        with self.feature({GATE_FEATURE: False}):
            availability = is_api_operation_available(
                settings, WorkflowEngineAPIOperation.PUT, self.organization
            )

        assert availability is False

    def test_feature_gate_checks_the_actor(self) -> None:
        settings = _create_settings({WorkflowEngineAPIOperation.PUT: FeatureGate(GATE_FEATURE)})

        with patch(_FEATURES_HAS, return_value=True) as has_feature:
            is_api_operation_available(
                settings, WorkflowEngineAPIOperation.PUT, self.organization, actor=self.user
            )

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=self.user)

    def test_discover_feature_gate_ignores_the_actor(self) -> None:
        settings = _create_settings(
            {WorkflowEngineAPIOperation.DISCOVER: FeatureGate(GATE_FEATURE)}
        )

        with patch(_FEATURES_HAS, return_value=True) as has_feature:
            is_api_operation_available(
                settings, WorkflowEngineAPIOperation.DISCOVER, self.organization, actor=self.user
            )

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=None)


class GetExcludedTypesTest(TestCase):
    def test_excludes_types_that_close_the_operation(self) -> None:
        settings_by_type = {
            "open": _create_settings({}),
            "closed": _create_settings({WorkflowEngineAPIOperation.PUT: False}),
        }

        excluded_types = get_excluded_types(
            settings_by_type, WorkflowEngineAPIOperation.PUT, self.organization
        )

        assert excluded_types == ["closed"]

    def test_list_requires_get(self) -> None:
        settings_by_type = {"unreadable": _create_settings({WorkflowEngineAPIOperation.GET: False})}

        excluded_types = get_excluded_types(
            settings_by_type, WorkflowEngineAPIOperation.LIST, self.organization
        )

        assert excluded_types == ["unreadable"]

    def test_discover_requires_get(self) -> None:
        settings_by_type = {"unreadable": _create_settings({WorkflowEngineAPIOperation.GET: False})}

        excluded_types = get_excluded_types(
            settings_by_type, WorkflowEngineAPIOperation.DISCOVER, self.organization
        )

        assert excluded_types == ["unreadable"]

    def test_head_counts_as_get(self) -> None:
        settings_by_type = {"unreadable": _create_settings({WorkflowEngineAPIOperation.GET: False})}

        excluded_types = get_excluded_types(settings_by_type, "HEAD", self.organization)

        assert excluded_types == ["unreadable"]

    def test_list_gate_does_not_close_get(self) -> None:
        settings_by_type = {"unlisted": _create_settings({WorkflowEngineAPIOperation.LIST: False})}

        excluded_types = get_excluded_types(
            settings_by_type, WorkflowEngineAPIOperation.GET, self.organization
        )

        assert excluded_types == []

    def test_request_method_resolves_to_its_operation(self) -> None:
        settings_by_type = {
            "undeletable": _create_settings({WorkflowEngineAPIOperation.DELETE: False})
        }

        excluded_types = get_excluded_types(settings_by_type, "DELETE", self.organization)

        assert excluded_types == ["undeletable"]

    def test_unknown_method_excludes_nothing(self) -> None:
        settings_by_type = {"closed": _create_settings(_CLOSED_AVAILABILITY)}

        excluded_types = get_excluded_types(settings_by_type, "OPTIONS", self.organization)

        assert excluded_types == []

    def test_no_operation_excludes_nothing(self) -> None:
        settings_by_type = {"closed": _create_settings(_CLOSED_AVAILABILITY)}

        excluded_types = get_excluded_types(settings_by_type, None, self.organization)

        assert excluded_types == []

    def test_feature_gates_receive_the_actor(self) -> None:
        settings_by_type = {
            "gated": _create_settings({WorkflowEngineAPIOperation.PUT: FeatureGate(GATE_FEATURE)})
        }

        with patch(_FEATURES_HAS, return_value=False) as has_feature:
            excluded_types = get_excluded_types(
                settings_by_type, WorkflowEngineAPIOperation.PUT, self.organization, actor=self.user
            )

        assert excluded_types == ["gated"]

        has_feature.assert_called_once_with(GATE_FEATURE, self.organization, actor=self.user)
