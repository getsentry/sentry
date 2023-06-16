from urllib.parse import parse_qs

import pytest
import responses
from rest_framework.serializers import ValidationError

from sentry.constants import ObjectStatus
from sentry.identity.vercel import VercelIdentityProvider
from sentry.integrations.vercel import VercelClient, VercelIntegrationProvider
from sentry.models import (
    Integration,
    OrganizationIntegration,
    Project,
    ProjectKey,
    ProjectKeyStatus,
    ScheduledDeletion,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
)
from sentry.testutils import IntegrationTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    # Vercel Variables
    project_id = "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"
    team_id = "my_team_id"
    config_id = "my_config_id"

    def assert_setup_flow(self, is_team=False, multi_config_org=None, no_name=False):
        responses.reset()
        access_json = {
            "user_id": "my_user_id",
            "access_token": "my_access_token",
            "installation_id": self.config_id,
        }

        if is_team:
            team_query = f"teamId={self.team_id}"
            access_json["team_id"] = self.team_id
            responses.add(
                responses.GET,
                f"{VercelClient.base_url}{VercelClient.GET_TEAM_URL % self.team_id}?{team_query}",
                json={"name": "My Team Name", "slug": "my_team_slug"},
            )
        else:
            team_query = ""
            name = None if no_name else "My Name"
            responses.add(
                responses.GET,
                f"{VercelClient.base_url}{VercelClient.GET_USER_URL}",
                json={"user": {"name": name, "username": "my_user_name"}},
            )

        responses.add(
            responses.POST, VercelIdentityProvider.oauth_access_token_url, json=access_json
        )

        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECTS_URL}?limit={VercelClient.pagination_limit}&{team_query}",
            json={"projects": [], "pagination": {"count": 0, "next": None}},
        )

        params = {
            "configurationId": "config_id",
            "code": "oauth-code",
            "next": "https://example.com",
        }
        self.pipeline.bind_state("user_id", self.user.id)
        # TODO: Should use the setup path since we /configure instead
        resp = self.client.get(self.setup_path, params)

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/vercel/configure/"]
        assert req_params["client_id"] == ["vercel-client-id"]
        assert req_params["client_secret"] == ["vercel-client-secret"]

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.key)

        external_id = self.team_id if is_team else "my_user_id"
        name = "My Team Name" if is_team else "my_user_name" if no_name else "My Name"
        installation_type = "team" if is_team else "user"

        assert integration.external_id == external_id
        assert integration.name == name
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": self.config_id,
            "installation_type": installation_type,
        }
        assert OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert SentryAppInstallationForProvider.objects.get(
            organization_id=self.organization.id, provider="vercel"
        )

    @responses.activate
    def test_team_flow(self):
        self.assert_setup_flow(is_team=True)

    @responses.activate
    def test_user_flow(self):
        self.assert_setup_flow(is_team=False)

    @responses.activate
    def test_no_name(self):
        self.assert_setup_flow(no_name=True)

    @responses.activate
    def test_use_existing_installation(self):
        sentry_app = self.create_internal_integration(
            webhook_url=None,
            name="Vercel Internal Integration",
            organization=self.organization,
        )
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        SentryAppInstallationForProvider.objects.create(
            organization_id=self.organization.id,
            provider="vercel",
            sentry_app_installation=sentry_app_installation,
        )
        self.assert_setup_flow(is_team=False)
        assert SentryAppInstallation.objects.count() == 1

    @responses.activate
    def test_update_organization_config(self):
        """Test that Vercel environment variables are created"""
        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        project_id = self.project.id
        enabled_dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id)).get_dsn(
            public=True
        )
        sentry_auth_token = SentryAppInstallationToken.objects.get_token(org.id, "vercel")

        env_var_map = {
            "SENTRY_ORG": {
                "type": "encrypted",
                "value": org.slug,
                "target": ["production", "preview"],
            },
            "SENTRY_PROJECT": {
                "type": "encrypted",
                "value": self.project.slug,
                "target": ["production", "preview"],
            },
            "SENTRY_DSN": {
                "type": "encrypted",
                "value": enabled_dsn,
                "target": [
                    "production",
                    "preview",
                    "development",
                ],
            },
            "SENTRY_AUTH_TOKEN": {
                "type": "encrypted",
                "value": sentry_auth_token,
                "target": ["production", "preview"],
            },
            "VERCEL_GIT_COMMIT_SHA": {
                "type": "system",
                "value": "VERCEL_GIT_COMMIT_SHA",
                "target": ["production", "preview"],
            },
        }

        # mock get_project API call
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECT_URL % self.project_id}",
            json={"link": {"type": "github"}, "framework": "nextjs"},
        )

        # mock create the env vars
        for env_var, details in env_var_map.items():
            responses.add(
                responses.POST,
                f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_URL % self.project_id}",
                json={
                    "key": env_var,
                    "value": details["value"],
                    "target": details["target"],
                    "type": details["type"],
                },
            )

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {}
        data = {"project_mappings": [[project_id, self.project_id]]}

        installation.update_organization_config(data)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {"project_mappings": [[project_id, self.project_id]]}

        # assert the env vars were created correctly
        req_params = json.loads(responses.calls[5].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[6].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[7].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production", "preview", "development"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[9].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "system"

    @responses.activate
    def test_update_org_config_vars_exist(self):
        """Test the case wherein the secret and env vars already exist"""

        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        project_id = self.project.id
        enabled_dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id)).get_dsn(
            public=True
        )
        sentry_auth_token = SentryAppInstallationToken.objects.get_token(org.id, "vercel")

        env_var_map = {
            "SENTRY_ORG": {
                "type": "encrypted",
                "value": org.slug,
                "target": ["production", "preview"],
            },
            "SENTRY_PROJECT": {
                "type": "encrypted",
                "value": self.project.slug,
                "target": ["production", "preview"],
            },
            "SENTRY_DSN": {
                "type": "encrypted",
                "value": enabled_dsn,
                "target": [
                    "production",
                    "preview",
                    "development",
                ],
            },
            "SENTRY_AUTH_TOKEN": {
                "type": "encrypted",
                "value": sentry_auth_token,
                "target": ["production", "preview"],
            },
            "VERCEL_GIT_COMMIT_SHA": {
                "type": "system",
                "value": "VERCEL_GIT_COMMIT_SHA",
                "target": ["production", "preview"],
            },
        }

        # mock get_project API call
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECT_URL % self.project_id}",
            json={"link": {"type": "github"}, "framework": "gatsby"},
        )

        # mock update env vars
        count = 0
        for env_var, details in env_var_map.items():
            # mock try to create env var
            responses.add(
                responses.POST,
                f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_URL % self.project_id}",
                json={"error": {"code": "ENV_ALREADY_EXISTS"}},
                status=400,
            )
            # mock get env var
            responses.add(
                responses.GET,
                f"{VercelClient.base_url}{VercelClient.GET_ENV_VAR_URL % self.project_id}",
                json={"envs": [{"id": count, "key": env_var}]},
            )
            # mock update env var
            responses.add(
                responses.PATCH,
                f"{VercelClient.base_url}{VercelClient.UPDATE_ENV_VAR_URL % (self.project_id, count)}",
                json={
                    "key": env_var,
                    "value": details["value"],
                    "target": details["target"],
                    "type": details["type"],
                },
            )
            count += 1

        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {}
        installation.update_organization_config(data)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {"project_mappings": [[project_id, self.project_id]]}

        req_params = json.loads(responses.calls[5].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[11].request.body)
        assert req_params["key"] == "SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production", "preview", "development"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[14].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = json.loads(responses.calls[17].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "system"

    @responses.activate
    def test_upgrade_org_config_no_dsn(self):
        """Test that the function doesn't progress if there is no active DSN"""

        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        org = self.organization
        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)

        dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id))
        dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)
        with pytest.raises(ValidationError):
            installation.update_organization_config(data)

    @responses.activate
    def test_get_dynamic_display_information(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
        dynamic_display_info = installation.get_dynamic_display_information()
        instructions = dynamic_display_info["configure_integration"]["instructions"]
        assert len(instructions) == 2
        assert "Don't have a project yet?" in instructions[0]
        assert "configure your repositories." in instructions[1]

    @responses.activate
    def test_uninstall(self):
        with self.tasks():
            self.assert_setup_flow()
            responses.add(
                responses.DELETE,
                f"{VercelClient.base_url}{VercelClient.UNINSTALL % self.config_id}",
                json={},
            )

            integration = Integration.objects.get(provider=self.provider.key)
            path = f"/api/0/organizations/{self.organization.slug}/integrations/{integration.id}/"
            response = self.client.delete(path, format="json")
            assert response.status_code == 204

        # deleting the integration only happens when we get the Vercel webhook
        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(
            integration_id=integration.id, organization_id=self.organization.id
        )
        assert org_integration.status == ObjectStatus.PENDING_DELETION
        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration", object_id=org_integration.id
        ).exists()
