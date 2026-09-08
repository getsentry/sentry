from __future__ import annotations

from typing import Any
from unittest import mock

import orjson
import pytest
import responses
from django.urls import reverse
from rest_framework.serializers import ValidationError

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.identity.vercel.provider import VercelIdentityProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.vercel import VercelClient, VercelIntegrationProvider, metadata
from sentry.integrations.vercel.integration import VercelEnvVarDefinition
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, IntegrationTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    # Vercel Variables
    project_id = "Qme9NXBpguaRxcXssZ1NWHVaM98MAL6PHDXUs1jPrgiM8H"
    team_id = "my_team_id"
    config_id = "my_config_id"

    def install_integration(self, is_team: bool = False) -> Integration:
        """Create an installed Vercel integration the way the pipeline does, for
        tests that exercise the installation rather than the install flow itself
        (which is covered by VercelApiPipelineTest).
        """
        integration = self.create_provider_integration(
            provider="vercel",
            external_id=self.team_id if is_team else "my_user_id",
            name="My Team Name" if is_team else "My Name",
            metadata={
                "access_token": "my_access_token",
                "installation_id": self.config_id,
                "installation_type": "team" if is_team else "user",
            },
        )
        integration.add_organization(self.organization, self.user)
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_organization = serialize_rpc_organization(self.organization)
        VercelIntegrationProvider().post_install(
            integration, rpc_organization, extra={"user_id": self.user.id}
        )
        return integration

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
        with self.tasks():
            self.install_integration()
        # post_install should reuse the existing internal integration
        assert SentryAppInstallation.objects.count() == 1

    @responses.activate
    @with_feature({"organizations:integrations-vercel-upsert-env-var": False})
    def test_update_organization_config(self) -> None:
        """Test that Vercel environment variables are created"""
        with self.tasks():
            self.install_integration()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.CELL):
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
        assert len(responses.calls) == 9

        req_params = orjson.loads(responses.calls[1].request.body)
        assert req_params["key"] == "SENTRY_ORG"
        assert req_params["value"] == org.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[2].request.body)
        assert req_params["key"] == "SENTRY_PROJECT"
        assert req_params["value"] == self.project.slug
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[3].request.body)
        assert req_params["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert req_params["value"] == enabled_dsn
        assert req_params["target"] == ["production", "preview", "development"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[4].request.body)
        assert req_params["key"] == "SENTRY_AUTH_TOKEN"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[5].request.body)
        assert req_params["key"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["value"] == "VERCEL_GIT_COMMIT_SHA"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "system"

        req_params = orjson.loads(responses.calls[6].request.body)
        assert req_params["key"] == "SENTRY_VERCEL_LOG_DRAIN_URL"
        assert req_params["value"] == f"{integration_endpoint}vercel/logs/"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[7].request.body)
        assert req_params["key"] == "SENTRY_OTLP_TRACES_URL"
        assert req_params["value"] == f"{integration_endpoint}otlp/v1/traces"
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

        req_params = orjson.loads(responses.calls[8].request.body)
        assert req_params["key"] == "SENTRY_PUBLIC_KEY"
        assert req_params["value"] == public_key
        assert req_params["target"] == ["production", "preview"]
        assert req_params["type"] == "encrypted"

    @responses.activate
    @with_feature({"organizations:integrations-vercel-upsert-env-var": False})
    def test_update_org_config_vars_exist(self) -> None:
        """Test the case wherein the secret and env vars already exist"""

        with self.tasks():
            self.install_integration()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.CELL):
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

        env_list = responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_ENV_VAR_URL % self.project_id}",
            json={"envs": [{"id": i, "key": key} for i, key in enumerate(env_var_map)]},
        )
        for count, (env_var, details) in enumerate(env_var_map.items()):
            # mock try to create env var
            responses.add(
                responses.POST,
                f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_URL % self.project_id}",
                json={"error": {"code": "ENV_ALREADY_EXISTS"}},
                status=400,
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

        assert len(responses.calls) == 18
        assert env_list.call_count == 1
        patch_calls = [call for call in responses.calls if call.request.method == "PATCH"]
        assert len(patch_calls) == 8
        for call, (key, details) in zip(patch_calls, env_var_map.items(), strict=True):
            assert orjson.loads(call.request.body) == {"key": key, **details}

    @responses.activate
    @with_feature("organizations:integrations-vercel-upsert-env-var")
    def test_update_org_config_vars_exist_with_upsert(self) -> None:
        """Test that env vars are upserted when the feature flag is enabled,
        bypassing the legacy get+patch fallback."""

        with self.tasks():
            self.install_integration()

        org = self.organization
        project_id = self.project.id
        with assume_test_silo_mode(SiloMode.CELL):
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

        for target in ("production", "preview"):
            responses.add(
                responses.POST,
                f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_V10_URL % self.project_id}",
                status=201,
                json={
                    "created": [
                        {"key": key, **details, "target": [target]}
                        for key, details in env_var_map.items()
                    ],
                    "failed": [],
                },
            )
        responses.add(
            responses.POST,
            f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_V10_URL % self.project_id}",
            status=201,
            json={
                "created": [
                    {"key": "SENTRY_DSN", **env_var_map["SENTRY_DSN"], "target": ["development"]}
                ],
                "failed": [],
            },
        )

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

        assert len(responses.calls) == 4
        production, preview, development = responses.calls[1:]
        for call, target in ((production, "production"), (preview, "preview")):
            assert call.request.method == "POST"
            assert "upsert=true" in call.request.url
            assert orjson.loads(call.request.body) == [
                {"key": key, **details, "target": [target]} for key, details in env_var_map.items()
            ]

        assert "upsert=true" in development.request.url
        assert orjson.loads(development.request.body) == [
            {"key": "SENTRY_DSN", **env_var_map["SENTRY_DSN"], "target": ["development"]}
        ]

        # Saved mappings should not trigger any further provisioning requests.
        installation.update_organization_config(data)
        assert len(responses.calls) == 4

    @responses.activate
    @with_feature("organizations:integrations-vercel-upsert-env-var")
    def test_update_org_config_upsert_partial_failure_and_retry(self) -> None:
        with self.tasks():
            integration = self.install_integration(is_team=True)
        installation = integration.get_installation(self.organization.id)
        data = {"project_mappings": [[self.project.id, self.project_id]]}
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECT_URL % self.project_id}",
            json={"framework": "nextjs"},
        )
        env_url = f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_V10_URL % self.project_id}"

        def upsert_success(request):
            return (
                201,
                {},
                orjson.dumps({"created": orjson.loads(request.body), "failed": []}).decode(),
            )

        responses.add_callback(responses.POST, env_url, callback=upsert_success)
        responses.add(
            responses.POST,
            env_url,
            status=201,
            json={
                "created": [{"key": "SENTRY_ORG", "target": ["preview"]}],
                "failed": [
                    {"error": {"code": "ENV_CONFLICT", "message": "Cannot update SENTRY_PROJECT."}},
                    {
                        "error": {
                            "code": "ENV_CONFLICT",
                            "message": "Cannot update NEXT_PUBLIC_SENTRY_DSN.",
                        }
                    },
                ],
            },
        )

        with pytest.raises(ValidationError) as exc_info:
            installation.update_organization_config(data)

        assert exc_info.value.detail == {
            "project_mappings": [
                "Cannot update SENTRY_PROJECT.",
                "Cannot update NEXT_PUBLIC_SENTRY_DSN.",
            ]
        }
        assert len(responses.calls) == 3  # No development batch after preview fails.
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.config == {}

        responses.replace(
            responses.CallbackResponse(responses.POST, env_url, callback=upsert_success)
        )
        installation.update_organization_config(data)

        org_integration.refresh_from_db()
        assert org_integration.config == data
        assert len(responses.calls) == 7
        assert responses.calls[4].request.body == responses.calls[1].request.body
        assert responses.calls[5].request.body == responses.calls[2].request.body
        development = orjson.loads(responses.calls[6].request.body)
        assert len(development) == 1
        assert development[0]["key"] == "NEXT_PUBLIC_SENTRY_DSN"
        assert development[0]["target"] == ["development"]
        for call in responses.calls:
            assert f"teamId={self.team_id}" in call.request.url

    @responses.activate
    @with_feature({"organizations:integrations-vercel-upsert-env-var": False})
    def test_legacy_env_list_is_scoped_to_project_attempt(self) -> None:
        with self.tasks():
            integration = self.install_integration()
        installation = integration.get_installation(self.organization.id)
        client = installation.get_client()
        env_var_map: dict[str, VercelEnvVarDefinition] = {
            "SENTRY_ORG": {
                "value": self.organization.slug,
                "type": "encrypted",
                "target": ["production", "preview"],
            },
            "SENTRY_PROJECT": {
                "value": self.project.slug,
                "type": "encrypted",
                "target": ["production", "preview"],
            },
        }
        for project_id in ("first-project", "second-project", "first-project"):
            env_url = f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_URL % project_id}"
            # A new variable does not require a list lookup.
            responses.add(responses.POST, env_url, status=201, json={"key": "SENTRY_ORG"})
            responses.add(
                responses.POST,
                env_url,
                status=400,
                json={"error": {"code": "ENV_ALREADY_EXISTS"}},
            )
            env_list = responses.add(
                responses.GET,
                env_url,
                json={"envs": [{"id": f"{project_id}-env", "key": "SENTRY_PROJECT"}]},
            )
            update = responses.add(
                responses.PATCH, f"{env_url}/{project_id}-env", json={"key": "SENTRY_PROJECT"}
            )

            installation.create_env_vars(client, project_id, env_var_map)

            assert env_list.call_count == 1
            assert update.call_count == 1
            assert [call.request.method for call in responses.calls[-4:]] == [
                "POST",
                "POST",
                "GET",
                "PATCH",
            ]
            responses.reset()

    @responses.activate
    @with_feature("organizations:integrations-vercel-upsert-env-var")
    def test_update_org_config_upsert_error_response(self) -> None:
        """A failed upsert (e.g. a conflict) fails the request with a non-2xx, which
        we surface as a ValidationError without persisting the mapping."""

        with self.tasks():
            self.install_integration()

        org = self.organization
        project_id = self.project.id

        # mock get_project API call
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECT_URL % self.project_id}",
            json={"link": {"type": "github"}, "framework": "gatsby"},
        )

        conflict_message = (
            "Another Environment Variable with the same Name and Environment "
            "exists in your project."
        )
        # Vercel returns a 403 with the error body when the variable can't be set.
        responses.add(
            responses.POST,
            f"{VercelClient.base_url}{VercelClient.CREATE_ENV_VAR_V10_URL % self.project_id}",
            status=403,
            json={"error": {"code": "ENV_CONFLICT", "message": conflict_message}},
        )

        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(org.id)

        with pytest.raises(ValidationError) as exc_info:
            installation.update_organization_config(data)

        assert exc_info.value.detail == {"project_mappings": [conflict_message]}

        # the mapping should not be persisted when an env var fails
        org_integration = OrganizationIntegration.objects.get(
            organization_id=org.id, integration_id=integration.id
        )
        assert org_integration.config == {}

    @responses.activate
    def test_upgrade_org_config_no_dsn(self) -> None:
        """Test that the function doesn't progress if there is no active DSN"""

        with self.tasks():
            self.install_integration()

        project_id = self.project.id
        org = self.organization
        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.CELL):
            installation = integration.get_installation(org.id)

        with assume_test_silo_mode(SiloMode.CELL):
            dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)
        with pytest.raises(ValidationError):
            installation.update_organization_config(data)

    @responses.activate
    def test_update_organization_config_logs_on_failure(self) -> None:
        """Test that a log is emitted when linking a Sentry project fails."""
        with self.tasks():
            self.install_integration()

        project_id = self.project.id
        org = self.organization
        data = {"project_mappings": [[project_id, self.project_id]]}
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.CELL):
            installation = integration.get_installation(org.id)

        with assume_test_silo_mode(SiloMode.CELL):
            dsn = ProjectKey.get_default(project=Project.objects.get(id=project_id))
            dsn.update(id=dsn.id, status=ProjectKeyStatus.INACTIVE)

        with (
            mock.patch("sentry.integrations.vercel.integration.logger") as mock_logger,
            pytest.raises(ValidationError),
        ):
            installation.update_organization_config(data)

        mock_logger.exception.assert_called_once_with(
            "vercel.link_sentry_project.failed",
            extra={
                "organization_id": org.id,
                "integration_id": integration.id,
                "sentry_project_id": project_id,
                "vercel_project_id": self.project_id,
                "error_type": "ValidationError",
            },
        )

    @responses.activate
    def test_get_dynamic_display_information(self) -> None:
        with self.tasks():
            self.install_integration()
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
            self.install_integration()
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

    @responses.activate
    def test_post_install_missing_user_id(self) -> None:
        with self.tasks():
            self.install_integration()

        integration = Integration.objects.get(provider=self.provider.key)

        # Delete existing installation so post_install takes the creation path
        SentryAppInstallationForProvider.objects.filter(
            organization_id=self.organization.id, provider="vercel"
        ).delete()

        with assume_test_silo_mode(SiloMode.CELL):
            org = serialize_rpc_organization(self.organization)

        with pytest.raises(ValueError, match="user_id is required"):
            VercelIntegrationProvider().post_install(
                integration=integration, organization=org, extra={"user_id": None}
            )


