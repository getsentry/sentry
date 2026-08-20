from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, TypedDict
from urllib.parse import urlparse

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import BooleanField, CharField, URLField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.identity.gitea.provider import GiteaIdentityProvider, get_oauth_data, get_user_info
from sentry.identity.oauth2 import OAuth2ApiStep
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.gitea.client import GiteaApiClient, GiteaSetupApiClient
from sentry.integrations.gitea.issues import GiteaIssuesSpec
from sentry.integrations.gitea.repository import GiteaRepositoryProvider
from sentry.integrations.gitea.utils import (
    has_relative_segments,
    parse_gitea_source_url,
    source_ref_segment,
)
from sentry.integrations.models.integration import Integration as IntegrationModel
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repository import (
    RepositoryInfo,
    RepositoryIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.apitoken import generate_token
from sentry.models.repository import Repository
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiPaginationTruncated,
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationError,
)
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.gitea")

# Hook teardown on uninstall runs inline in the request, so it is capped rather
# than left to run as long as the org has repositories. What is left behind is
# the same residue as a repository the customer never re-links: a stale hook,
# visible in Gitea's own settings, whose deliveries get dropped.
UNINSTALL_WEBHOOK_LIMIT = 50

DESCRIPTION = """
Connect your Sentry organization to your Gitea instance, enabling the following features:
"""

