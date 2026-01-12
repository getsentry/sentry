from urllib.parse import parse_qs

import orjson
import pytest
import responses
from rest_framework.serializers import ValidationError

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.identity.vercel.provider import VercelIdentityProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.vercel import VercelClient, VercelIntegrationProvider, metadata
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


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
    def test_team_flow(self) -> None:
        self.assert_setup_flow(is_team=True)

    @responses.activate
    def test_user_flow(self) -> None:
        self.assert_setup_flow(is_team=False)

    @responses.activate
    def test_no_name(self) -> None:
        self.assert_setup_flow(no_name=True)

    @responses.activate
    def test_use_existing_installation(self) -> None:
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
    def test_update_organization_config(self) -> None:
        """Test that Vercel environment variables are created"""
        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.REGION):
            project_key = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            enabled_dsn = project_key.get_dsn(public=True)
            integration_endpoint = project_key.integration_endpoint
            public_key = project_key.public_key
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
            "SENTRY_VERCEL_LOG_DRAIN_URL": {
                "type": "encrypted",
                "value": f"{integration_endpoint}vercel/logs/",
                "target": ["production", "preview"],
            },
            "SENTRY_OTLP_TRACES_URL": {
                "type": "encrypted",
                "value": f"{integration_endpoint}otlp/v1/traces",
                "target": ["production", "preview"],
            },
            "SENTRY_PUBLIC_KEY": {
                "type": "encrypted",
                "value": public_key,
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
        req_params = orjson.loads(responses.calls[5].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[6].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[7].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production", "preview", "development"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[9].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "system"

        req_params = orjson.loads(responses.calls[10].request.body)
        assert req_params["key"] == "SENTRY_VERCEL_LOG_DRAIN_URL"
        assert req_params["value"] == f"{integration_endpoint}vercel/logs/"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[11].request.body)
        assert req_params["key"] == "SENTRY_OTLP_TRACES_URL"
        assert req_params["value"] == f"{integration_endpoint}otlp/v1/traces"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[12].request.body)
        assert req_params["key"] == "SENTRY_PUBLIC_KEY"
        assert req_params["value"] == public_key
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

    @responses.activate
    def test_update_org_config_vars_exist(self) -> None:
        """Test the case wherein the secret and env vars already exist"""

        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.REGION):
            project_key = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            enabled_dsn = project_key.get_dsn(public=True)
            integration_endpoint = project_key.integration_endpoint
            public_key = project_key.public_key

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
            "SENTRY_VERCEL_LOG_DRAIN_URL": {
                "type": "encrypted",
                "value": f"{integration_endpoint}vercel/logs/",
                "target": ["production", "preview"],
            },
            "SENTRY_OTLP_TRACES_URL": {
                "type": "encrypted",
                "value": f"{integration_endpoint}otlp/v1/traces",
                "target": ["production", "preview"],
            },
            "SENTRY_PUBLIC_KEY": {
                "type": "encrypted",
                "value": public_key,
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

        req_params = orjson.loads(responses.calls[5].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[11].request.body)
        assert req_params["key"] == "SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production", "preview", "development"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[14].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[17].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "system"

        req_params = orjson.loads(responses.calls[20].request.body)
        assert req_params["key"] == "SENTRY_VERCEL_LOG_DRAIN_URL"
        assert req_params["value"] == f"{integration_endpoint}vercel/logs/"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[23].request.body)
        assert req_params["key"] == "SENTRY_OTLP_TRACES_URL"
        assert req_params["value"] == f"{integration_endpoint}otlp/v1/traces"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[26].request.body)
        assert req_params["key"] == "SENTRY_PUBLIC_KEY"
        assert req_params["value"] == public_key
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

    @responses.activate
    def test_upgrade_org_config_no_dsn(self) -> None:
        """Test that the function doesn't progress if there is no active DSN"""

        with self.tasks():
            self.assert_setup_flow()

        project_id = self.project.id
        org = self.organization
        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            installation = integration.get_installation(org.id)

        with assume_test_silo_mode(SiloMode.REGION):
            dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)
        with pytest.raises(ValidationError):
            installation.update_organization_config(data)

    @responses.activate
    def test_get_dynamic_display_information(self) -> None:
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
        dynamic_display_info = installation.get_dynamic_display_information()
        assert dynamic_display_info is not None
        instructions = dynamic_display_info["configure_integration"]["instructions"]
        assert len(instructions) == 1
        assert "configure your repositories." in instructions[0]

    @responses.activate
    def test_uninstall(self) -> None:
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


