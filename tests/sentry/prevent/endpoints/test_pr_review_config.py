from copy import deepcopy
from typing import Any
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import PREVENT_AI_CONFIG_DEFAULT, PREVENT_AI_CONFIG_DEFAULT_V1
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test

VALID_ORG_CONFIG = {
    "schema_version": "v1",
    "org_defaults": {
        "bug_prediction": {
            "enabled": True,
            "sensitivity": "medium",
            "triggers": {"on_command_phrase": True, "on_ready_for_review": True},
        },
        "test_generation": {
            "enabled": False,
            "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
        },
        "vanilla": {
            "enabled": False,
            "sensitivity": "medium",
            "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
        },
    },
    "repo_overrides": {},
}


@region_silo_test
class OrganizationPreventGitHubConfigTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.git_org = "my-github-org"
        self.url = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/{self.git_org}/"

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.org,
                provider="github",
                name=self.git_org,
                external_id=f"github:{self.git_org}",
                status=ObjectStatus.ACTIVE,
            )

    def test_get_returns_default_when_no_config(self):
        """Test GET endpoint returns default config when no configuration exists."""
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == PREVENT_AI_CONFIG_DEFAULT
        assert resp.data["organization"] == {}
        # Default config has on_new_commit disabled for bug_prediction
        assert (
            resp.data["default_org_config"]["org_defaults"]["bug_prediction"]["triggers"][
                "on_new_commit"
            ]
            is False
        )

    def test_get_returns_v1_default_when_feature_flag_enabled(self):
        """Test GET endpoint returns V1 default config when code-review-run-per-commit flag is enabled."""
        with self.feature("organizations:code-review-run-per-commit"):
            resp = self.client.get(self.url)
            assert resp.status_code == 200
            assert resp.data == PREVENT_AI_CONFIG_DEFAULT_V1
            # V1 config has on_new_commit enabled for bug_prediction
            assert (
                resp.data["default_org_config"]["org_defaults"]["bug_prediction"]["triggers"][
                    "on_new_commit"
                ]
                is True
            )
            assert resp.data["organization"] == {}

    def test_get_returns_config_when_exists(self):
        """Test GET endpoint returns the saved configuration when it exists."""
        PreventAIConfiguration.objects.create(
            organization_id=self.org.id,
            integration_id=self.integration.id,
            data=VALID_ORG_CONFIG,
        )

        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data["organization"] == VALID_ORG_CONFIG

    def test_get_returns_404_when_integration_not_found(self):
        """Test GET endpoint returns 404 when GitHub integration doesn't exist."""
        # Use a different git org name that doesn't have an integration
        url = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/nonexistent-org/"
        resp = self.client.get(url)
        assert resp.status_code == 404
        assert resp.data["detail"] == "GitHub integration not found"

    def test_put_with_invalid_config_returns_400(self):
        """Test PUT endpoint returns 400 when provided with invalid config."""
        resp = self.client.put(
            self.url, data={"schema_version": "v1", "org_defaults": {}}, format="json"
        )
        assert resp.status_code == 400
        assert resp.data["detail"] == "Invalid config"

    def test_put_with_valid_config_creates_entry(self):
        """Test PUT endpoint creates a new configuration entry."""
        resp = self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert resp.status_code == 200
        assert resp.data["organization"] == VALID_ORG_CONFIG

        config = PreventAIConfiguration.objects.get(
            organization_id=self.org.id, integration_id=self.integration.id
        )
        assert config.data == VALID_ORG_CONFIG

    def test_put_updates_existing_config(self):
        """Test PUT endpoint updates an existing configuration."""
        PreventAIConfiguration.objects.create(
            organization_id=self.org.id,
            integration_id=self.integration.id,
            data={"org_defaults": {"bug_prediction": {"enabled": False}}, "repo_overrides": {}},
        )

        resp = self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert resp.status_code == 200

        assert (
            PreventAIConfiguration.objects.filter(
                organization_id=self.org.id, integration_id=self.integration.id
            ).count()
            == 1
        )

        config = PreventAIConfiguration.objects.get(
            organization_id=self.org.id, integration_id=self.integration.id
        )
        assert config.data == VALID_ORG_CONFIG

    def test_put_returns_404_when_integration_not_found(self):
        """Test PUT endpoint returns 404 when GitHub integration doesn't exist."""
        url = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/nonexistent-org/"
        resp = self.client.put(url, data=VALID_ORG_CONFIG, format="json")
        assert resp.status_code == 404
        assert resp.data["detail"] == "GitHub integration not found"

    @mock.patch(
        "sentry.prevent.endpoints.pr_review_github_config.OrganizationPreventGitHubConfigEndpoint.create_audit_entry"
    )
    def test_audit_entry_created(self, mock_create_audit_entry):
        """Test that an audit entry is created when configuration is updated."""
        self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert mock_create_audit_entry.called
        call_args = mock_create_audit_entry.call_args
        assert call_args is not None
        assert call_args.kwargs["organization"] == self.org
        data: Any = call_args.kwargs["data"]
        assert data["git_organization"] == self.git_org
        assert data["provider"] == "github"

    def test_put_with_missing_required_fields_returns_400(self):
        """Test PUT endpoint returns 400 when required fields are missing."""
        invalid_config = {
            "schema_version": "v1",
            "org_defaults": {
                "bug_prediction": {
                    "enabled": True,
                },
            },
            "repo_overrides": {},
        }
        resp = self.client.put(self.url, data=invalid_config, format="json")
        assert resp.status_code == 400
        assert resp.data["detail"] == "Invalid config"

    def test_put_with_invalid_sensitivity_value_returns_400(self):
        """Test PUT endpoint returns 400 when sensitivity has an invalid value."""
        invalid_config: Any = deepcopy(VALID_ORG_CONFIG)
        invalid_config["org_defaults"]["bug_prediction"]["sensitivity"] = "invalid"

        resp = self.client.put(self.url, data=invalid_config, format="json")
        assert resp.status_code == 400
        assert resp.data["detail"] == "Invalid config"

    def test_config_with_repo_overrides(self):
        """Test that configuration with repo overrides is properly saved and retrieved."""
        config_with_overrides: Any = deepcopy(VALID_ORG_CONFIG)
        config_with_overrides["repo_overrides"] = {
            "my-repo": {
                "bug_prediction": {
                    "enabled": True,
                    "sensitivity": "high",
                    "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
                },
                "test_generation": {
                    "enabled": True,
                    "triggers": {"on_command_phrase": True, "on_ready_for_review": True},
                },
                "vanilla": {
                    "enabled": False,
                    "sensitivity": "low",
                    "triggers": {"on_command_phrase": False, "on_ready_for_review": False},
                },
            }
        }

        resp = self.client.put(self.url, data=config_with_overrides, format="json")
        assert resp.status_code == 200

        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert (
            resp.data["organization"]["repo_overrides"]["my-repo"]["bug_prediction"]["sensitivity"]
            == "high"
        )
