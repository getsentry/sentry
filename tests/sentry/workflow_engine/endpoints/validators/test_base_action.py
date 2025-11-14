from typing import int
from unittest import mock

from rest_framework.serializers import ErrorDetail

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import MockActionHandler, MockActionValidatorTranslator


@mock.patch(
    "sentry.workflow_engine.registry.action_handler_registry.get",
    return_value=MockActionHandler,
)
@mock.patch(
    "sentry.notifications.notification_action.registry.action_validator_registry.get",
    return_value=MockActionValidatorTranslator,
)
class TestBaseActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.valid_data = {
            "type": Action.Type.SLACK,
            "config": {"foo": "bar"},
            "data": {"baz": "bar"},
            "integrationId": 1,
        }

    def test_validate_type(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "type": Action.Type.SLACK,
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_type__invalid(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "type": "invalid_test",
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_config(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"foo": "bar"},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_config__invalid(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"invalid": 1},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_data(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "data": {"baz": "foo"},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_data__invalid(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "data": {"invalid": 1},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_type__action_gated(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        organization = self.create_organization()

        def make_validator() -> BaseActionValidator:
            return BaseActionValidator(
                data={
                    **self.valid_data,
                    "type": Action.Type.SLACK,
                },
                context={"organization": organization},
            )

        validator = make_validator()
        with self.feature({"organizations:integrations-alert-rule": False}):
            assert not validator.is_valid()

        # Exact same one, but new, because validation is cached.
        validator2 = make_validator()
        with self.feature("organizations:integrations-alert-rule"):
            assert validator2.is_valid()

    def test_validate_data__missing_integration_id(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        validator = BaseActionValidator(
            data={
                "type": Action.Type.SLACK,
                "config": {"foo": "bar"},
                "data": {"baz": "bar"},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string="Integration ID is required for action type slack", code="invalid"
                )
            ]
        }

    def test_validate_data__extra_integration_id(
        self, mock_action_handler_get: mock.MagicMock, mock_action_validator_get: mock.MagicMock
    ) -> None:
        # non integration actions should not have an integration id
        validator = BaseActionValidator(
            data={
                "type": Action.Type.PLUGIN,
                "config": {"foo": "bar"},
                "data": {"baz": "bar"},
                "integrationId": 1,
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string="Integration ID is not allowed for action type plugin", code="invalid"
                )
            ]
        }
