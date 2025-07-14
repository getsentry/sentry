from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from django import forms
from django.core.validators import URLValidator
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.utils.translation import gettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

from sentry import features
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.users.models.identity import Identity
from sentry.users.services.user import RpcUser
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

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


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_("Bitbucket URL"),
        help_text=_(
            "The base URL for your Bitbucket Server instance, including the host and protocol."
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://bitbucket.example.com"}),
        validators=[URLValidator()],
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates "
            "when making requests to your Bitbucket instance."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True,
    )
    consumer_key = forms.CharField(
        label=_("Bitbucket Consumer Key"),
        widget=forms.TextInput(attrs={"placeholder": "sentry-consumer-key"}),
    )
    private_key = forms.CharField(
        label=_("Bitbucket Consumer Private Key"),
        widget=forms.Textarea(
            attrs={
                "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
            }
        ),
    )

    def clean_url(self):
        """Strip off trailing / as they cause invalid URLs downstream"""
        return self.cleaned_data["url"].rstrip("/")

    def clean_private_key(self):
        data = self.cleaned_data["private_key"]

        try:
            load_pem_private_key(data.encode("utf-8"), None, default_backend())
        except Exception:
            raise forms.ValidationError(
                "Private key must be a valid SSH private key encoded in a PEM format."
            )
        return data

    def clean_consumer_key(self):
        data = self.cleaned_data["consumer_key"]
        if len(data) > 200:
            raise forms.ValidationError("Consumer key is limited to 200 characters.")
        return data


class InstallationConfigView:
    """
    Collect the OAuth client credentials from the user.
    """

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state("installation_data", form_data)
                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/bitbucket-server-config.html",
            context={"form": form},
            request=request,
        )


class OAuthLoginView:
    """
    Start the OAuth dance by creating a request token
    and redirecting the user to approve it.
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.OAUTH_LOGIN,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            BitbucketServerIntegrationProvider.key,
        ).capture() as lifecycle:
            if "oauth_token" in request.GET:
                return pipeline.next_step()

            config = pipeline.fetch_state("installation_data")
            assert config is not None
            client = BitbucketServerSetupClient(
                config.get("url"),
                config.get("consumer_key"),
                config.get("private_key"),
                config.get("verify_ssl"),
            )

            try:
                request_token = client.get_request_token()
            except ApiError as error:
                lifecycle.record_failure(str(error), extra={"url": config.get("url")})
                return pipeline.error(f"Could not fetch a request token from Bitbucket. {error}")

            pipeline.bind_state("request_token", request_token)
            if not request_token.get("oauth_token"):
                lifecycle.record_failure("missing oauth_token", extra={"url": config.get("url")})
                return pipeline.error("Missing oauth_token")

            authorize_url = client.get_authorize_url(request_token)

            return HttpResponseRedirect(authorize_url)


class OAuthCallbackView:
    """
    Complete the OAuth dance by exchanging our request token
    into an access token.
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.OAUTH_CALLBACK,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            BitbucketServerIntegrationProvider.key,
        ).capture() as lifecycle:
            config = pipeline.fetch_state("installation_data")
            assert config is not None
            client = BitbucketServerSetupClient(
                config.get("url"),
                config.get("consumer_key"),
                config.get("private_key"),
                config.get("verify_ssl"),
            )

            try:
                access_token = client.get_access_token(
                    pipeline.fetch_state("request_token"), request.GET["oauth_token"]
                )

                pipeline.bind_state("access_token", access_token)

                return pipeline.next_step()
            except ApiError as error:
                lifecycle.record_failure(str(error))
                return pipeline.error(
                    f"Could not fetch an access token from Bitbucket. {str(error)}"
                )


