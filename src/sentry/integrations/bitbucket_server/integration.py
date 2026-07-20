from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict
from urllib.parse import parse_qs, quote, urlencode, urlparse

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.fields import BooleanField, CharField, URLField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repository import (
    HaltReason,
    RepositoryInfo,
    RepositoryIntegration,
)
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.users.models.identity import Identity

from .client import BitbucketServerClient, BitbucketServerSetupClient
from .repository import BitbucketServerRepositoryProvider

DESCRIPTION = """
Connect your Sentry organization to Bitbucket Server, enabling the following features:
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
        Resolve Sentry issues via Bitbucket Server commits by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Bitbucket Server source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Import your Bitbucket Server [CODEOWNERS file](https://support.atlassian.com/bitbucket-cloud/docs/set-up-and-use-code-owners/) and use it alongside your ownership rules to assign Sentry issues.
        """,
        IntegrationFeatures.CODEOWNERS,
    ),
]

setup_alert = {
    "type": "warning",
    "icon": "icon-warning-sm",
    "text": "Your Bitbucket Server instance must be able to communicate with Sentry."
    " Sentry makes outbound requests from a [static set of IP"
    " addresses](https://docs.sentry.io/ip-ranges/) that you may wish"
    " to explicitly allow in your firewall to support this integration.",
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Bitbucket%20Server%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket_server",
    aspects={},
)


class InstallationConfigData(TypedDict):
    url: str
    consumer_key: str
    private_key: str
    verify_ssl: bool


class InstallationConfigSerializer(CamelSnakeSerializer[InstallationConfigData]):
    url = URLField(required=True)
    consumer_key = CharField(required=True, max_length=200)
    private_key = CharField(required=True)
    verify_ssl = BooleanField(required=False, default=True)

    def validate_private_key(self, value: str) -> str:
        try:
            load_pem_private_key(value.encode("utf-8"), None, default_backend())
        except Exception:
            raise serializers.ValidationError(
                "Private key must be a valid SSH private key encoded in a PEM format."
            )
        return value


class InstallationConfigApiStep:
    """
    Collect Bitbucket Server consumer credentials and verify them by fetching an
    OAuth 1.0a request token. The token is stored on pipeline state so the next
    step can build an authorize URL and exchange it for an access token.
    """

    step_name = "installation_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return InstallationConfigSerializer

    def handle_post(
        self,
        validated_data: InstallationConfigData,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        validated_data["url"] = validated_data["url"].rstrip("/")

        client = BitbucketServerSetupClient(
            validated_data["url"],
            validated_data["consumer_key"],
            validated_data["private_key"],
            validated_data["verify_ssl"],
        )

        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.OAUTH_LOGIN,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            BitbucketServerIntegrationProvider.key,
        ).capture() as lifecycle:
            try:
                request_token = client.get_request_token()
            except ApiError as error:
                lifecycle.record_failure(str(error), extra={"url": validated_data["url"]})
                return PipelineStepResult.error(
                    f"Could not fetch a request token from Bitbucket. {error}"
                )

            if not request_token.get("oauth_token") or not request_token.get("oauth_token_secret"):
                lifecycle.record_failure(
                    "missing oauth_token", extra={"url": validated_data["url"]}
                )
                return PipelineStepResult.error("Missing oauth_token")

        pipeline.bind_state("installation_data", validated_data)
        pipeline.bind_state("request_token", request_token)
        return PipelineStepResult.advance()


class OAuthCallbackData(TypedDict):
    oauth_token: str


class OAuthCallbackSerializer(CamelSnakeSerializer[OAuthCallbackData]):
    oauth_token = CharField(required=True)


class OAuthStepData(TypedDict):
    oauthUrl: str


class OAuthApiStep:
    """
    Build the Bitbucket Server authorize URL from the previously-fetched request
    token, then exchange the callback's oauth_token (which Bitbucket Server uses
    as the verifier) for an access token.
    """

    step_name = "oauth_callback"

    def _client(self, pipeline: IntegrationPipeline) -> BitbucketServerSetupClient:
        installation = pipeline.fetch_state("installation_data")
        if installation is None:
            raise AssertionError("pipeline called out of order")
        return BitbucketServerSetupClient(
            installation["url"],
            installation["consumer_key"],
            installation["private_key"],
            installation["verify_ssl"],
        )

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> OAuthStepData:
        request_token = pipeline.fetch_state("request_token")
        if request_token is None:
            raise AssertionError("pipeline called out of order")
        return {"oauthUrl": self._client(pipeline).get_authorize_url(request_token)}

    def get_serializer_cls(self) -> type:
        return OAuthCallbackSerializer

    def handle_post(
        self,
        validated_data: OAuthCallbackData,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        request_token = pipeline.fetch_state("request_token")
        if request_token is None:
            raise AssertionError("pipeline called out of order")

        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.OAUTH_CALLBACK,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            BitbucketServerIntegrationProvider.key,
        ).capture() as lifecycle:
            try:
                access_token = self._client(pipeline).get_access_token(
                    request_token, validated_data["oauth_token"]
                )
            except ApiError as error:
                lifecycle.record_failure(str(error))
                return PipelineStepResult.error(
                    f"Could not fetch an access token from Bitbucket. {error}"
                )

        pipeline.bind_state("access_token", access_token)
        return PipelineStepResult.advance()