FEATURES = [
    FeatureDescription(
        """
        Track commits and releases (learn more
        [here](https://docs.sentry.io/learn/releases/))
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Resolve Sentry issues via Gitea commits and pull requests by including
        `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Gitea source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Gitea issue in any of
        your repositories, providing a quick way to jump from a Sentry bug to
        tracked issue.
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Gitea%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitea",
    aspects={},
)


class GiteaIntegration(RepositoryIntegration[GiteaApiClient], GiteaIssuesSpec):
    """
    Installed-integration behavior for Gitea: repository linking, stacktrace
    linking, the code mappings built on top of them, and creating and linking
    Gitea issues.
    """

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.GITEA.value

    def get_client(self) -> GiteaApiClient:
        try:
            # Eagerly populate this just for the error message: every Gitea API
            # call is made as the authorizing user, so a missing identity means
            # the integration is broken rather than one call failing.
            self.default_identity
        except Identity.DoesNotExist as e:
            raise IntegrationConfigurationError("Identity not found.") from e
        else:
            return GiteaApiClient(self)

    def error_message_from_json(self, data: Mapping[str, Any]) -> str | None:
        """
        Gitea returns ``{"message": ..., "url": ...}`` on API errors.

        See https://docs.gitea.com/api/1.22/
        """
        if "message" in data:
            return data["message"]
        return None

    def uninstall(self) -> None:
        """
        Drop the hooks we registered on the customer's repositories.

        Uninstalling does not delete ``Repository`` rows - it only clears their
        ``integration_id`` (see ``disassociate_organization_integration``) - so
        the per-repository ``on_delete_repository`` teardown never fires here.
        Without this the hooks keep firing at us forever, and nothing on the
        Sentry side remembers they exist. Best-effort: a failure to reach the
        instance must not block the uninstall.
        """
        repos = repository_service.get_repositories(
            organization_id=self.organization_id,
            integration_id=self.model.id,
            providers=[f"integrations:{IntegrationProviderSlug.GITEA.value}"],
        )
        hooked = [
            repo for repo in repos if repo.config.get("webhook_id") and repo.config.get("path")
        ]
        if not hooked:
            return

        # This runs inline in the uninstall request, so the work is bounded:
        # an org with hundreds of repositories on an unreachable instance would
        # otherwise time out the request and never reach the code that actually
        # schedules the deletion.
        if len(hooked) > UNINSTALL_WEBHOOK_LIMIT:
            logger.info(
                "gitea.uninstall.webhook-teardown-truncated",
                extra={
                    "integration_id": self.model.id,
                    "organization_id": self.organization_id,
                    "repository_count": len(hooked),
                    "limit": UNINSTALL_WEBHOOK_LIMIT,
                },
            )
            hooked = hooked[:UNINSTALL_WEBHOOK_LIMIT]

        client = self.get_client()
        for repo in hooked:
            try:
                client.delete_repo_webhook(repo.config["path"], repo.config["webhook_id"])
            except Exception:
                logger.info(
                    "gitea.uninstall.webhook-delete-failure",
                    exc_info=True,
                    extra={
                        "integration_id": self.model.id,
                        "organization_id": self.organization_id,
                        "repository_id": repo.id,
                    },
                )

    # RepositoryIntegration methods

    def has_repo_access(self, repo: RpcRepository) -> bool:
        # Only consulted when migrating plugin repositories onto an
        # integration, which Gitea has no plugin to migrate from.
        return False

    def get_repo_external_id(self, repo: Mapping[str, Any]) -> str:
        instance = self.model.metadata["instance"]
        return f"{instance}:{repo['id']}"

    @property
    def gitea_user_id(self) -> str:
        """
        The authorizing user's numeric Gitea id, which scopes every repository
        listing to them.

        Recorded at install time as the identity's ``{hostname}:{id}`` external
        id, so it costs nothing to read back. Split from the right because a
        hostname can carry a port (``gitea.example.com:3000:42``).
        """
        _, _, user_id = self.default_identity.external_id.rpartition(":")
        if not user_id.isdigit():
            # Nothing sensible to fall back to: an unscoped search would hand
            # back the whole instance rather than the customer's repositories,
            # which is worse than saying so.
            raise IntegrationConfigurationError(
                "Could not determine the Gitea user this integration was installed by. "
                "Reinstall the integration to repair it."
            )
        return user_id

    def get_repositories(
        self,
        query: str | None = None,
        page_number_limit: int | None = None,
        accessible_only: bool = False,
        use_cache: bool = False,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[RepositoryInfo]:
        # Callers hand us a repository's `name`, which for Gitea is the full
        # `owner/name`, but Gitea's search matches the keyword against the bare
        # repository name - a query with a slash in it matches nothing, so
        # default-branch resolution and code-mapping lookups would come up empty
        # for repositories that are plainly there.
        if query and "/" in query:
            query = query.rsplit("/", 1)[-1]

        instance = self.model.metadata["instance"]

        def to_repo_info(raw_repos: list[dict[str, Any]]) -> list[RepositoryInfo]:
            return [
                {
                    # Gitea's repository routes are keyed on `owner/name`
                    # rather than a numeric id, so the identifier is what we
                    # can call the API with directly.
                    "identifier": repo["full_name"],
                    "name": repo["full_name"],
                    "external_id": self.get_repo_external_id(repo),
                    "url": repo["html_url"],
                    "instance": instance,
                    "path": repo["full_name"],
                    "default_branch": repo.get("default_branch"),
                }
                for repo in raw_repos
            ]

        try:
            repos = self.get_client().search_repos(
                query,
                uid=self.gitea_user_id,
                raise_on_page_limit=raise_on_page_limit,
            )
        except ApiPaginationTruncated as e:
            # Re-raised in our own shape: callers that catch this consume
            # `partial_data` as repositories, not as raw Gitea payloads.
            raise ApiPaginationTruncated(to_repo_info(e.partial_data)) from e
        except (ApiForbiddenError, ApiUnauthorized) as e:
            raise IntegrationConfigurationError(self.message_from_error(e)) from e

        return to_repo_info(repos)

    def check_file(self, repo: Repository, filepath: str, branch: str | None = None) -> str | None:
        # Code-mapping source roots are user-editable, so a stack frame can
        # produce a path that climbs out of the repo, which `quote_path`
        # refuses. Screened here rather than caught from below: the base
        # implementation raises from inside its SLO span, so letting it through
        # would score a customer's misconfigured source root as an integration
        # failure and capture an error for every frame of every event.
        if has_relative_segments(filepath):
            return None
        return super().check_file(repo, filepath, branch)

    def source_url_matches(self, url: str) -> bool:
        # Matched against the stored base URL rather than the hostname: a
        # sub-path install shares its host with whatever else is served there.
        base_url = self.model.metadata["base_url"].rstrip("/")
        return url.startswith(f"{base_url}/")

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        base_url = self.model.metadata["base_url"].rstrip("/")
        repo_name = repo.config["path"]

        # Gitea's file URLs name the kind of ref they carry, unlike GitHub's
        # `/blob/{ref}/` which resolves either.
        return f"{base_url}/{repo_name}/src/{source_ref_segment(branch or '')}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        if not repo.url:
            return ""
        branch, _ = parse_gitea_source_url(repo.url, url)
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        if not repo.url:
            return ""
        _, source_path = parse_gitea_source_url(repo.url, url)
        return source_path


class InstallationConfigData(TypedDict):
    url: str
    client_id: str
    client_secret: str
    verify_ssl: bool


class InstallationConfigSerializer(CamelSnakeSerializer[InstallationConfigData]):
    url = URLField(required=True)
    client_id = CharField(required=True)
    client_secret = CharField(required=True)
    # Not collected by the install form today: sentry.io can only reach
    # publicly-served instances, so a valid certificate is the norm. Kept as a
    # field so a GitLab-style toggle is a form change rather than a data change.
    verify_ssl = BooleanField(required=False, default=True)


class InstallationConfigApiStep:
    """
    Collects the Gitea instance URL and the OAuth application credentials the
    customer registered on that instance.

    Gitea has no marketplace or app manifest, so every customer creates their
    own OAuth app; the step data below is the copy they need to fill that form
    in (our exact redirect URI and the scopes to grant).
    """

    step_name = "installation_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {
            "setupValues": [
                {"label": "Application Name", "value": "Sentry"},
                {
                    "label": "Redirect URI",
                    "value": absolute_uri("/extensions/gitea/setup/"),
                },
                {"label": "Scopes", "value": " ".join(sorted(GiteaIdentityProvider.oauth_scopes))},
            ],
        }

    def get_serializer_cls(self) -> type:
        return InstallationConfigSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        # Trailing slashes would double up against the paths we append.
        validated_data["url"] = validated_data["url"].rstrip("/")

        pipeline.bind_state("installation_data", validated_data)
        pipeline.bind_state(
            "oauth_config_information",
            {
                "authorize_url": f"{validated_data['url']}/login/oauth/authorize",
                "access_token_url": f"{validated_data['url']}/login/oauth/access_token",
                "client_id": validated_data["client_id"],
                "client_secret": validated_data["client_secret"],
                "verify_ssl": validated_data["verify_ssl"],
            },
        )

        pipeline.get_logger().info(
            "gitea.setup.installation-config-api-step.success",
            extra={
                "base_url": validated_data["url"],
                "client_id": validated_data["client_id"],
                "verify_ssl": validated_data["verify_ssl"],
            },
        )
        return PipelineStepResult.advance()


class GiteaIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GITEA.value
    name = "Gitea"
    metadata = metadata
    integration_cls = GiteaIntegration

    # Gitea has no GitHub-App-style installation identity: every API action
    # attributes to the authorizing user, so we hang onto their identity.
    needs_default_identity = True

    # Hidden behind `organizations:integrations-gitea` while A2-A6 land.
    requires_feature_flag = True

    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.ISSUE_BASIC,
        ]
    )

    def _make_oauth_api_step(self) -> OAuth2ApiStep:
        """
        The OAuth endpoints live on the customer's own instance, so this step
        can only be built once the config step has bound the URL - hence the
        lazy construction (GitLab precedent).
        """
        oauth_info = self.pipeline._fetch_state("oauth_config_information")
        if oauth_info is None:
            raise AssertionError("pipeline called out of order")
        return OAuth2ApiStep(
            authorize_url=oauth_info["authorize_url"],
            client_id=oauth_info["client_id"],
            client_secret=oauth_info["client_secret"],
            access_token_url=oauth_info["access_token_url"],
            scope=" ".join(sorted(GiteaIdentityProvider.oauth_scopes)),
            redirect_url=absolute_uri("/extensions/gitea/setup/"),
            verify_ssl=oauth_info.get("verify_ssl", True),
            bind_key="oauth_data",
        )

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [
            InstallationConfigApiStep(),
            lambda: self._make_oauth_api_step(),
        ]

    def get_instance_version(self, access_token: str, installation_data: Mapping[str, Any]) -> str:
        """
        Best-effort instance version, recorded so later API-surface decisions
        have something to look at. Never fails the install.
        """
        client = GiteaSetupApiClient(
            base_url=installation_data["url"],
            access_token=access_token,
            verify_ssl=installation_data.get("verify_ssl", True),
        )
        try:
            return client.get_version() or ""
        except ApiError as e:
            self.get_logger().info(
                "gitea.installation.get-version-failure",
                extra={
                    "base_url": installation_data["url"],
                    "error_status": e.code,
                    "error_message": str(e),
                },
            )
            return ""

    @staticmethod
    def ensure_matching_domain(hostname: str, user: Mapping[str, Any]) -> None:
        """
        The authorizing user comes back with an ``html_url`` built from the
        instance's own ``ROOT_URL``. If that host disagrees with the URL the
        installer typed, the token belongs to a different instance than the one
        we are about to record - refuse rather than store a mismatched pair.
        """
        user_url = user.get("html_url")
        if not user_url:
            return

        user_hostname = urlparse(user_url).netloc
        if user_hostname and user_hostname.lower() != hostname.lower():
            raise IntegrationError(
                "The Gitea instance that authorized this installation does not match the URL you provided."
            )

    def webhook_secret(self, external_id: str) -> str:
        """
        The HMAC key Gitea signs webhook deliveries with.

        Random, because it is the only thing authenticating a delivery: it was
        previously derived from the hostname and the OAuth ``client_id``, both
        of which are public (the client_id appears in every authorize URL), so
        anyone who had seen an authorize URL could forge signed deliveries.

        Preserved across reinstalls, because ``ensure_integration`` replaces
        metadata wholesale on an existing row. Rotating here would leave every
        already-registered hook signing with a secret we no longer hold, and
        ingestion would stop with nothing surfacing why. Reinstalling to repair
        a broken token is routine, so this is the common path, not an edge case.
        Same shape as VSTS preserving its subscription (``vsts/integration.py``).

        This read and ``ensure_integration``'s write are not in one transaction,
        so two installs of the same OAuth app completing concurrently can both
        mint a secret and the loser's hooks are orphaned. The window is one
        pipeline completion and the repair is re-linking the repositories, so it
        is left unguarded rather than reaching across into the shared pipeline
        helper.
        """
        # Deliberately *not* filtered on status: `ensure_integration` looks the
        # row up on `(provider, external_id)` alone - which is the unique key -
        # and revives whatever it finds to ACTIVE. Filtering here would miss a
        # disabled row, mint a fresh secret, and then hand it to that very row,
        # orphaning every hook already registered against it.
        try:
            existing = IntegrationModel.objects.get(
                provider=self.key,
                external_id=external_id,
            )
        except IntegrationModel.DoesNotExist:
            return generate_token()

        # An empty stored secret can never authenticate anything, so heal it
        # rather than preserving it.
        return existing.metadata.get("webhook_secret") or generate_token()

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        data = state["oauth_data"]
        installation_data = state["installation_data"]
        oauth_config = state.get("oauth_config_information", {})

        # Gitea access tokens live ~1 hour, so refreshing is the hot path and
        # the credentials it needs travel with the identity.
        oauth_data = {
            **get_oauth_data(data),
            "client_id": oauth_config.get("client_id"),
            "client_secret": oauth_config.get("client_secret"),
        }

        access_token = data["access_token"]
        user = get_user_info(access_token, installation_data)

        base_url = installation_data["url"]
        hostname = urlparse(base_url).netloc
        self.ensure_matching_domain(hostname, user)

        scopes = sorted(GiteaIdentityProvider.oauth_scopes)
        verify_ssl = installation_data.get("verify_ssl", True)
        instance_version = self.get_instance_version(access_token, installation_data)

        # Gitea has no group or app-installation identity to key on, so the
        # OAuth app stands in for one. Keying on the host alone would give
        # every customer of a shared instance - gitea.com above all - the same
        # Integration row, and each new install would overwrite the previous
        # customer's metadata (`ensure_integration` replaces it wholesale),
        # silently breaking their already-registered webhooks. The client_id is
        # not a secret: it appears in every authorize URL.
        external_id = f"{hostname}:{installation_data['client_id']}"

        return {
            "name": hostname,
            "external_id": external_id,
            "metadata": {
                "icon": user.get("avatar_url"),
                "instance": hostname,
                "domain_name": hostname,
                "scopes": scopes,
                "verify_ssl": verify_ssl,
                # The full base URL, sub-path and all - every API and web URL
                # is derived from it.
                "base_url": base_url,
                "webhook_secret": self.webhook_secret(external_id),
                "instance_version": instance_version,
            },
            "user_identity": {
                "type": IntegrationProviderSlug.GITEA.value,
                "external_id": f"{hostname}:{user['id']}",
                "scopes": scopes,
                "data": oauth_data,
            },
            "post_install_data": {
                "redirect_url_format": absolute_uri(
                    f"/settings/{{org_slug}}/integrations/{self.key}/"
                ),
            },
        }

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GiteaRepositoryProvider, id="integrations:gitea"
        )
