from unittest.mock import patch

from sentry.constants import ObjectStatus
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import assume_test_silo_mode


@apply_feature_flag_on_cls("projects:ai-autofix")
class GroupAIAutofixEndpointSuccessTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        integration = self.create_integration(organization=self.organization, external_id="1")

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration = integration.add_organization(self.organization, self.user)

        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
            stack_root="sentry/",
            source_root="sentry/",
        )
        self.organization.update_option("sentry:gen_ai_consent", True)

    def test_successful_setup(self):
        """
        Everything is set up correctly, should respond with OKs.
        """
        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data == {
            "subprocessorConsent": {
                "ok": True,
                "reason": None,
            },
            "genAIConsent": {
                "ok": True,
                "reason": None,
            },
            "integration": {
                "ok": True,
                "reason": None,
            },
        }


@apply_feature_flag_on_cls("projects:ai-autofix")
class GroupAIAutofixEndpointFailureTest(APITestCase, SnubaTestCase):
    def test_no_gen_ai_consent(self):
        self.organization.update_option("sentry:gen_ai_consent", False)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["genAIConsent"] == {
            "ok": False,
            "reason": None,
        }

    @patch(
        "sentry.api.endpoints.group_autofix_setup_check.get_openai_policy",
        return_value="subprocessor",
    )
    def test_needs_subprocessor_consent(self, mock):
        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"

        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["subprocessorConsent"] == {
            "ok": False,
            "reason": None,
        }

    def test_no_code_mappings(self):
        RepositoryProjectPathConfig.objects.filter(
            organization_integration_id=self.organization_integration.id
        ).delete()

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["integration"] == {
            "ok": False,
            "reason": "integration_no_code_mappings",
        }

    def test_disabled_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.organization_integration.update(status=ObjectStatus.DISABLED)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["integration"] == {
            "ok": False,
            "reason": "integration_inactive",
        }

    def test_missing_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.organization_integration.delete()

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["integration"] == {
            "ok": False,
            "reason": "integration_missing",
        }
