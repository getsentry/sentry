from typing import Any
from unittest import mock
from unittest.mock import patch

import pytest
import responses
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.identity.gitea.provider import GiteaIdentityProvider
from sentry.integrations import manager as integrations
from sentry.integrations.base import IntegrationFeatures, is_provider_enabled
from sentry.integrations.gitea.integration import GiteaIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import EventLifecycleOutcome, IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiPaginationTruncated,
    IntegrationConfigurationError,
)
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_count_of_metric
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.hashlib import sha1_text


class GiteaIntegrationProviderTest(TestCase):
    def test_registered_in_the_default_integrations(self) -> None:
        provider = integrations.get(IntegrationProviderSlug.GITEA.value)
        assert isinstance(provider, GiteaIntegrationProvider)
        assert provider.name == "Gitea"

    def test_features(self) -> None:
        provider = GiteaIntegrationProvider()
        assert provider.has_feature(IntegrationFeatures.COMMITS)
        assert provider.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        assert provider.has_feature(IntegrationFeatures.ISSUE_BASIC)
        # Deferred past the MVP - see the Gitea work plan.
        assert not provider.has_feature(IntegrationFeatures.ISSUE_SYNC)
        assert not provider.has_feature(IntegrationFeatures.CODEOWNERS)

    def test_hidden_without_the_feature_flag(self) -> None:
        provider = GiteaIntegrationProvider()
        assert not is_provider_enabled(provider, self.organization)

    @with_feature("organizations:integrations-gitea")
    def test_visible_with_the_feature_flag(self) -> None:
        provider = GiteaIntegrationProvider()
        assert is_provider_enabled(provider, self.organization)

    def test_needs_default_identity(self) -> None:
        # Gitea has no app-style installation identity: API calls attribute to
        # the authorizing user, so the identity must be kept around.
        assert GiteaIntegrationProvider.needs_default_identity is True