class BitbucketServerIntegration(RepositoryIntegration[BitbucketServerClient]):
    """
    IntegrationInstallation implementation for Bitbucket Server
    """

    codeowners_locations = [".bitbucket/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.BITBUCKET_SERVER.value

    def get_client(self) -> BitbucketServerClient:
        try:
            return BitbucketServerClient(
                integration=self.model,
                identity=self.default_identity,
            )
        except Identity.DoesNotExist:
            raise IntegrationError("Identity not found.")

    # IntegrationInstallation methods

    def error_message_from_json(self, data):
        return data.get("error", {}).get("message", "unknown error")

    def is_broken_integration_error(self, exc: Exception) -> HaltReason | None:
        if isinstance(exc, ApiError):
            if exc.code == 403:
                return "unauthorized"
            if exc.code == 404:
                return "configuration_error"
        return super().is_broken_integration_error(exc)

    # RepositoryIntegration methods

    def get_repositories(
        self,
        query: str | None = None,
        page_number_limit: int | None = None,
        accessible_only: bool = False,
        use_cache: bool = False,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[RepositoryInfo]:
        if not query:
            resp = self.get_client().get_repos()

            return [
                {
                    "identifier": repo["project"]["key"] + "/" + repo["slug"],
                    "external_id": self.get_repo_external_id(repo),
                    "project": repo["project"]["key"],
                    "repo": repo["slug"],
                    "name": repo["project"]["name"] + "/" + repo["name"],
                }
                for repo in resp.get("values", [])
            ]

        resp = self.get_client().search_repositories(query)

        return [
            {
                "identifier": repo["project"]["key"] + "/" + repo["slug"],
                "external_id": self.get_repo_external_id(repo),
                "project": repo["project"]["key"],
                "repo": repo["slug"],
                "name": repo["project"]["name"] + "/" + repo["name"],
            }
            for repo in resp.get("values", [])
        ]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        """
        We can assume user always has repo access, since the Bitbucket API is limiting the results based on the REPO_ADMIN permission
        """

        return True

    def source_url_matches(self, url: str) -> bool:
        return url.startswith(self.model.metadata["base_url"])

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        project = quote(repo.config["project"])
        repo_name = quote(repo.config["repo"])
        source_url = f"{self.model.metadata['base_url']}/projects/{project}/repos/{repo_name}/browse/{filepath}"

        if branch:
            source_url += "?" + urlencode({"at": branch})

        return source_url

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        parsed_url = urlparse(url)
        qs = parse_qs(parsed_url.query)

        if "at" in qs and len(qs["at"]) == 1:
            branch = qs["at"][0]

            # branch name may be prefixed with refs/heads/, so we strip that
            refs_prefix = "refs/heads/"
            if branch.startswith(refs_prefix):
                branch = branch[len(refs_prefix) :]

            return branch

        return ""

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        if repo.url is None:
            return ""
        parsed_repo_url = urlparse(repo.url)
        parsed_url = urlparse(url)
        return parsed_url.path.replace(parsed_repo_url.path + "/", "")

    # Bitbucket Server only methods

    @property
    def username(self):
        return self.model.name


class BitbucketServerIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.BITBUCKET_SERVER.value
    name = "Bitbucket Server"
    metadata = metadata
    integration_cls = BitbucketServerIntegration
    needs_default_identity = True
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [InstallationConfigApiStep(), OAuthApiStep()]

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        repos = repository_service.get_repositories(
            organization_id=organization.id,
            providers=[
                IntegrationProviderSlug.BITBUCKET_SERVER.value,
                f"integrations:{IntegrationProviderSlug.BITBUCKET_SERVER.value}",
            ],
            has_integration=False,
        )

        for repo in repos:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo.id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        install = state["installation_data"]
        access_token = state["access_token"]

        hostname = urlparse(install["url"]).netloc
        external_id = "{}:{}".format(hostname, install["consumer_key"])[:64]

        credentials = {
            "consumer_key": install["consumer_key"],
            "private_key": install["private_key"],
            "access_token": access_token["oauth_token"],
            "access_token_secret": access_token["oauth_token_secret"],
        }

        return {
            "name": install["consumer_key"],
            "provider": self.key,
            "external_id": external_id,
            "metadata": {
                "base_url": install["url"],
                "domain_name": hostname,
                "verify_ssl": install["verify_ssl"],
            },
            "user_identity": {
                "type": self.key,
                "external_id": external_id,
                "data": credentials,
                "scopes": [],
            },
        }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            BitbucketServerRepositoryProvider,
            id=f"integrations:{self.key}",
        )
