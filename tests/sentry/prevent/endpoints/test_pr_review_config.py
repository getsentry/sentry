from unittest import mock

from sentry.testutils.cases import APITestCase
from sentry.types.prevent_config import PREVENT_AI_CONFIG_GITHUB_DEFAULT

VALID_CONFIG = {
    "schema_version": "v1",
    "default_org_config": {
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
    },
    "github_organizations": {},
}

INVALID_CONFIG = {
    "schema_version": "v1",
    "default_org_config": {
        "org_defaults": {},
    },
}


class OrganizationPreventGitHubConfigTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.org.slug}/prevent/github/config/"

    def test_missing_config_param_returns_400(self):
        resp = self.client.put(self.url, data={}, format="json")
        assert resp.status_code == 400
        assert resp.data["detail"] == "Missing 'config' parameter"

    def test_invalid_config_schema_returns_400(self):
        resp = self.client.put(self.url, data={"config": INVALID_CONFIG}, format="json")
        assert resp.status_code == 400
        assert "'github_organizations' is a required property" in resp.data["detail"]

    def test_valid_config_succeeds_and_sets_option(self):
        resp = self.client.put(self.url, data={"config": VALID_CONFIG}, format="json")
        assert resp.status_code == 200
        assert resp.data["preventAiConfigGithub"] == VALID_CONFIG
        assert self.org.get_option("sentry:prevent_ai_config_github") == VALID_CONFIG

    @mock.patch("sentry.api.base.create_audit_entry")
    def test_audit_entry_created(self, mock_create_audit_entry):
        self.client.put(self.url, data={"config": VALID_CONFIG}, format="json")
        assert mock_create_audit_entry.called

    def test_set_and_get_endpoint_returns_config(self):
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == {"preventAiConfigGithub": PREVENT_AI_CONFIG_GITHUB_DEFAULT}

        self.client.put(self.url, data={"config": VALID_CONFIG}, format="json")
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == {"preventAiConfigGithub": VALID_CONFIG}
