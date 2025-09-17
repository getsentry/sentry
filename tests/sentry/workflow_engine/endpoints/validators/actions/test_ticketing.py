from rest_framework.serializers import ErrorDetail

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class BaseTicketingActionValidatorTest(TestCase):
    __test__ = False

    provider: str

    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=self.provider,
            organization=self.organization,
            user=self.user,
            name=self.provider,
        )
        self.valid_data = {
            "type": Action.Type(self.provider),
            "config": {},
            "data": {},
            "integrationId": self.integration.id,
        }

    def test_validate(self):
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True

    def test_validate__missing_integration_id(self):
        del self.valid_data["integrationId"]
        validator = BaseActionValidator(
            data={**self.valid_data},
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string=f"Integration ID is required for {self.provider} action", code="invalid"
                )
            ]
        }


class TestJiraActionValidator(BaseTicketingActionValidatorTest):
    __test__ = True
    provider = Action.Type.JIRA


class TestJiraServerActionValidator(BaseTicketingActionValidatorTest):
    __test__ = True
    provider = Action.Type.JIRA_SERVER


class TestAzureDevOpsActionValidator(BaseTicketingActionValidatorTest):
    __test__ = True
    provider = Action.Type.AZURE_DEVOPS


class TestGithubActionValidator(BaseTicketingActionValidatorTest):
    __test__ = True
    provider = Action.Type.GITHUB


class TestGithubEnterpriseActionValidator(BaseTicketingActionValidatorTest):
    __test__ = True
    provider = Action.Type.GITHUB_ENTERPRISE
