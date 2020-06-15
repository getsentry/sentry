from __future__ import absolute_import

import responses
import json

from six.moves.urllib.parse import parse_qs
from sentry.integrations.vercel import VercelIntegrationProvider
from sentry.models import (
    Integration,
    OrganizationIntegration,
    Project,
    ProjectKey,
    ProjectKeyStatus,
    SentryAppInstallationForProvider,
    SentryAppInstallation,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.testutils import IntegrationTestCase


class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    def assert_setup_flow(self, is_team=False):
        responses.reset()
        access_json = {
            "user_id": "my_user_id",
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
        }

        if is_team:
            team_query = "?teamId=my_team_id"
            access_json["team_id"] = "my_team_id"
            responses.add(
                responses.GET,
                "https://api.vercel.com/v1/teams/my_team_id%s" % team_query,
                json={"name": "my_team_name"},
            )
        else:
            team_query = ""
            responses.add(
                responses.GET,
                "https://api.vercel.com/www/user",
                json={"user": {"name": "my_user_name"}},
            )

        responses.add(
            responses.POST, "https://api.vercel.com/v2/oauth/access_token", json=access_json
        )

        responses.add(
            responses.GET,
            "https://api.vercel.com/v4/projects/%s" % team_query,
            json={"projects": []},
        )

        responses.add(
            responses.POST,
            "https://api.vercel.com/v1/integrations/webhooks%s" % team_query,
            json={"id": "webhook-id"},
        )

        params = {
            "configurationId": "config_id",
            "code": "oauth-code",
            "next": "https://example.com",
        }
        self.pipeline.bind_state("user_id", self.user.id)
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

        external_id = "my_team_id" if is_team else "my_user_id"
        name = "my_team_name" if is_team else "my_user_name"
        installation_type = "team" if is_team else "user"

        assert integration.external_id == external_id
        assert integration.name == name
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": installation_type,
            "webhook_id": "webhook-id",
        }
        assert OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert SentryAppInstallationForProvider.objects.get(
            organization=self.organization, provider="vercel"
        )

    @responses.activate
    def test_team_flow(self):
        self.assert_setup_flow(is_team=True)

    @responses.activate
    def test_user_flow(self):
        self.assert_setup_flow(is_team=False)

    @responses.activate
    def test_use_existing_installation(self):
        sentry_app = self.create_internal_integration(
            webhook_url=None, name="Vercel Internal Integration", organization=self.organization,
        )
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        SentryAppInstallationForProvider.objects.create(
            organization=self.organization,
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
        # mock org secret
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "sentry_org",
            body=ApiError('The secret "%s" was not found.' % "sentry_org", code=404),
        )
        responses.add(
            responses.POST, "https://api.vercel.com/v2/now/secrets", json={"uid": "sec_123"},
        )
        # mock project secret
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "sentry_project_1",
            body=ApiError('The secret "%s" was not found.' % "sentry_project_1", code=404),
        )
        responses.add(
            responses.POST, "https://api.vercel.com/v2/now/secrets", json={"uid": "sec_456"},
        )
        # mock DSN secret
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "next_public_sentry_dsn_1",
            body=ApiError('The secret "%s" was not found.' % "next_public_sentry_dsn_1", code=404),
        )

        responses.add(
            responses.POST, "https://api.vercel.com/v2/now/secrets", json={"uid": "sec_789"},
        )
        # mock get envs for all
        responses.add(
            responses.GET,
            "https://api.vercel.com/v5/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"envs": [],},
        )
        # mock org env var
        responses.add(
            responses.POST,
            "https://api.vercel.com/v4/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"value": "sec_123", "target": "production", "key": "sentry_org",},
        )
        # mock project env var
        responses.add(
            responses.POST,
            "https://api.vercel.com/v4/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"value": "sec_456", "target": "production", "key": "sentry_project_1",},
        )
        # mock dsn env var
        responses.add(
            responses.POST,
            "https://api.vercel.com/v4/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"value": "sec_789", "target": "production", "key": "next_public_sentry_dsn_1",},
        )

        org = self.organization
        data = {"project_mappings": [[1, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"],]}
        enabled_dsn = ProjectKey.get_default(project=Project.objects.get(id=1)).get_dsn(public=True)
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
        assert org_integration.config == {
            "project_mappings": [[1, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"],]
        }

        assert responses.calls[4].response.code == 404  # check org secret doesnt exist
        assert responses.calls[5].response.status_code == 200  # create org secret
        req_params = json.loads(responses.calls[5].request.body)
        assert req_params["name"] == "SENTRY_ORG"
        assert req_params["value"] == "sentry"

        assert responses.calls[6].response.code == 404  # check project secret doesnt exist
        assert responses.calls[7].response.status_code == 200  # create project secret
        req_params = json.loads(responses.calls[7].request.body)
        assert req_params["name"] == "SENTRY_PROJECT_1"
        assert req_params["value"] == "internal"

        assert responses.calls[8].response.code == 404  # check dsn secret doesnt exist
        assert responses.calls[9].response.status_code == 200  # create dsn secret
        req_params = json.loads(responses.calls[9].request.body)
        assert req_params["name"] == "NEXT_PUBLIC_SENTRY_DSN_1"
        assert req_params["value"] == enabled_dsn

        assert responses.calls[10].response.status_code == 200  # check org env var existence
        assert responses.calls[11].response.status_code == 200  # create org env var
        req_params = json.loads(responses.calls[11].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == "sec_123"
        assert req_params["target"] == "production"

        assert responses.calls[12].response.status_code == 200  # check project env var existence
        assert responses.calls[13].response.status_code == 200  # create project env var
        req_params = json.loads(responses.calls[13].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == "sec_456"
        assert req_params["target"] == "production"

        assert responses.calls[14].response.status_code == 200  # check dsn env var existence
        assert responses.calls[15].response.status_code == 200  # create dsn env var
        req_params = json.loads(responses.calls[15].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == "sec_789"
        assert req_params["target"] == "production"

    @responses.activate
    def test_update_org_config_vars_exist(self):
        """Test the case wherein the secrets and env vars already exist"""

        with self.tasks():
            self.assert_setup_flow()
        # mock org secret already exists
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "sentry_org",
            json={"uid": "sec_123", "name": "sentry_org",},
        )
        # mock project secret already exists
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "sentry_project_1",
            json={"uid": "sec_456", "name": "sentry_org",},
        )
        # mock DSN secret already exists
        responses.add(
            responses.GET,
            "https://api.vercel.com/v3/now/secrets/%s" % "next_public_sentry_dsn_1",
            json={"uid": "sec_789", "name": "sentry_org",},
        )
        # mock get envs for org
        responses.add(
            responses.GET,
            "https://api.vercel.com/v5/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"envs": [{"value": "sec_123", "target": "production", "key": "SENTRY_ORG",}],},
        )
        # mock get envs for project
        responses.add(
            responses.GET,
            "https://api.vercel.com/v5/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={
                "envs": [{"value": "sec_456", "target": "production", "key": "SENTRY_PROJECT",}],
            },
        )
        # mock get envs for dsn
        responses.add(
            responses.GET,
            "https://api.vercel.com/v5/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={
                "envs": [
                    {"value": "sec_789", "target": "production", "key": "NEXT_PUBLIC_SENTRY_DSN",}
                ],
            },
        )

        org = self.organization
        data = {"project_mappings": [[1, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"],]}
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
        assert org_integration.config == {
            "project_mappings": [[1, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"],]
        }
        assert responses.calls[4].response.status_code == 200  # check org secret already exists
        assert responses.calls[5].response.status_code == 200  # check project secret already exists
        assert responses.calls[6].response.status_code == 200  # check dsn secret already exists
        assert responses.calls[7].response.status_code == 200  # check org env var existence
        assert responses.calls[8].response.status_code == 200  # check project env var existence
        assert responses.calls[9].response.status_code == 200  # check dsn env var existence

    @responses.activate
    def test_upgrade_org_config_no_dsn(self):
        """Test that the function doesn't progress if there is no active DSN"""

        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        data = {"project_mappings": [[1, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"],]}
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)

        dsn = ProjectKey.get_default(project=Project.objects.get(id=1))
        dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)
        with self.assertRaises(IntegrationError):
            installation.update_organization_config(data)
