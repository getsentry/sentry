from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import MockActionHandler


@mock.patch(
    "sentry.workflow_engine.registry.action_handler_registry.get",
    return_value=MockActionHandler,
)
class TestBaseActionValidator(TestCase):
    def setUp(self):
        super().setUp()
        self.valid_data = {
            "type": Action.Type.SLACK,
            "config": {"foo": "bar"},
            "data": {"baz": "bar"},
            "integrationId": 1,
        }

    def test_validate_type(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "type": Action.Type.SLACK,
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_type__invalid(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "type": "invalid_test",
            }
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_config(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"foo": "bar"},
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_config__invalid(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"invalid": 1},
            },
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_data(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "data": {"baz": "foo"},
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_data__invalid(self, mock_action_handler_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "data": {"invalid": 1},
            },
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_type__action_gated(self, mock_action_handler_get):
        organization = self.create_organization()

        def make_validator():
            return BaseActionValidator(
                context={"organization": organization},
                data={
                    **self.valid_data,
                    "type": Action.Type.SLACK,
                },
            )

        validator = make_validator()
        with self.feature({"organizations:integrations-alert-rule": False}):
            assert not validator.is_valid()

        # Exact same one, but new, because validation is cached.
        validator2 = make_validator()
        with self.feature("organizations:integrations-alert-rule"):
            assert validator2.is_valid()
