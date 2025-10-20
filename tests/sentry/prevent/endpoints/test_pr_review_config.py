from copy import deepcopy
from typing import Any
from unittest import mock

from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import PREVENT_AI_CONFIG_GITHUB_DEFAULT
from sentry.testutils.cases import APITestCase

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

INVALID_ORG_CONFIG = {
    "schema_version": "v1",
    "org_defaults": {},
}


class OrganizationPreventGitHubConfigTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.git_org = "my-github-org"
        self.url = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/{self.git_org}/"

    def test_get_returns_default_when_no_config(self):
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == PREVENT_AI_CONFIG_GITHUB_DEFAULT
        assert resp.data["github_organization"] == {}

    def test_get_returns_config_when_exists(self):
        PreventAIConfiguration.objects.create(
            organization_id=self.org.id,
            provider="github",
            git_organization=self.git_org,
            data=VALID_ORG_CONFIG,
        )

        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data["github_organization"][self.git_org] == VALID_ORG_CONFIG

    def test_put_with_invalid_config_returns_400(self):
        resp = self.client.put(self.url, data=INVALID_ORG_CONFIG, format="json")
        assert resp.status_code == 400
        assert resp.data["detail"] == "Invalid config"

    def test_put_with_valid_config_creates_entry(self):
        resp = self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert resp.status_code == 200
        assert resp.data["github_organization"][self.git_org] == VALID_ORG_CONFIG

        config = PreventAIConfiguration.objects.get(
            organization_id=self.org.id, provider="github", git_organization=self.git_org
        )
        assert config.data == VALID_ORG_CONFIG

    def test_put_updates_existing_config(self):
        PreventAIConfiguration.objects.create(
            organization_id=self.org.id,
            provider="github",
            git_organization=self.git_org,
            data={"org_defaults": {"bug_prediction": {"enabled": False}}, "repo_overrides": {}},
        )

        resp = self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert resp.status_code == 200

        assert (
            PreventAIConfiguration.objects.filter(
                organization_id=self.org.id, provider="github", git_organization=self.git_org
            ).count()
            == 1
        )

        config = PreventAIConfiguration.objects.get(
            organization_id=self.org.id, provider="github", git_organization=self.git_org
        )
        assert config.data == VALID_ORG_CONFIG

    @mock.patch("sentry.api.base.create_audit_entry")
    def test_audit_entry_created(self, mock_create_audit_entry):
        self.client.put(self.url, data=VALID_ORG_CONFIG, format="json")
        assert mock_create_audit_entry.called

    def test_different_git_orgs_have_separate_configs(self):
        git_org_1 = "org-1"
        git_org_2 = "org-2"

        url_1 = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/{git_org_1}/"
        url_2 = f"/api/0/organizations/{self.org.slug}/prevent/ai/github/config/{git_org_2}/"

        config_1: dict[str, Any] = deepcopy(VALID_ORG_CONFIG)
        config_1["org_defaults"]["bug_prediction"]["enabled"] = True
        config_1["org_defaults"]["test_generation"]["enabled"] = True

        config_2: dict[str, Any] = deepcopy(VALID_ORG_CONFIG)
        config_2["org_defaults"]["bug_prediction"]["enabled"] = False
        config_2["org_defaults"]["test_generation"]["enabled"] = False

        self.client.put(url_1, data=config_1, format="json")
        self.client.put(url_2, data=config_2, format="json")

        resp_1 = self.client.get(url_1)
        resp_2 = self.client.get(url_2)

        assert (
            resp_1.data["github_organization"][git_org_1]["org_defaults"]["bug_prediction"][
                "enabled"
            ]
            is True
        )
        assert (
            resp_1.data["github_organization"][git_org_1]["org_defaults"]["test_generation"][
                "enabled"
            ]
            is True
        )
        assert (
            resp_2.data["github_organization"][git_org_2]["org_defaults"]["bug_prediction"][
                "enabled"
            ]
            is False
        )
        assert (
            resp_2.data["github_organization"][git_org_2]["org_defaults"]["test_generation"][
                "enabled"
            ]
            is False
        )
