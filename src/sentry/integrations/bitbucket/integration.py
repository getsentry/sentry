from __future__ import annotations

from typing import Any

from django.utils.datastructures import OrderedSet
from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.repository import RpcRepository, repository_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.models.apitoken import generate_token
from sentry.models.repository import Repository
from sentry.organizations.services.organization import RpcOrganizationSummary
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri

from .client import BitbucketApiClient
from .issues import BitbucketIssuesSpec
from .repository import BitbucketRepositoryProvider

DESCRIPTION = """
Connect your Sentry organization to Bitbucket, enabling the following features:
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
        Resolve Sentry issues via Bitbucket commits by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create Bitbucket issues from Sentry
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link Sentry issues to existing Bitbucket issues
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Bitbucket source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Bitbucket%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket",
    aspects={},
)
# see https://developer.atlassian.com/bitbucket/api/2/reference/meta/authentication#scopes-bbc
scopes = ("issue:write", "pullrequest", "webhook", "repository")


class BitbucketIntegration(RepositoryIntegration, BitbucketIssuesSpec):
    @property
    def integration_name(self) -> str:
        return "bitbucket"

    def get_client(self):
        return BitbucketApiClient(integration=self.model)

    # IntegrationInstallation methods

    def error_message_from_json(self, data):
        return data.get("error", {}).get("message", "unknown error")

    # RepositoryIntegration methods

    def get_repositories(self, query: str | None = None) -> list[dict[str, Any]]:
        username = self.model.metadata.get("uuid", self.username)
        if not query:
            resp = self.get_client().get_repos(username)
            return [
                {"identifier": repo["full_name"], "name": repo["full_name"]}
                for repo in resp.get("values", [])
            ]

        exact_query = f'name="{query}"'
        fuzzy_query = f'name~"{query}"'
        exact_search_resp = self.get_client().search_repositories(username, exact_query)
        fuzzy_search_resp = self.get_client().search_repositories(username, fuzzy_query)

        result: OrderedSet[str] = OrderedSet()

        for j in exact_search_resp.get("values", []):
            result.add(j["full_name"])

        for i in fuzzy_search_resp.get("values", []):
            result.add(i["full_name"])

        return [{"identifier": full_name, "name": full_name} for full_name in result]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        client = self.get_client()
        try:
            client.get_hooks(repo.config["name"])
        except ApiError:
            return False
        return True

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["bitbucket"]
        )

        accessible_repos = [r["identifier"] for r in self.get_repositories()]

        return [repo for repo in repos if repo.name not in accessible_repos]

    def source_url_matches(self, url: str) -> bool:
        return url.startswith(f'https://{self.model.metadata["domain_name"]}') or url.startswith(
            "https://bitbucket.org",
        )

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        return f"https://bitbucket.org/{repo.name}/src/{branch}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/src/", "")
        branch, _, _ = url.partition("/")
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/src/", "")
        _, _, source_path = url.partition("/")
        return source_path

    # Bitbucket only methods

    @property
    def username(self):
        return self.model.name


class BitbucketIntegrationProvider(IntegrationProvider):
    key = "bitbucket"
    name = "Bitbucket"
    metadata = metadata
    scopes = scopes
    integration_cls = BitbucketIntegration
    features = frozenset(
        [
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
        ]
    )

    def get_pipeline_views(self) -> list[PipelineView]:
        identity_pipeline_config = {"redirect_url": absolute_uri("/extensions/bitbucket/setup/")}
        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key="bitbucket",
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )
        return [identity_pipeline_view, VerifyInstallation()]

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Any | None = None,
    ) -> None:
        repos = repository_service.get_repositories(
            organization_id=organization.id,
            providers=["bitbucket", "integrations:bitbucket"],
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

    def build_integration(self, state):
        if state.get("publicKey"):
            principal_data = state["principal"]
            base_url = state["baseUrl"].replace("https://", "")
            # fall back to display name, user installations will use this primarily
            username = principal_data.get("username", principal_data["display_name"])
            account_type = principal_data["type"]
            domain = f"{base_url}/{username}" if account_type == "team" else username
            secret = generate_token()

            return {
                "provider": self.key,
                "external_id": state["clientKey"],
                "name": username,
                "metadata": {
                    "public_key": state["publicKey"],
                    "shared_secret": state["sharedSecret"],
                    "webhook_secret": secret,
                    "base_url": state["baseApiUrl"],
                    "domain_name": domain,
                    "icon": principal_data["links"]["avatar"]["href"],
                    "scopes": self.scopes,
                    "uuid": principal_data["uuid"],
                    "type": account_type,  # team or user account
                },
            }
        else:
            return {
                "provider": self.key,
                "external_id": state["external_id"],
                "expect_exists": True,
            }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            BitbucketRepositoryProvider,
            id=f"integrations:{self.key}",
        )


class VerifyInstallation(PipelineView):
    def dispatch(self, request: Request, pipeline) -> Response:
        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.VERIFY_INSTALLATION,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            BitbucketIntegrationProvider.key,
        ).capture() as lifecycle:
            try:
                integration = get_integration_from_request(
                    request, BitbucketIntegrationProvider.key
                )
            except AtlassianConnectValidationError as e:
                lifecycle.record_failure(str(e))
                return pipeline.error("Unable to verify installation.")

            pipeline.bind_state("external_id", integration.external_id)
            return pipeline.next_step()
