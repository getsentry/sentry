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
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils import IntegrationTestCase


class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    def assert_setup_flow(self, is_team=False, multi_config_org=None):
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
        configurations = {
            "my_config_id": {
                "access_token": "my_access_token",
                "webhook_id": "webhook-id",
                "organization_id": self.organization.id,
            }
        }
        if multi_config_org:
            configurations["orig_config_id"] = {
                "access_token": "orig_access_token",
                "webhook_id": "orig-webhook-id",
                "organization_id": multi_config_org.id,
            }
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": installation_type,
            "webhook_id": "webhook-id",
            "configurations": configurations,
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
    def test_install_on_multiple_orgs(self):
        orig_org = self.create_organization()
        metadata = {
            "access_token": "orig_access_token",
            "installation_id": "orig_config_id",
            "installation_type": "team",
            "webhook_id": "orig-webhook-id",
            "configurations": {
                "orig_config_id": {
                    "access_token": "orig_access_token",
                    "webhook_id": "orig-webhook-id",
                    "organization_id": orig_org.id,
                }
            },
        }
        Integration.objects.create(
            provider="vercel", name="my_team_name", external_id="my_team_id", metadata=metadata
        )

        self.assert_setup_flow(is_team=True, multi_config_org=orig_org)

    @responses.activate
    def test_update_organization_config(self):
        """Test that Vercel environment variables are created"""
        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        secret_names = [
            "sentry_org",
            "sentry_project_%s" % project_id,
            "next_public_sentry_dsn_%s" % project_id,
        ]

        for i, name in enumerate(secret_names):
            responses.add(
                responses.GET, "https://api.vercel.com/v3/now/secrets/%s" % name, status=404
            )
            responses.add(
                responses.POST, "https://api.vercel.com/v2/now/secrets", json={"uid": "sec_%s" % i},
            )
        # mock get envs for all
        responses.add(
            responses.GET,
            "https://api.vercel.com/v5/projects/%s/env"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"envs": []},
        )

        for i, name in enumerate(secret_names):
            responses.add(
                responses.POST,
                "https://api.vercel.com/v4/projects/%s/env"
                % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
                json={"value": "sec_%s" % i, "target": "production", "key": name},
            )

        org = self.organization
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
        enabled_dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id)).get_dsn(
            public=True
        )
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
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }

        req_params = json.loads(responses.calls[5].request.body)
        assert req_params["name"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug

        req_params = json.loads(responses.calls[7].request.body)
        assert req_params["name"] == "SENTRY_PROJECT_%s" % project_id
        assert req_params["value"] == self.project.slug

        req_params = json.loads(responses.calls[9].request.body)
        assert req_params["name"] == "NEXT_PUBLIC_SENTRY_DSN_%s" % project_id
        assert req_params["value"] == enabled_dsn

        req_params = json.loads(responses.calls[11].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == "sec_0"
        assert req_params["target"] == "production"

        req_params = json.loads(responses.calls[13].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == "sec_1"
        assert req_params["target"] == "production"

        req_params = json.loads(responses.calls[15].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == "sec_2"
        assert req_params["target"] == "production"

    @responses.activate
    def test_update_org_config_vars_exist(self):
        """Test the case wherein the secrets and env vars already exist"""

        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        secret_names = [
            "sentry_org",
            "sentry_project_%s" % project_id,
            "next_public_sentry_dsn_%s" % project_id,
        ]
        env_var_names = ["SENTRY_ORG", "SENTRY_PROJECT", "NEXT_PUBLIC_SENTRY_DSN"]

        for i, name in enumerate(secret_names):
            responses.add(
                responses.GET,
                "https://api.vercel.com/v3/now/secrets/%s" % name,
                json={"uid": "sec_%s" % i, "name": name},
            )

        for i, env_var_name in enumerate(env_var_names):
            responses.add(
                responses.GET,
                "https://api.vercel.com/v5/projects/%s/env"
                % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
                json={
                    "envs": [{"value": "sec_%s" % i, "target": "production", "key": env_var_name}],
                },
            )

        org = self.organization
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
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
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }

    @responses.activate
    def test_upgrade_org_config_no_dsn(self):
        """Test that the function doesn't progress if there is no active DSN"""

        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        org = self.organization
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)

        dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id))
        dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)
        with self.assertRaises(IntegrationError):
            installation.update_organization_config(data)