class VercelIntegrationMetadataTest(TestCase):

    def test_asdict(self) -> None:
        assert metadata.asdict() == {
            "description": "Vercel is an all-in-one platform with Global CDN supporting static & JAMstack deployment and Serverless Functions.",
            "features": [
                {
                    "description": "Connect your Sentry and Vercel projects to automatically upload source maps and notify Sentry of new releases being deployed.",
                    "featureGate": "integrations-deployment",
                }
            ],
            "author": "The Sentry Team",
            "noun": "Installation",
            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Vercel%20Integration%20Problem",
            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel",
            "aspects": {
                "configure_integration": {"title": "Connect Your Projects"},
                "externalInstall": {
                    "url": "https://vercel.com/integrations/sentry/add",
                    "buttonText": "Vercel Marketplace",
                    "noticeText": "Visit the Vercel Marketplace to install this integration. After installing the Sentry integration, you'll be redirected back to Sentry to finish syncing Vercel and Sentry projects.",
                },
            },
        }

    @responses.activate
    def test_update_organization_config_with_deleted_token(self) -> None:
        """Test that Vercel integration handles deleted API tokens gracefully"""
        with self.tasks():
            self.assert_setup_flow()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.REGION):
            project_key = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            enabled_dsn = project_key.get_dsn(public=True)
            integration_endpoint = project_key.integration_endpoint
            public_key = project_key.public_key

        # Delete the API token to simulate the issue
        sentry_app_installation = SentryAppInstallationForProvider.objects.get(
            organization_id=org.id, provider="vercel"
        ).sentry_app_installation
        sentry_app_installation_token = SentryAppInstallationToken.objects.get(
            sentry_app_installation=sentry_app_installation
        )
        api_token = sentry_app_installation_token.api_token
        api_token.delete()

        # Verify that get_token returns None after deletion
        sentry_auth_token = SentryAppInstallationToken.objects.get_token(org.id, "vercel")
        assert sentry_auth_token is None

        # mock get_project API call
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECT_URL % self.project_id}",
            json={"link": {"type": "github"}, "framework": "nextjs"},
        )

        # mock create the env vars - note that SENTRY_AUTH_TOKEN should be skipped
        expected_env_vars = [
            "SENTRY_ORG",
            "SENTRY_PROJECT",
            "NEXT_PUBLIC_SENTRY_DSN",
            "VERCEL_GIT_COMMIT_SHA",
            "SENTRY_VERCEL_LOG_DRAIN_URL",
            "SENTRY_OTLP_TRACES_URL",
            "SENTRY_PUBLIC_KEY",
        ]
        for env_var in expected_env_vars:
            responses.add(
                responses.POST,
                f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_URL % self.project_id}",
                json={"key": env_var, "value": "dummy"},
            )

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)
        data = {"project_mappings": [[project_id, self.project_id]]}

        # This should not raise an error even though the token is deleted
        installation.update_organization_config(data)

        # Verify that SENTRY_AUTH_TOKEN was not sent to Vercel API
        sent_env_vars = []
        for call in responses.calls[1:]:  # Skip the first call (get_project)
            if call.request.method == "POST" and "env" in call.request.url:
                body = orjson.loads(call.request.body)
                sent_env_vars.append(body["key"])

        assert "SENTRY_AUTH_TOKEN" not in sent_env_vars
        assert set(expected_env_vars) == set(sent_env_vars)
