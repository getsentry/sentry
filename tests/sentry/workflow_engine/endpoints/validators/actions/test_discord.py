from unittest import mock

from django.core.exceptions import ValidationError
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestDiscordActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="discord",
            organization=self.organization,
            user=self.user,
            name="discord",
            external_id=1,
        )

        self.valid_data = {
            "type": Action.Type.DISCORD,
            "config": {
                "targetIdentifier": "1234567890",
                "targetType": "specific",
            },
            "data": {"tags": "asdf"},
            "integrationId": self.integration.id,
        }

    @mock.patch("sentry.integrations.discord.actions.issue_alert.form.validate_channel_id")
    def test_validate(self, mock_validate_channel_id: mock.MagicMock) -> None:
        mock_validate_channel_id.return_value = None

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    def test_validate__empty_server(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {
                    "targetType": "specific",
                    "targetIdentifier": "",
                },
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "channelId": [ErrorDetail(string="This field is required.", code="invalid")]
        }

    @mock.patch("sentry.integrations.discord.actions.issue_alert.form.validate_channel_id")
    def test_validate__invalid_channel_id(self, mock_validate_channel_id: mock.MagicMock) -> None:
        mock_validate_channel_id.side_effect = ValidationError("Invalid channel id")

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "all": [ErrorDetail(string="Discord: Invalid channel id", code="invalid")]
        }