@control_silo_test
@with_feature("organizations:integrations-gitea")
class GiteaIntegrationApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    gitea_url = "https://gitea.example.com"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.client_id = "app-id-abc123"
        self.client_secret = "secret-xyz789"

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "gitea"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _stub_gitea_oauth(self) -> None:
        responses.add(
            responses.POST,
            f"{self.gitea_url}/login/oauth/access_token",
            json={
                "access_token": "test-access-token",
                "token_type": "bearer",
                "expires_in": 3600,
                "refresh_token": "test-refresh-token",
                "scope": "read:repository write:repository read:user",
            },
        )

    def _stub_gitea_user(self, html_url: str | None = None) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/user",
            json={
                "id": 42,
                "login": "sentry-bot",
                "email": "bot@example.com",
                "avatar_url": f"{self.gitea_url}/avatars/42",
                "html_url": html_url if html_url is not None else f"{self.gitea_url}/sentry-bot",
            },
        )

    def _stub_gitea_version(self, version: str = "1.27.1") -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/version",
            json={"version": version},
        )

    def _stub_install(self) -> None:
        self._stub_gitea_oauth()
        self._stub_gitea_user()
        self._stub_gitea_version()

    def _submit_config(self, **overrides: Any) -> Any:
        data: dict[str, Any] = {
            "url": self.gitea_url,
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
        }
        data.update(overrides)
        return self._advance_step(data)

    def _get_pipeline_signature(self, resp: Any) -> str:
        return resp.data["data"]["oauthUrl"].split("state=")[1].split("&")[0]

    def _complete_pipeline(self, **config_overrides: Any) -> Any:
        self._initialize_pipeline()
        resp = self._submit_config(**config_overrides)
        signature = self._get_pipeline_signature(resp)
        return self._advance_step({"code": "gitea-auth-code", "state": signature})

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 2
        assert resp.data["provider"] == "gitea"

    @responses.activate
    def test_config_step_data(self) -> None:
        resp = self._initialize_pipeline()
        setup_values = {v["label"]: v["value"] for v in resp.data["data"]["setupValues"]}
        assert setup_values["Redirect URI"].endswith("/extensions/gitea/setup/")
        assert setup_values["Scopes"] == " ".join(sorted(GiteaIdentityProvider.oauth_scopes))

    @responses.activate
    def test_config_step_validation_missing_required_fields(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"url": self.gitea_url})
        assert resp.status_code == 400
        assert resp.data["clientId"] == ["This field is required."]
        assert resp.data["clientSecret"] == ["This field is required."]

    @responses.activate
    def test_config_step_advance_to_oauth(self) -> None:
        self._initialize_pipeline()
        resp = self._submit_config()
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "oauth_login"
        assert resp.data["stepIndex"] == 1
        oauth_url = resp.data["data"]["oauthUrl"]
        assert oauth_url.startswith(f"{self.gitea_url}/login/oauth/authorize?")
        assert f"client_id={self.client_id}" in oauth_url

    @responses.activate
    def test_config_step_strips_trailing_slash(self) -> None:
        self._initialize_pipeline()
        resp = self._submit_config(url=f"{self.gitea_url}///")
        oauth_url = resp.data["data"]["oauthUrl"]
        assert oauth_url.startswith(f"{self.gitea_url}/login/oauth/authorize?")

    @responses.activate
    def test_oauth_step_invalid_state(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({"code": "abc123", "state": "wrong-state"})
        assert resp.status_code == 400
        assert resp.data["status"] == "error"

    @responses.activate
    def test_oauth_step_missing_code(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({})
        assert resp.status_code == 400
        assert resp.data["code"] == ["This field is required."]
        assert resp.data["state"] == ["This field is required."]

    @responses.activate
    def test_full_pipeline_flow(self) -> None:
        self._stub_install()

        resp = self._complete_pipeline()
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="gitea")
        assert integration.name == "gitea.example.com"
        assert integration.external_id == f"gitea.example.com:{self.client_id}"
        assert integration.metadata["base_url"] == self.gitea_url
        assert integration.metadata["instance"] == "gitea.example.com"
        assert integration.metadata["domain_name"] == "gitea.example.com"
        assert integration.metadata["instance_version"] == "1.27.1"
        assert integration.metadata["verify_ssl"] is True
        assert integration.metadata["scopes"] == sorted(GiteaIdentityProvider.oauth_scopes)
        assert integration.metadata["webhook_secret"]

        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()

    @responses.activate
    def test_full_pipeline_flow_stores_refreshable_identity(self) -> None:
        self._stub_install()
        self._complete_pipeline()

        identity = Identity.objects.get(idp__type=IntegrationProviderSlug.GITEA.value)
        assert identity.external_id == "gitea.example.com:42"
        assert identity.data["access_token"] == "test-access-token"
        # Gitea tokens expire in ~1h, so the refresh credentials have to be
        # stored alongside the token or the integration dies an hour in.
        assert identity.data["refresh_token"] == "test-refresh-token"
        assert identity.data["expires"]
        assert identity.data["client_id"] == self.client_id
        assert identity.data["client_secret"] == self.client_secret

    @responses.activate
    def test_webhook_secret_is_not_derivable(self) -> None:
        """
        The secret is the only thing authenticating a delivery, so it must not
        be computable from public inputs.

        It used to be `sha1(hostname + client_id)`, and neither input is secret
        - the client_id appears in every authorize URL - so anyone who had seen
        one could forge signed deliveries into the org.
        """
        self._stub_install()
        self._complete_pipeline()

        secret = Integration.objects.get(provider="gitea").metadata["webhook_secret"]

        derived = sha1_text("".join(["gitea.example.com", self.client_id])).hexdigest()
        assert secret != derived
        assert len(secret) == 64

    @responses.activate
    def test_webhook_secret_is_preserved_across_reinstalls(self) -> None:
        # Reinstalling with the same OAuth app must reuse the same secret, or
        # every hook already registered keeps signing with one we no longer
        # hold and ingestion stops with nothing surfacing why. Reinstalling to
        # repair a broken token is routine, so this is the common path.
        self._stub_install()
        self._complete_pipeline()
        first_secret = Integration.objects.get(provider="gitea").metadata["webhook_secret"]

        responses.reset()
        self._stub_install()
        self._complete_pipeline()
        second = Integration.objects.get(provider="gitea")

        assert second.metadata["webhook_secret"] == first_secret

    @responses.activate
    def test_webhook_secret_is_preserved_for_a_second_organization(self) -> None:
        """
        Two organizations installing with the same OAuth app land on one
        ``Integration`` row, and the second install must inherit the first's
        secret rather than rotate it - otherwise the first organization's
        already-registered hooks all start failing signature verification.
        """
        self._stub_install()
        self._complete_pipeline()
        first_secret = Integration.objects.get(provider="gitea").metadata["webhook_secret"]

        other_org = self.create_organization(owner=self.user)
        responses.reset()
        self._stub_install()

        pipeline_url = reverse(
            self.endpoint, args=[other_org.slug, IntegrationPipeline.pipeline_name]
        )
        self.client.post(
            pipeline_url, data={"action": "initialize", "provider": "gitea"}, format="json"
        )
        resp = self.client.post(
            pipeline_url,
            data={
                "url": self.gitea_url,
                "clientId": self.client_id,
                "clientSecret": self.client_secret,
            },
            format="json",
        )
        signature = self._get_pipeline_signature(resp)
        resp = self.client.post(
            pipeline_url, data={"code": "gitea-auth-code", "state": signature}, format="json"
        )
        assert resp.data["status"] == "complete"

        assert Integration.objects.get(provider="gitea").metadata["webhook_secret"] == first_secret

    @responses.activate
    def test_webhook_secret_is_preserved_on_a_disabled_row(self) -> None:
        # `ensure_integration` keys on (provider, external_id) alone and revives
        # whatever it finds, so a status-filtered lookup here would mint a new
        # secret and hand it to the very row whose hooks are already registered.
        self._stub_install()
        self._complete_pipeline()
        integration = Integration.objects.get(provider="gitea")
        first_secret = integration.metadata["webhook_secret"]
        integration.update(status=ObjectStatus.DISABLED)

        responses.reset()
        self._stub_install()
        self._complete_pipeline()

        assert Integration.objects.get(provider="gitea").metadata["webhook_secret"] == first_secret

    @responses.activate
    def test_webhook_secret_is_regenerated_when_the_stored_one_is_empty(self) -> None:
        # An empty secret can never authenticate anything, so heal it rather
        # than preserving it.
        self._stub_install()
        self._complete_pipeline()
        integration = Integration.objects.get(provider="gitea")
        integration.update(metadata={**integration.metadata, "webhook_secret": ""})

        responses.reset()
        self._stub_install()
        self._complete_pipeline()

        assert Integration.objects.get(provider="gitea").metadata["webhook_secret"]

    @responses.activate
    def test_separate_oauth_apps_on_one_host_get_separate_integrations(self) -> None:
        # Two customers of the same instance - gitea.com most of all - each
        # register their own OAuth app. Keying the integration on the host
        # alone would collapse them onto one row, and the second install would
        # overwrite the first's webhook_secret, silently killing their hooks.
        self._stub_install()
        self._complete_pipeline()
        first = Integration.objects.get(provider="gitea")

        other_org = self.create_organization(owner=self.user)
        responses.reset()
        self._stub_install()

        pipeline_url = reverse(
            self.endpoint, args=[other_org.slug, IntegrationPipeline.pipeline_name]
        )
        self.client.post(
            pipeline_url, data={"action": "initialize", "provider": "gitea"}, format="json"
        )
        resp = self.client.post(
            pipeline_url,
            data={
                "url": self.gitea_url,
                "clientId": "a-different-app",
                "clientSecret": "a-different-secret",
            },
            format="json",
        )
        signature = self._get_pipeline_signature(resp)
        resp = self.client.post(
            pipeline_url,
            data={"code": "gitea-auth-code", "state": signature},
            format="json",
        )
        assert resp.data["status"] == "complete"

        second = Integration.objects.get(external_id="gitea.example.com:a-different-app")
        assert second.id != first.id

        first.refresh_from_db()
        # Separate rows, so the second install cannot have clobbered the first's
        # secret and orphaned its hooks.
        assert first.metadata["webhook_secret"] != second.metadata["webhook_secret"]

    @responses.activate
    def test_external_id_does_not_collide_across_instances(self) -> None:
        self._stub_install()
        self._complete_pipeline()

        other_url = "https://gitea.other-customer.com"
        responses.reset()
        responses.add(
            responses.POST, f"{other_url}/login/oauth/access_token", json={"access_token": "other"}
        )
        responses.add(
            responses.GET,
            f"{other_url}/api/v1/user",
            json={"id": 42, "login": "sentry-bot", "html_url": f"{other_url}/sentry-bot"},
        )
        responses.add(responses.GET, f"{other_url}/api/v1/version", json={"version": "1.22.0"})

        resp = self._complete_pipeline(url=other_url)
        assert resp.data["status"] == "complete"

        external_ids = set(
            Integration.objects.filter(provider="gitea").values_list("external_id", flat=True)
        )
        assert external_ids == {
            f"gitea.example.com:{self.client_id}",
            f"gitea.other-customer.com:{self.client_id}",
        }

    @responses.activate
    def test_rejects_token_from_a_mismatched_instance(self) -> None:
        self._stub_gitea_oauth()
        self._stub_gitea_user(html_url="https://gitea.someone-else.com/sentry-bot")
        self._stub_gitea_version()

        resp = self._complete_pipeline()
        assert resp.status_code == 400
        assert not Integration.objects.filter(provider="gitea").exists()

    @responses.activate
    def test_install_survives_an_unavailable_version_endpoint(self) -> None:
        self._stub_gitea_oauth()
        self._stub_gitea_user()
        responses.add(responses.GET, f"{self.gitea_url}/api/v1/version", status=404)

        resp = self._complete_pipeline()
        assert resp.data["status"] == "complete"
        assert Integration.objects.get(provider="gitea").metadata["instance_version"] == ""


@control_silo_test
class GiteaRepositoryIntegrationTest(TestCase):
    """The `RepositoryIntegration` surface: repo listing, stacktrace linking
    and the code mappings built on top of them."""

    gitea_url = "https://gitea.example.com"

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider=IntegrationProviderSlug.GITEA.value,
            name="gitea.example.com",
            external_id="gitea.example.com:client-id",
            metadata={
                "instance": "gitea.example.com",
                "domain_name": "gitea.example.com",
                "base_url": self.gitea_url,
                "verify_ssl": True,
                "webhook_secret": "hook-secret",
                "scopes": ["read:repository", "read:user", "write:issue", "write:repository"],
                "instance_version": "1.27.1",
            },
        )
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(
                type=IntegrationProviderSlug.GITEA.value
            ),
            external_id="gitea.example.com:7",
            data={
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "expires": 1234567890,
                "client_id": "client-id",
                "client_secret": "client-secret",
            },
        )
        self.integration.add_organization(self.organization, self.user, self.identity.id)
        self.installation = self.integration.get_installation(self.organization.id)

        self.repo = Repository(
            name="acme/widgets",
            provider="integrations:gitea",
            organization_id=self.organization.id,
            url=f"{self.gitea_url}/acme/widgets",
            config={"instance": "gitea.example.com", "path": "acme/widgets"},
        )

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    @responses.activate
    def test_get_repositories(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 42,
                        "full_name": "acme/widgets",
                        "name": "widgets",
                        "html_url": f"{self.gitea_url}/acme/widgets",
                        "default_branch": "main",
                    }
                ],
            },
        )

        repos = self.installation.get_repositories("widgets")

        assert repos == [
            {
                # Gitea's repository routes are keyed on `owner/name`, so that
                # is what the identifier has to be.
                "identifier": "acme/widgets",
                "name": "acme/widgets",
                "external_id": "gitea.example.com:42",
                "url": f"{self.gitea_url}/acme/widgets",
                "instance": "gitea.example.com",
                "path": "acme/widgets",
                "default_branch": "main",
            }
        ]

    @responses.activate
    def test_get_repositories_scopes_the_search_to_the_installing_user(self) -> None:
        # Without `uid` Gitea searches the whole instance, so on a shared host
        # the customer gets pages of strangers' public repositories and none of
        # their own.
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/search",
            json={"ok": True, "data": []},
        )

        self.installation.get_repositories()

        # The identity was recorded as `gitea.example.com:7` at install time.
        assert "uid=7" in (responses.calls[0].request.url or "")

    @responses.activate
    def test_get_repositories_raises_when_the_page_cap_truncates_the_fetch(self) -> None:
        # The repo sync uses this to tell "there are no more" apart from "we
        # stopped asking" - without it a truncated fetch reads as repositories
        # having disappeared and it disables live ones.
        client = self.installation.get_client()
        full_page = [
            {
                "id": i,
                "full_name": f"acme/repo-{i}",
                "html_url": f"{self.gitea_url}/acme/repo-{i}",
            }
            for i in range(client.page_size)
        ]
        for _ in range(client.page_number_limit):
            responses.add(
                responses.GET,
                f"{self.gitea_url}/api/v1/repos/search",
                json={"ok": True, "data": full_page},
            )

        with pytest.raises(ApiPaginationTruncated) as excinfo:
            self.installation.get_repositories(raise_on_page_limit=True)

        # Partial data comes back as repositories, not raw Gitea payloads,
        # because that is what the sync consumes it as.
        partial = excinfo.value.partial_data
        assert len(partial) == client.page_size * client.page_number_limit
        assert partial[0]["identifier"] == "acme/repo-0"
        assert partial[0]["external_id"] == "gitea.example.com:0"

    @responses.activate
    def test_get_repositories_does_not_raise_on_a_short_final_page(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 42,
                        "full_name": "acme/widgets",
                        "html_url": f"{self.gitea_url}/acme/widgets",
                    }
                ],
            },
        )

        repos = self.installation.get_repositories(raise_on_page_limit=True)

        assert [repo["identifier"] for repo in repos] == ["acme/widgets"]

    @responses.activate
    def test_get_repositories_surfaces_revoked_access_as_a_config_error(self) -> None:
        responses.add(responses.GET, f"{self.gitea_url}/api/v1/repos/search", status=403)

        with pytest.raises(IntegrationConfigurationError):
            self.installation.get_repositories()

    def test_get_repositories_refuses_an_identity_it_cannot_scope_to(self) -> None:
        # An unscoped search would hand back the whole instance rather than the
        # customer's repositories, so this fails loudly instead.
        Identity.objects.filter(id=self.identity.id).update(external_id="gitea.example.com")

        with pytest.raises(IntegrationConfigurationError):
            self.installation.get_repositories()

    def test_source_url_matches(self) -> None:
        assert self.installation.source_url_matches(f"{self.gitea_url}/acme/widgets")
        assert not self.installation.source_url_matches("https://gitea.other.com/acme/widgets")

    def test_source_url_matches_is_scoped_to_a_sub_path_install(self) -> None:
        # A sub-path install shares its host with whatever else is served
        # there, so matching on the hostname alone would over-claim.
        self.integration.metadata["base_url"] = f"{self.gitea_url}/gitea"
        self.integration.save()
        installation = self.integration.get_installation(self.organization.id)

        assert installation.source_url_matches(f"{self.gitea_url}/gitea/acme/widgets")
        assert not installation.source_url_matches(f"{self.gitea_url}/other/acme/widgets")

    def test_format_source_url_for_a_branch(self) -> None:
        assert self.installation.format_source_url(self.repo, "src/app.py", "main") == (
            f"{self.gitea_url}/acme/widgets/src/branch/main/src/app.py"
        )

    def test_format_source_url_for_a_commit(self) -> None:
        # Gitea will not resolve a SHA under `/src/branch/`, and stacktrace
        # linking tries the event's release commit before the default branch.
        sha = "a" * 40
        assert self.installation.format_source_url(self.repo, "src/app.py", sha) == (
            f"{self.gitea_url}/acme/widgets/src/commit/{sha}/src/app.py"
        )

    def test_extract_branch_and_path_from_source_url(self) -> None:
        url = f"{self.gitea_url}/acme/widgets/src/branch/main/src/app.py"

        assert self.installation.extract_branch_from_source_url(self.repo, url) == "main"
        assert self.installation.extract_source_path_from_source_url(self.repo, url) == "src/app.py"

    def test_extract_branch_and_path_from_a_commit_url(self) -> None:
        sha = "a" * 40
        url = f"{self.gitea_url}/acme/widgets/src/commit/{sha}/src/app.py"

        assert self.installation.extract_branch_from_source_url(self.repo, url) == sha
        assert self.installation.extract_source_path_from_source_url(self.repo, url) == "src/app.py"

    def test_extract_from_a_url_that_is_not_a_source_url(self) -> None:
        url = f"{self.gitea_url}/acme/widgets/issues/7"

        assert self.installation.extract_branch_from_source_url(self.repo, url) == ""
        assert self.installation.extract_source_path_from_source_url(self.repo, url) == ""

    @responses.activate
    def test_get_stacktrace_link(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/acme/widgets/contents/src/app.py",
            json={"name": "app.py"},
        )

        link = self.installation.get_stacktrace_link(self.repo, "src/app.py", "main", None)

        assert link == f"{self.gitea_url}/acme/widgets/src/branch/main/src/app.py"

    @responses.activate
    def test_get_stacktrace_link_missing_file(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/acme/widgets/contents/src/app.py",
            status=404,
        )

        assert self.installation.get_stacktrace_link(self.repo, "src/app.py", "main", None) is None

    def test_get_stacktrace_link_for_a_relative_path(self) -> None:
        # Code-mapping source roots are user-editable, so `../` is reachable
        # input. `quote_path` refuses it; that is a link we cannot build, not a
        # server error.
        assert (
            self.installation.get_stacktrace_link(self.repo, "../../../../user", "main", None)
            is None
        )

    @responses.activate
    def test_uninstall_deletes_the_registered_hooks(self) -> None:
        # Uninstalling only clears `integration_id` on Repository rows, so the
        # per-repository teardown never fires and the hooks would keep firing
        # at us with nothing on our side remembering them.
        with assume_test_silo_mode(SiloMode.CELL):
            repo = self.create_repo(
                project=self.create_project(organization=self.organization),
                name="acme/widgets",
                provider="integrations:gitea",
                integration_id=self.integration.id,
            )
            repo.config = {"path": "acme/widgets", "webhook_id": 99}
            repo.save()

        responses.add(
            responses.DELETE, f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99", status=204
        )

        self.installation.uninstall()

        assert responses.calls[0].request.url == (
            f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99"
        )

    @responses.activate
    def test_uninstall_survives_an_unreachable_instance(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = self.create_repo(
                project=self.create_project(organization=self.organization),
                name="acme/widgets",
                provider="integrations:gitea",
                integration_id=self.integration.id,
            )
            repo.config = {"path": "acme/widgets", "webhook_id": 99}
            repo.save()

        responses.add(
            responses.DELETE, f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99", status=500
        )

        self.installation.uninstall()

    @responses.activate
    def test_get_repositories_searches_on_the_bare_name(self) -> None:
        # Callers hand us a repository's `name`, which for Gitea is the full
        # `owner/name`, but Gitea's search matches the bare name - a query with
        # a slash matches nothing, so default-branch resolution and code-mapping
        # lookups would come up empty for repos that are plainly there.
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 42,
                        "full_name": "acme/widgets",
                        "html_url": f"{self.gitea_url}/acme/widgets",
                        "default_branch": "main",
                    }
                ],
            },
        )

        repos = self.installation.get_repositories("acme/widgets")

        assert "q=widgets" in (responses.calls[0].request.url or "")
        assert repos[0]["identifier"] == "acme/widgets"

    @responses.activate
    def test_get_repository_default_branch(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitea_url}/api/v1/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 42,
                        "full_name": "acme/widgets",
                        "html_url": f"{self.gitea_url}/acme/widgets",
                        "default_branch": "main",
                    }
                ],
            },
        )

        assert self.installation.get_repository_default_branch(self.repo) == "main"

    def test_get_repo_external_id(self) -> None:
        assert self.installation.get_repo_external_id({"id": 42}) == "gitea.example.com:42"

    def test_has_repo_access(self) -> None:
        # Only consulted when migrating plugin repositories, and Gitea has no
        # plugin to migrate from.
        assert self.installation.has_repo_access(mock.Mock()) is False

    def test_format_source_url_for_an_abbreviated_commit(self) -> None:
        # `sentry-cli releases set-commits ...@abc1234` is common, the commit
        # id is never format-validated, and `check_file` succeeds either way -
        # so a `/src/branch/abc1234/` link would be reported as working and 404.
        assert self.installation.format_source_url(self.repo, "src/app.py", "abc1234") == (
            f"{self.gitea_url}/acme/widgets/src/commit/abc1234/src/app.py"
        )

    def test_format_source_url_for_a_sha256_commit(self) -> None:
        sha = "b" * 64
        assert self.installation.format_source_url(self.repo, "src/app.py", sha) == (
            f"{self.gitea_url}/acme/widgets/src/commit/{sha}/src/app.py"
        )

    def test_format_source_url_for_a_branch_that_is_not_hex(self) -> None:
        assert self.installation.format_source_url(self.repo, "src/app.py", "release/1.0") == (
            f"{self.gitea_url}/acme/widgets/src/branch/release/1.0/src/app.py"
        )

    def test_extract_branch_and_path_from_a_tag_url(self) -> None:
        url = f"{self.gitea_url}/acme/widgets/src/tag/v1.0/src/app.py"

        assert self.installation.extract_branch_from_source_url(self.repo, url) == "v1.0"
        assert self.installation.extract_source_path_from_source_url(self.repo, url) == "src/app.py"

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_relative_path_is_not_scored_as_an_integration_failure(
        self, mock_record: mock.MagicMock
    ) -> None:
        # A customer's `../src` source root would otherwise record a FAILURE and
        # capture a Sentry error for every frame of every event.
        assert self.installation.check_file(self.repo, "../../../../user", "main") is None

        assert_count_of_metric(mock_record, EventLifecycleOutcome.FAILURE, 0)

    @responses.activate
    def test_uninstall_leaves_another_organizations_repos_alone(self) -> None:
        """
        Two organizations sharing one ``Integration`` row - what installing with
        the same OAuth app produces - must not tear down each other's hooks when
        one of them uninstalls.
        """
        other_org = self.create_organization(owner=self.create_user())
        self.integration.add_organization(other_org)

        with assume_test_silo_mode(SiloMode.CELL):
            mine = self.create_repo(
                project=self.create_project(organization=self.organization),
                name="acme/widgets",
                provider="integrations:gitea",
                integration_id=self.integration.id,
            )
            mine.config = {"path": "acme/widgets", "webhook_id": 99}
            mine.save()

            theirs = self.create_repo(
                project=self.create_project(organization=other_org),
                name="acme/gadgets",
                provider="integrations:gitea",
                integration_id=self.integration.id,
            )
            theirs.config = {"path": "acme/gadgets", "webhook_id": 77}
            theirs.save()

        responses.add(
            responses.DELETE, f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99", status=204
        )

        self.installation.uninstall()

        # Only our organization's hook; the other organization keeps ingesting.
        assert [call.request.url for call in responses.calls] == [
            f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99"
        ]

    @responses.activate
    def test_uninstall_leaves_another_integrations_repos_alone(self) -> None:
        other_integration = self.create_provider_integration(
            provider=IntegrationProviderSlug.GITEA.value,
            name="gitea.example.com",
            external_id="gitea.example.com:other-app",
            metadata={**self.integration.metadata},
        )
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(organization=self.organization)
            mine = self.create_repo(
                project=project,
                name="acme/widgets",
                provider="integrations:gitea",
                integration_id=self.integration.id,
            )
            mine.config = {"path": "acme/widgets", "webhook_id": 99}
            mine.save()

            theirs = self.create_repo(
                project=project,
                name="acme/gadgets",
                provider="integrations:gitea",
                integration_id=other_integration.id,
            )
            theirs.config = {"path": "acme/gadgets", "webhook_id": 77}
            theirs.save()

        responses.add(
            responses.DELETE, f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99", status=204
        )

        self.installation.uninstall()

        assert [call.request.url for call in responses.calls] == [
            f"{self.gitea_url}/api/v1/repos/acme/widgets/hooks/99"
        ]