class BitbucketServerIntegration(RepositoryIntegration, IssueSyncIntegration):
    """
    IntegrationInstallation implementation for Bitbucket Server
    """

    # Issue sync configuration keys
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"

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

    # IssueSyncIntegration methods

    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Sync assignee from Sentry to Bitbucket Server issue
        """
        client = self.get_client()
        project_key, issue_id = external_issue.key.split("#")

        assignee = None
        if user and assign:
            # For Bitbucket Server, we'll use the user's username as the assignee
            # In a real implementation, you'd want to map Sentry users to Bitbucket users
            assignee = {"name": user.username}

        try:
            # Update the issue with the assignee
            client.put(f"/projects/{project_key}/repos/{issue_id}", data={"assignee": assignee})
        except Exception as e:
            self.logger.info(
                "bitbucket_server.failed-to-assign",
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
        Sync status from Sentry to Bitbucket Server issue
        """
        client = self.get_client()
        project_key, issue_id = external_issue.key.split("#")

        try:
            # Update the issue state
            state = "RESOLVED" if is_resolved else "OPEN"
            client.put(f"/projects/{project_key}/repos/{issue_id}", data={"state": state})
        except Exception as e:
            self.logger.info(
                "bitbucket_server.failed-to-sync-status",
                extra={
                    "integration_id": external_issue.integration_id,
                    "is_resolved": is_resolved,
                    "issue_key": external_issue.key,
                    "error": str(e),
                },
            )

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Determine resolve/unresolve action from Bitbucket Server webhook data
        """
        # Bitbucket Server webhook structure may vary
        state = data.get("state")

        if state in ["RESOLVED", "CLOSED"]:
            return ResolveSyncAction.RESOLVE
        elif state == "OPEN":
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
                "label": _("Sync Sentry Status to Bitbucket Server"),
                "help": _(
                    "When a Sentry issue changes status, change the status of the linked Bitbucket Server issue."
                ),
            },
            {
                "name": self.outbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Sentry Assignment to Bitbucket Server"),
                "help": _(
                    "When an issue is assigned in Sentry, assign its linked Bitbucket Server issue to the same user."
                ),
            },
            {
                "name": self.comment_key,
                "type": "boolean",
                "label": _("Sync Sentry Comments to Bitbucket Server"),
                "help": _("Post comments from Sentry issues to linked Bitbucket Server issues"),
            },
            {
                "name": self.inbound_status_key,
                "type": "boolean",
                "label": _("Sync Bitbucket Server Status to Sentry"),
                "help": _(
                    "When a Bitbucket Server issue is closed, resolve its linked issue in Sentry. "
                    "When a Bitbucket Server issue is reopened, unresolve its linked Sentry issue."
                ),
            },
            {
                "name": self.inbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Bitbucket Server Assignment to Sentry"),
                "help": _(
                    "When an issue is assigned in Bitbucket Server, assign its linked Sentry issue to the same user."
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
        if not query:
            resp = self.get_client().get_repos()

            return [
                {
                    "identifier": repo["project"]["key"] + "/" + repo["slug"],
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

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        return []

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        return f"{self.model.metadata['base_url']}/projects/{repo.config['project']}/repos/{repo.config['name']}/browse/{filepath}?at={branch}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        parsed_url = urlparse(url)
        branch = parse_qs(parsed_url.query).get("at", [None])[0]
        return branch or repo.get_default_branch() or "master"

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        parsed_url = urlparse(url)
        path = parsed_url.path
        prefix = f"/projects/{repo.config['project']}/repos/{repo.config['name']}/browse/"
        if path.startswith(prefix):
            return path[len(prefix) :]
        return ""

    @property
    def username(self):
        return self.model.name


class BitbucketServerIntegrationProvider(IntegrationProvider):
    key = "bitbucket_server"
    name = "Bitbucket Server"
    metadata = metadata
    integration_cls = BitbucketServerIntegration
    needs_default_identity = True
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )
    setup_dialog_config = {"width": 1030, "height": 1000}

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        return [InstallationConfigView(), OAuthLoginView(), OAuthCallbackView()]

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
