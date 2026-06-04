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

    def test_validate(self) -> None:
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True


class TestGitHubActionValidator(BaseTicketingActionValidatorTest):
    def setUp(self) -> None:
        super().setUp()
        self.valid_data["data"] = {
            "additional_fields": {"repo": "owner/test-repo", "integration": "12345"}
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


class TestGithubActionValidator(TestGitHubActionValidator):
    __test__ = True
    provider = Action.Type.GITHUB

    def test_validate_missing_repo(self) -> None:
        data = {**self.valid_data, "data": {}}
        validator = BaseActionValidator(
            data=data,
            context={"organization": self.organization},
        )
        assert validator.is_valid() is False


class TestGithubEnterpriseActionValidator(TestGitHubActionValidator):
    __test__ = True
    provider = Action.Type.GITHUB_ENTERPRISE

    def test_validate_missing_repo(self) -> None:
        data = {**self.valid_data, "data": {}}
        validator = BaseActionValidator(
            data=data,
            context={"organization": self.organization},
        )
        assert validator.is_valid() is False
