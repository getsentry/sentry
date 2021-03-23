import responses

from rest_framework.serializers import ValidationError


from urllib.parse import parse_qs
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
from sentry.testutils import IntegrationTestCase
from sentry.utils import json
from sentry.utils.compat.mock import patch
from sentry.utils.http import absolute_uri


class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    def assert_setup_flow(self, is_team=False, multi_config_org=None, no_name=False):
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
                json={"name": "My Team Name", "slug": "my_team_slug"},
            )
        else:
            team_query = ""
            name = None if no_name else "My Name"
            responses.add(
                responses.GET,
                "https://api.vercel.com/www/user",
                json={"user": {"name": name, "username": "my_user_name"}},
            )

        responses.add(
            responses.POST, "https://api.vercel.com/v2/oauth/access_token", json=access_json
        )

        responses.add(
            responses.GET,
            "https://api.vercel.com/v4/projects/%s" % team_query,
            json={"projects": [], "pagination": {"count": 0}},
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

        external_id = "my_team_id" if is_team else "my_user_id"
        name = "My Team Name" if is_team else "my_user_name" if no_name else "My Name"
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
            provider="vercel", name="My Team Name", external_id="my_team_id", metadata=metadata
        )

        self.assert_setup_flow(is_team=True, multi_config_org=orig_org)

    @responses.activate
    def test_update_organization_config(self):
        """Test that Vercel environment variables are created"""
        with self.tasks():
            self.assert_setup_flow()

        uuid = self.get_mock_uuid().hex
        org = self.organization
        project_id = self.project.id
        enabled_dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id)).get_dsn(
            public=True
        )
        sentry_auth_token = SentryAppInstallationForProvider.objects.get(
            organization=org.id, provider="vercel"
        )
        sentry_auth_token = sentry_auth_token.sentry_app_installation.api_token.token

        env_var_map = {
            "SENTRY_ORG": {"type": "plain", "value": org.slug},
            "SENTRY_PROJECT": {"type": "plain", "value": self.project.slug},
            "SENTRY_DSN": {"type": "plain", "value": enabled_dsn},
            "SENTRY_AUTH_TOKEN": {"type": "secret", "value": "sec_0"},
            "VERCEL_GIT_COMMIT_SHA": {"type": "system", "value": "VERCEL_GIT_COMMIT_SHA"},
        }

        # mock get_project API call
        responses.add(
            responses.GET,
            "https://api.vercel.com/v1/projects/%s"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"link": {"type": "github"}, "framework": "nextjs"},
        )

        # mock create the env vars
        for env_var, details in env_var_map.items():
            if details["type"] == "secret":
                # mock create the secret for the auth token
                responses.add(
                    responses.POST,
                    "https://api.vercel.com/v2/now/secrets",
                    json={"uid": "sec_0"},
                )
            responses.add(
                responses.POST,
                "https://api.vercel.com/v6/projects/%s/env"
                % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
                json={
                    "key": env_var,
                    "value": details["value"],
                    "target": ["production"],
                    "type": details["type"],
                },
            )

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {}
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
        with patch("sentry.integrations.vercel.integration.uuid4", new=self.get_mock_uuid()):
            installation.update_organization_config(data)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }

        # assert the secret was created correctly
        req_params = json.loads(responses.calls[9].request.body)
        assert req_params["name"] == "SENTRY_AUTH_TOKEN_%s" % uuid
        assert req_params["value"] == sentry_auth_token

        # assert the env vars were created correctly
        req_params = json.loads(responses.calls[6].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[7].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[8].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[10].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["value"] == "sec_0"
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "secret"

        req_params = json.loads(responses.calls[11].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production"]
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

        env_var_map = {
            "SENTRY_ORG": {"type": "plain", "value": org.slug},
            "SENTRY_PROJECT": {"type": "plain", "value": self.project.slug},
            "SENTRY_DSN": {"type": "plain", "value": enabled_dsn},
            "SENTRY_AUTH_TOKEN": {"type": "secret", "value": "sec_0"},
            "VERCEL_GIT_COMMIT_SHA": {"type": "system", "value": "VERCEL_GIT_COMMIT_SHA"},
        }

        # mock get_project API call
        responses.add(
            responses.GET,
            "https://api.vercel.com/v1/projects/%s"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={"link": {"type": "github"}, "framework": "gatsby"},
        )

        # mock update env vars
        count = 0
        for env_var, details in env_var_map.items():
            if details["type"] == "secret":
                # mock create the secret for the auth token
                responses.add(
                    responses.POST,
                    "https://api.vercel.com/v2/now/secrets",
                    json={"uid": "sec_0"},
                )
            # mock try to create env var
            responses.add(
                responses.POST,
                "https://api.vercel.com/v6/projects/%s/env"
                % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
                json={"error": {"code": "ENV_ALREADY_EXISTS"}},
                status=400,
            )
            # mock get env var
            responses.add(
                responses.GET,
                "https://api.vercel.com/v6/projects/%s/env"
                % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
                json={"envs": [{"id": count, "key": env_var}]},
            )
            # mock update env var
            responses.add(
                responses.PATCH,
                "https://api.vercel.com/v6/projects/%s/env/%s"
                % ("Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H", count),
                json={
                    "key": env_var,
                    "value": details["value"],
                    "target": ["production"],
                    "type": details["type"],
                },
            )
            count += 1

        sentry_auth_token = SentryAppInstallationForProvider.objects.get(
            organization=org.id, provider="vercel"
        )
        sentry_auth_token = sentry_auth_token.sentry_app_installation.api_token.token
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {}
        with patch("sentry.integrations.vercel.integration.uuid4", new=self.get_mock_uuid()):
            installation.update_organization_config(data)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }

        req_params = json.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[9].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[14].request.body)
        assert req_params["key"] == "SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "plain"

        req_params = json.loads(responses.calls[18].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["value"] == "sec_0"
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "secret"

        req_params = json.loads(responses.calls[19].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production"]
        assert req_params["type"] == "system"

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
        with self.assertRaises(ValidationError):
            installation.update_organization_config(data)

    @responses.activate
    def test_upgrade_org_config_no_source_code_provider(self):
        """Test that the function doesn't progress if the Vercel project hasn't been connected to a Git repository"""

        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        org = self.organization
        data = {
            "project_mappings": [[project_id, "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"]]
        }
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)

        responses.add(
            responses.GET,
            "https://api.vercel.com/v1/projects/%s"
            % "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H",
            json={},
        )
        with self.assertRaises(ValidationError):
            installation.update_organization_config(data)

    @responses.activate
    def test_ui_hook_options(self):
        """Test that the response to the UI hook CORS pre-flight OPTIONS request is handled correctly"""

        uihook_url = "/extensions/vercel/ui-hook/"
        resp = self.client.options(path=uihook_url)
        assert resp.status_code == 200

    @responses.activate
    def test_ui_hook_post(self):
        """Test that the response to the UI hook POST request is handled correctly"""

        uihook_url = "/extensions/vercel/ui-hook/"
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        integration.update(
            external_id="hIwec0PQ34UDEma7XmhCRQ3x",
            metadata={
                "configurations": {
                    "icfg_Gdv8qI5s0h3T3xeLZvifuhCb": {"organization_id": self.organization.id}
                }
            },
        )

        data = b'{"configurationId":"icfg_Gdv8qI5s0h3T3xeLZvifuhCb", "teamId":{}, "user":{"id":"hIwec0PQ34UDEma7XmhCRQ3x"}}'

        resp = self.client.post(path=uihook_url, data=data, content_type="application/json")
        assert resp.status_code == 200
        assert (
            absolute_uri(
                f"/settings/{self.organization.slug}/integrations/vercel/{integration.id}/"
            ).encode("utf-8")
            in resp.content
        )

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
                "https://api.vercel.com/v1/integrations/configuration/my_config_id",
                json={},
            )

            integration = Integration.objects.get(provider=self.provider.key)
            path = f"/api/0/organizations/{self.organization.slug}/integrations/{integration.id}/"
            response = self.client.delete(path, format="json")
            assert response.status_code == 204

        # deleting the integration only happens when we get the Vercel webhook
        integration = Integration.objects.get(provider=self.provider.key)
        assert not OrganizationIntegration.objects.filter(integration_id=integration.id).exists()
