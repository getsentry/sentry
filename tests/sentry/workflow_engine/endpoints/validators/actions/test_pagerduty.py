from rest_framework.exceptions import ErrorDetail

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestPagerDutyActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        services = [
            {
                "id": 123,
                "service_name": "moo-deng",
            },
            {
                "id": 321,
                "service_name": "moo-waan",
            },
        ]
        self.integration, self.org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": services},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration.config["pagerduty_services"] = services
            self.org_integration.save()

        self.valid_data = {
            "type": Action.Type.PAGERDUTY,
            "config": {"targetIdentifier": "123", "targetType": "specific"},
            "data": {},
            "integrationId": self.integration.id,
        }

    def test_validate(self) -> None:
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    def test_validate__invalid_service(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {
                    "targetType": "specific",
                    "targetIdentifier": "54321",
                },
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "service": [
                ErrorDetail(
                    string="Select a valid choice. 54321 is not one of the available choices.",
                    code="invalid",
                )
            ]
        }
