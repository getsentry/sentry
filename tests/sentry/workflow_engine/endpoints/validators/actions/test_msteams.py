from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestMSTeamsActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="msteams", organization=self.organization, user=self.user, name="msteams"
        )

        self.valid_data = {
            "type": Action.Type.MSTEAMS,
            "config": {"targetDisplay": "cathy-sentry", "targetType": "specific"},
            "data": {},
            "integrationId": self.integration.id,
        }

    @mock.patch("sentry.integrations.msteams.actions.form.find_channel_id")
    def test_validate(self, mock_check_for_channel: mock.MagicMock) -> None:
        mock_check_for_channel.return_value = "C1234567890"

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    @mock.patch("sentry.integrations.msteams.actions.form.find_channel_id")
    def test_validate__invalid_channel_id(self, mock_find_channel_id: mock.MagicMock) -> None:
        mock_find_channel_id.return_value = None

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
            "all": [
                ErrorDetail(
                    string='The channel or user "asdf" could not be found in the msteams Team.',
                    code="invalid",
                )
            ]
        }
