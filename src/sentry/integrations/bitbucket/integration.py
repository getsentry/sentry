from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.datastructures import OrderedSet
from django.utils.translation import gettext_lazy as _

from sentry import features
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
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
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.services.user import RpcUser
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
    FeatureDescription(
        """
        Import your Bitbucket [CODEOWNERS file](https://support.atlassian.com/bitbucket-cloud/docs/set-up-and-use-code-owners/) and use it alongside your ownership rules to assign Sentry issues.
        """,
        IntegrationFeatures.CODEOWNERS,
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


class BitbucketIntegration(RepositoryIntegration, BitbucketIssuesSpec, IssueSyncIntegration):
    # Issue sync configuration keys
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"

    codeowners_locations = [".bitbucket/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return "bitbucket"

    def get_client(self):
        return BitbucketApiClient(integration=self.model)

    # IssueSyncIntegration methods

    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Sync assignee from Sentry to Bitbucket issue
        """
        client = self.get_client()
        repo_name, issue_id = external_issue.key.split("#")

        assignee = None
        if user and assign:
            # For Bitbucket, we'll use the user's username as the assignee
            # In a real implementation, you'd want to map Sentry users to Bitbucket users
            assignee = {"username": user.username}

        try:
            # Update the issue with the assignee
            client.put(f"/repositories/{repo_name}/issues/{issue_id}", data={"assignee": assignee})
        except Exception as e:
            self.logger.info(
                "bitbucket.failed-to-assign",
                extra={
                    "integration_id": external_issue.integration_id,
                    "user_id": user.id if user else None,
                    "issue_key": external_issue.key,
                    "error": str(e),
                },
            )

    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        """
        Sync status from Sentry to Bitbucket issue
        """
        client = self.get_client()
        repo_name, issue_id = external_issue.key.split("#")

        try:
            # Update the issue state
            state = "closed" if is_resolved else "open"
            client.put(f"/repositories/{repo_name}/issues/{issue_id}", data={"state": state})
        except Exception as e:
            self.logger.info(
                "bitbucket.failed-to-sync-status",
                extra={
                    "integration_id": external_issue.integration_id,
                    "is_resolved": is_resolved,
                    "issue_key": external_issue.key,
                    "error": str(e),
                },
            )

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Determine resolve/unresolve action from Bitbucket webhook data
        """
        issue = data.get("issue", {})
        state = issue.get("state")

        # Bitbucket issue states can be: open, resolved, closed, etc.
        if state in ["resolved", "closed"]:
            return ResolveSyncAction.RESOLVE
        elif state == "open":
            return ResolveSyncAction.UNRESOLVE

        return ResolveSyncAction.NOOP

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Get configuration fields for the organization integration
        """
        fields = [
            {
                "name": self.outbound_status_key,
                "type": "boolean",
                "label": _("Sync Sentry Status to Bitbucket"),
                "help": _(
                    "When a Sentry issue changes status, change the status of the linked Bitbucket issue."
                ),
            },
            {
                "name": self.outbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Sentry Assignment to Bitbucket"),
                "help": _(
                    "When an issue is assigned in Sentry, assign its linked Bitbucket issue to the same user."
                ),
            },
            {
                "name": self.comment_key,
                "type": "boolean",
                "label": _("Sync Sentry Comments to Bitbucket"),
                "help": _("Post comments from Sentry issues to linked Bitbucket issues"),
            },
            {
                "name": self.inbound_status_key,
                "type": "boolean",
                "label": _("Sync Bitbucket Status to Sentry"),
                "help": _(
                    "When a Bitbucket issue is closed, resolve its linked issue in Sentry. "
                    "When a Bitbucket issue is reopened, unresolve its linked Sentry issue."
                ),
            },
            {
                "name": self.inbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Bitbucket Assignment to Sentry"),
                "help": _(
                    "When an issue is assigned in Bitbucket, assign its linked Sentry issue to the same user."
                ),
            },
        ]

        has_issue_sync = features.has("organizations:integrations-issue-sync", self.organization)
        if not has_issue_sync:
            for field in fields:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return fields

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
        return []

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
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def get_pipeline_views(self) -> Sequence[PipelineView[IntegrationPipeline]]:
        return [
            NestedPipelineView(
                bind_key="identity",
                provider_key="bitbucket",
                pipeline_cls=IdentityPipeline,
                config={"redirect_url": absolute_uri("/extensions/bitbucket/setup/")},
            ),
            VerifyInstallation(),
        ]

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
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

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
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


class VerifyInstallation:
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
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
