from typing import int
from unittest import mock

from rest_framework.serializers import ErrorDetail

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestSentryAppActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "sentry_app_identifier": "sentry_app_installation_uuid",
                "targetType": "sentry_app",
                "target_identifier": "123",
            },
            "data": {"settings": []},
        }

    @mock.patch(
        "sentry.rules.actions.sentry_apps.utils.app_service.trigger_sentry_app_action_creators"
    )
    def test_validate(self, mock_trigger_sentry_app_action_creators: mock.MagicMock) -> None:
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=True, message="success"
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    @mock.patch(
        "sentry.rules.actions.sentry_apps.utils.app_service.trigger_sentry_app_action_creators"
    )
    def test_validate__rpc_failure(
        self, mock_trigger_sentry_app_action_creators: mock.MagicMock
    ) -> None:
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=False,
            message="Could not create sentry app action",
            error_type=SentryAppErrorType.SENTRY,
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string="Something went wrong during the alert rule action process!",
                    code="invalid",
                )
            ]
        }