@control_silo_test
class VercelApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    config_id = "my_config_id"
    team_id = "my_team_id"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self, code: str = "oauth-code") -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={
                "action": "initialize",
                "provider": "vercel",
                "initialData": {"code": code},
            },
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _get_pipeline_signature(self, resp: Any) -> str:
        return resp.data["data"]["state"]

    @responses.activate
    @with_feature("organizations:integrations-vercel")
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "oauth_login"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 1
        assert resp.data["provider"] == "vercel"
        # The marketplace already granted the code, so the step signals the
        # frontend to auto-advance -- no authorize popup, no code echoed out.
        assert resp.data["data"]["state"]
        assert "oauthUrl" not in resp.data["data"]
        assert "code" not in resp.data["data"]

    @responses.activate
    @with_feature("organizations:integrations-vercel")
    def test_initialize_requires_code(self) -> None:
        resp = self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "vercel"},
            format="json",
        )
        assert resp.status_code == 400

    @responses.activate
    @with_feature("organizations:integrations-vercel")
    def test_full_pipeline_team_flow(self) -> None:
        responses.add(
            responses.POST,
            VercelIdentityProvider.oauth_access_token_url,
            json={
                "access_token": "my_access_token",
                "user_id": "my_user_id",
                "installation_id": self.config_id,
                "team_id": self.team_id,
            },
        )
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_TEAM_URL % self.team_id}?teamId={self.team_id}",
            json={"name": "My Team Name", "slug": "my_team_slug"},
        )
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECTS_URL}?limit={VercelClient.pagination_limit}&teamId={self.team_id}",
            json={"projects": [], "pagination": {"count": 0, "next": None}},
        )

        resp = self._initialize_pipeline()
        assert resp.data["step"] == "oauth_login"
        pipeline_signature = self._get_pipeline_signature(resp)

        resp = self._advance_step({"code": "oauth-code", "state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="vercel")
        assert integration.external_id == self.team_id
        assert integration.name == "My Team Name"
        assert integration.metadata["access_token"] == "my_access_token"
        assert integration.metadata["installation_id"] == self.config_id
        assert integration.metadata["installation_type"] == "team"
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()

    @responses.activate
    @with_feature("organizations:integrations-vercel")
    def test_full_pipeline_user_flow(self) -> None:
        responses.add(
            responses.POST,
            VercelIdentityProvider.oauth_access_token_url,
            json={
                "access_token": "my_access_token",
                "user_id": "my_user_id",
                "installation_id": self.config_id,
            },
        )
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_USER_URL}",
            json={"user": {"name": "My Name", "username": "my_user_name"}},
        )
        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECTS_URL}?limit={VercelClient.pagination_limit}&",
            json={"projects": [], "pagination": {"count": 0, "next": None}},
        )

        resp = self._initialize_pipeline()
        assert resp.data["step"] == "oauth_login"
        pipeline_signature = self._get_pipeline_signature(resp)

        resp = self._advance_step({"code": "oauth-code", "state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="vercel")
        assert integration.external_id == "my_user_id"
        assert integration.name == "My Name"
        assert integration.metadata["access_token"] == "my_access_token"
        assert integration.metadata["installation_id"] == self.config_id
        assert integration.metadata["installation_type"] == "user"
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
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
