from unittest import mock

from django.core.exceptions import ValidationError
from rest_framework.serializers import ErrorDetail

from sentry.integrations.slack.utils.channel import SlackChannelIdData
from sentry.shared_integrations.exceptions import DuplicateDisplayNameError
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestSlackActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="slack",
            organization=self.organization,
            user=self.user,
            name="slack",
            metadata={"domain_name": "https://slack.com"},
        )

        self.valid_data = {
            "type": Action.Type.SLACK,
            "config": {"targetDisplay": "cathy-sentry", "targetType": "specific"},
            "data": {"tags": "asdf"},
            "integrationId": self.integration.id,
        }

    @mock.patch("sentry.integrations.slack.actions.form.get_channel_id")
    def test_validate(self, mock_get_channel_id: mock.MagicMock) -> None:
        mock_get_channel_id.return_value = SlackChannelIdData(
            prefix="#", channel_id="C1234567890", timed_out=False
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    @mock.patch("sentry.integrations.slack.actions.form.validate_slack_entity_id")
    def test_validate__invalid_channel_id(
        self, mock_validate_slack_entity_id: mock.MagicMock
    ) -> None:
        mock_validate_slack_entity_id.side_effect = ValidationError("Invalid channel id")

        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {
                    "targetType": "specific",
                    "targetIdentifier": "C1234567890",
                    "targetDisplay": "asdf",
                },
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "all": [ErrorDetail(string="Slack: Invalid channel id", code="invalid")]
        }

    @mock.patch("sentry.integrations.slack.actions.form.get_channel_id")
    def test_validate__invalid_channel_name(self, mock_get_channel_id: mock.MagicMock) -> None:
        mock_get_channel_id.side_effect = DuplicateDisplayNameError()

        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetType": "specific", "targetDisplay": "asdf"},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "all": [
                ErrorDetail(
                    string="Slack: Multiple users were found with display name 'asdf'. Please use your username, found at https://slack.com/account/settings#username.",
                    code="invalid",
                )
            ]
        }
