from unittest import mock

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.action_validation import SlackActionValidatorHandler
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


@mock.patch(
    "sentry.notifications.notification_action.registry.action_validator_registry.get",
    return_value=SlackActionValidatorHandler,
)
class TestSlackActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="slack", organization=self.organization, user=self.user
        )

        self.valid_data = {
            "type": Action.Type.SLACK,
            "config": {"targetDisplay": "cathy-sentry", "targetType": ActionTarget.SPECIFIC.value},
            "data": {"tags": "asdf"},
            "integrationId": self.integration.id,
        }

    @mock.patch("sentry.integrations.slack.utils.channel.check_for_channel")
    def test_validate(self, mock_check_for_channel, mock_action_validator_get):
        mock_check_for_channel.return_value = "C1234567890"

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True

    def test_validate__missing_integration_id(self, mock_action_validator_get):
        del self.valid_data["integrationId"]
        validator = BaseActionValidator(
            data={**self.valid_data},
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate__missing_integration(self, mock_action_validator_get):
        validator = BaseActionValidator(
            data={**self.valid_data, "integrationId": 123},
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate__invalid_channel_id(self, mock_action_validator_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetIdentifier": "C1234567890", "targetDisplay": "asdf"},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False

    def test_validate__invalid_channel_name(self, mock_action_validator_get):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetDisplay": "asdf"},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
