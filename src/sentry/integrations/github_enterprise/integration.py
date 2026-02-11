from __future__ import annotations

from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any
from urllib.parse import urlparse

from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from sentry import features, http
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
)
from sentry.integrations.github.constants import ISSUE_LOCKED_ERROR_MESSAGE, RATE_LIMITED_MESSAGE
from sentry.integrations.github.integration import GitHubIntegrationProvider, build_repository_query
from sentry.integrations.github.issue_sync import GitHubIssueSyncSpec
from sentry.integrations.github.issues import GitHubIssuesSpec
from sentry.integrations.github.types import GitHubIssueStatus
from sentry.integrations.github.utils import get_jwt, parse_github_blob_url
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils import jwt, metrics
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from .client import GitHubEnterpriseApiClient
from .repository import GitHubEnterpriseRepositoryProvider


def get_user_info(url, access_token):
    with http.build_session() as session:
        resp = session.get(
            f"https://{url}/api/v3/user",
            headers={
                "Accept": "application/vnd.github.machine-man-preview+json",
                "Authorization": f"token {access_token}",
            },
            verify=False,
        )
        resp.raise_for_status()
    return resp.json()


DESCRIPTION = """
Connect your Sentry organization into your on-premises GitHub Enterprise
instances. Take a step towards augmenting your sentry issues with commits from
your repositories ([using releases](https://docs.sentry.io/learn/releases/))
and linking up your GitHub issues and pull requests directly to issues in
Sentry.
"""

FEATURES = [
    FeatureDescription(
        """
        Authorize repositories to be added to your Sentry organization to augment
        sentry issues with commit data with [deployment
        tracking](https://docs.sentry.io/learn/releases/).
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a GitHub issue or pull
        request in any of your repositories, providing a quick way to jump from
        Sentry bug to tracked issue or PR.
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Automatically sync the status of Sentry issues to GitHub issues.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Automatically sync the assignment of Sentry issues to GitHub issues.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your GitHub source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Import your GitHub [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/github/#code-owners) and use it alongside your ownership rules to assign Sentry issues.
        """,
        IntegrationFeatures.CODEOWNERS,
    ),
    FeatureDescription(
        """
        Automatically create GitHub issues based on Issue Alert conditions.
        """,
        IntegrationFeatures.TICKET_RULES,
    ),
]


disable_dialog = {
    "actionText": "Visit GitHub Enterprise",
    "body": "Before deleting this integration, you must uninstall it from your"
    " GitHub Enterprise instance. After uninstalling, your integration"
    " will be disabled at which point you can choose to delete this"
    " integration.",
}

removal_dialog = {
    "actionText": "Delete",
    "body": "Deleting this integration will delete all associated repositories"
    " and commit data. This action cannot be undone. Are you sure you"
    " want to delete your integration?",
}

setup_alert = {
    "type": "warning",
    "icon": "icon-warning-sm",
    "text": "Your GitHub enterprise instance must be able to communicate with"
    " Sentry. Before you proceed, make sure that connections from [the static set"
    " of IP addresses that Sentry makes outbound requests from]"
    "(https://docs.sentry.io/product/security/ip-ranges/#outbound-requests)"
    " are allowed in your firewall.",
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Enterprise%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github_enterprise",
    aspects={
        "disable_dialog": disable_dialog,
        "removal_dialog": removal_dialog,
        "alerts": [setup_alert],
    },
)


API_ERRORS = {
    404: "If this repository exists, ensure"
    + " that your installation has permission to access this repository"
    + " (https://github.com/settings/installations).",
    401: ERR_UNAUTHORIZED,
}


class GitHubEnterpriseIntegration(
    RepositoryIntegration, GitHubIssuesSpec, GitHubIssueSyncSpec, CommitContextIntegration
):
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.GITHUB_ENTERPRISE.value

    def get_client(self):
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")

        base_url = self.model.metadata["domain_name"].split("/")[0]
        return GitHubEnterpriseApiClient(
            base_url=base_url,
            integration=self.model,
            private_key=self.model.metadata["installation"]["private_key"],
            app_id=self.model.metadata["installation"]["id"],
            verify_ssl=self.model.metadata["installation"]["verify_ssl"],
            org_integration_id=self.org_integration.id,
        )

    # IntegrationInstallation methods

    def message_from_error(self, exc: Exception) -> str:
        if isinstance(exc, ApiError):
            if exc.code is None:
                message = None
            else:
                message = API_ERRORS.get(exc.code)
            if message is None:
                message = exc.json.get("message", "unknown error") if exc.json else "unknown error"
            return f"Error Communicating with GitHub Enterprise (HTTP {exc.code}): {message}"
        else:
            return ERR_INTERNAL

    # RepositoryIntegration methods

    def get_repositories(
        self, query: str | None = None, page_number_limit: int | None = None
    ) -> list[dict[str, Any]]:
        if not query:
            all_repos = self.get_client().get_repos(page_number_limit=page_number_limit)
            return [
                {
                    "name": i["name"],
                    "identifier": i["full_name"],
                    "default_branch": i.get("default_branch"),
                }
                for i in all_repos
                if not i.get("archived")
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {
                "name": i["name"],
                "identifier": i["full_name"],
                "default_branch": i.get("default_branch"),
            }
            for i in response.get("items", [])
        ]

    def source_url_matches(self, url: str) -> bool:
        return url.startswith(f"https://{self.model.metadata["domain_name"]}")

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        # Must format the url ourselves since `check_file` is a head request
        # "https://github.example.org/octokit/octokit.rb/blob/master/README.md"
        return f"{repo.url}/blob/{branch}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        if not repo.url:
            return ""
        branch, _ = parse_github_blob_url(repo.url, url)
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        if not repo.url:
            return ""
        _, source_path = parse_github_blob_url(repo.url, url)
        return source_path

    def search_issues(self, query: str | None, **kwargs):
        return self.get_client().search_issues(query)

    def has_repo_access(self, repo: RpcRepository) -> bool:
        # TODO: define this, used to migrate repositories
        return False

    # CommitContextIntegration methods

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        if api_error.json:
            if ISSUE_LOCKED_ERROR_MESSAGE in api_error.json.get("message", ""):
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="error"),
                    tags={"type": "issue_locked_error"},
                )
                return True

            elif RATE_LIMITED_MESSAGE in api_error.json.get("message", ""):
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="error"),
                    tags={"type": "rate_limited_error"},
                )
                return True

        return False

    def _get_debug_metadata_keys(self) -> list[str]:
        return ["domain_name", "installation_id", "account_type"]

    def get_config_data(self):
        config = self.org_integration.config
        project_mappings = IntegrationExternalProject.objects.filter(
            organization_integration_id=self.org_integration.id
        )
        sync_status_forward = {}

        for pm in project_mappings:
            sync_status_forward[pm.external_id] = {
                "on_unresolve": pm.unresolved_status,
                "on_resolve": pm.resolved_status,
            }
        config["sync_status_forward"] = sync_status_forward
        return config

    def _get_organization_config_default_values(self) -> list[dict[str, Any]]:
        """
        Return configuration options for the GitHub integration.
        """
        config: list[dict[str, Any]] = []

        if features.has(
            "organizations:integrations-github_enterprise-project-management", self.organization
        ):
            config.extend(
                [
                    {
                        "name": self.inbound_status_key,
                        "type": "boolean",
                        "label": _("Sync GitHub Status to Sentry"),
                        "help": _(
                            "When a GitHub issue is marked closed, resolve its linked issue in Sentry. "
                            "When a GitHub issue is reopened, unresolve its linked Sentry issue."
                        ),
                        "default": False,
                    },
                    {
                        "name": self.inbound_assignee_key,
                        "type": "boolean",
                        "label": _("Sync Github Assignment to Sentry"),
                        "help": _(
                            "When an issue is assigned in GitHub, assign its linked Sentry issue to the same user."
                        ),
                        "default": False,
                    },
                    {
                        "name": self.outbound_assignee_key,
                        "type": "boolean",
                        "label": _("Sync Sentry Assignment to GitHub"),
                        "help": _(
                            "When an issue is assigned in Sentry, assign its linked GitHub issue to the same user."
                        ),
                        "default": False,
                    },
                    {
                        "name": self.resolution_strategy_key,
                        "label": "Resolve",
                        "type": "select",
                        "placeholder": "Resolve",
                        "choices": [
                            ("resolve", "Resolve"),
                            ("resolve_current_release", "Resolve in Current Release"),
                            ("resolve_next_release", "Resolve in Next Release"),
                        ],
                        "help": _(
                            "Select what action to take on Sentry Issue when GitHub ticket is marked Closed."
                        ),
                    },
                    {
                        "name": self.comment_key,
                        "type": "boolean",
                        "label": _("Sync Sentry Comments to GitHub"),
                        "help": _("Post comments from Sentry issues to linked GitHub issues"),
                    },
                ]
            )

        return config

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Return configuration options for the GitHub integration.
        """
        config = self._get_organization_config_default_values()

        if features.has(
            "organizations:integrations-github_enterprise-project-management", self.organization
        ):

            # Async lookup for integration external projects in the frontend
            # Get currently configured external projects to display their labels
            current_repo_items = []
            external_projects = IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id
            )

            if external_projects.exists():
                # Use the stored external_id from IntegrationExternalProject
                current_repo_items = [
                    {"value": project.external_id, "label": project.external_id}
                    for project in external_projects
                ]

            config.insert(
                0,
                {
                    "name": self.outbound_status_key,
                    "type": "choice_mapper",
                    "label": _("Sync Sentry Status to Github"),
                    "help": _(
                        "When a Sentry issue changes status, change the status of the linked ticket in Github."
                    ),
                    "addButtonText": _("Add Github Project"),
                    "addDropdown": {
                        "emptyMessage": _("All projects configured"),
                        "noResultsMessage": _("Could not find Github project"),
                        "items": current_repo_items,
                        "url": reverse(
                            "sentry-integration-github-search",
                            args=[self.organization.slug, self.model.id],
                        ),
                        "searchField": "repo",
                    },
                    "mappedSelectors": {
                        "on_resolve": {"choices": GitHubIssueStatus.get_choices()},
                        "on_unresolve": {"choices": GitHubIssueStatus.get_choices()},
                    },
                    "columnLabels": {
                        "on_resolve": _("When resolved"),
                        "on_unresolve": _("When unresolved"),
                    },
                    "mappedColumnLabel": _("Github Project"),
                    "formatMessageValue": False,
                },
            )

        context = organization_service.get_organization_by_id(
            id=self.organization_id, include_projects=False, include_teams=False
        )
        assert context, "organizationcontext must exist to get org"
        organization = context.organization

        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)

        if not has_issue_sync:
            for field in config:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return config

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """
        Update the configuration field for an organization integration.
        """
        if not self.org_integration:
            return

        config = self.org_integration.config

        # Handle status sync configuration
        if "sync_status_forward" in data:
            project_mappings = data.pop("sync_status_forward")

            if any(
                not mapping["on_unresolve"] or not mapping["on_resolve"]
                for mapping in project_mappings.values()
            ):
                raise IntegrationError("Resolve and unresolve status are required.")

            data["sync_status_forward"] = bool(project_mappings)

            IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id
            ).delete()

            for repo_id, statuses in project_mappings.items():
                # For GitHub, we only support open/closed states
                # Validate that the statuses are valid GitHub states
                if statuses["on_resolve"] not in [
                    GitHubIssueStatus.OPEN.value,
                    GitHubIssueStatus.CLOSED.value,
                ]:
                    raise IntegrationError(
                        f"Invalid resolve status: {statuses['on_resolve']}. Must be 'open' or 'closed'."
                    )
                if statuses["on_unresolve"] not in ["open", "closed"]:
                    raise IntegrationError(
                        f"Invalid unresolve status: {statuses['on_unresolve']}. Must be 'open' or 'closed'."
                    )

                IntegrationExternalProject.objects.create(
                    organization_integration_id=self.org_integration.id,
                    external_id=repo_id,
                    resolved_status=statuses["on_resolve"],
                    unresolved_status=statuses["on_unresolve"],
                )

        config.update(data)
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )
        if org_integration is not None:
            self.org_integration = org_integration


class InstallationForm(forms.Form):
    url = forms.CharField(
        label="Installation Url",
        help_text=_(
            'The "base URL" for your GitHub enterprise instance, ' "includes the host and protocol."
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://github.example.com"}),
    )
    id = forms.CharField(
        label="GitHub App ID",
        help_text=_(
            "The App ID of your Sentry app. This can be " "found on your apps configuration page."
        ),
        widget=forms.TextInput(attrs={"placeholder": "1"}),
    )
    name = forms.CharField(
        label="GitHub App Name",
        help_text=_(
            "The GitHub App name of your Sentry app. "
            "This can be found on the apps configuration "
            "page."
        ),
        widget=forms.TextInput(attrs={"placeholder": "our-sentry-app"}),
    )
    public_link = forms.URLField(
        label="Public Link (GitHub Enterprise Server only)",
        help_text=_("The publicly available link for your GitHub App in GitHub Enterprise Server"),
        widget=forms.TextInput(attrs={"placeholder": "https://github.example.com"}),
        required=False,
        assume_scheme="https",
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates "
            "when delivering payloads to your GitHub "
            "Enterprise instance"
        ),
        widget=forms.CheckboxInput(),
        required=False,
    )
    webhook_secret = forms.CharField(
        label="GitHub App Webhook Secret",
        help_text=_(
            "We require a webhook secret to be "
            "configured. This can be generated as any "
            "random string value of your choice and "
            "should match your GitHub app "
            "configuration."
        ),
        widget=forms.TextInput(attrs={"placeholder": "XXXXXXXXXXXXXXXXXXXXXXXXXXX"}),
    )
    private_key = forms.CharField(
        label="GitHub App Private Key",
        help_text=_("The Private Key generated for your Sentry " "GitHub App."),
        widget=forms.Textarea(
            attrs={
                "rows": "60",
                "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            }
        ),
    )
    client_id = forms.CharField(
        label="GitHub App OAuth Client ID", widget=forms.TextInput(attrs={"placeholder": "1"})
    )
    client_secret = forms.CharField(
        label="GitHub App OAuth Client Secret",
        widget=forms.TextInput(attrs={"placeholder": "XXXXXXXXXXXXXXXXXXXXXXXXXXX"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["verify_ssl"].initial = True


class InstallationConfigView:
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data
                form_data["url"] = urlparse(form_data["url"]).netloc
                if not form_data["public_link"]:
                    form_data["public_link"] = None

                pipeline.bind_state("installation_data", form_data)

                pipeline.bind_state(
                    "oauth_config_information",
                    {
                        "access_token_url": "https://{}/login/oauth/access_token".format(
                            form_data.get("url")
                        ),
                        "authorize_url": "https://{}/login/oauth/authorize".format(
                            form_data.get("url")
                        ),
                        "client_id": form_data.get("client_id"),
                        "client_secret": form_data.get("client_secret"),
                        "verify_ssl": form_data.get("verify_ssl"),
                    },
                )

                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/github-enterprise-config.html",
            context={"form": form},
            request=request,
        )


class GitHubEnterpriseIntegrationProvider(GitHubIntegrationProvider):
    key = IntegrationProviderSlug.GITHUB_ENTERPRISE.value
    name = "GitHub Enterprise"
    metadata = metadata
    integration_cls = GitHubEnterpriseIntegration
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def _make_identity_pipeline_view(self) -> PipelineView[IntegrationPipeline]:
        """
        Make the nested identity provider view. It is important that this view is
        not constructed until we reach this step and the
        ``oauth_config_information`` is available in the pipeline state. This
        method should be late bound into the pipeline vies.
        """
        oauth_information = self.pipeline.fetch_state("oauth_config_information")
        if oauth_information is None:
            raise AssertionError("pipeline called out of order")

        identity_pipeline_config = dict(
            oauth_scopes=(),
            redirect_url=absolute_uri("/extensions/github-enterprise/setup/"),
            **oauth_information,
        )

        return NestedPipelineView(
            bind_key="identity",
            provider_key=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
            pipeline_cls=IdentityPipeline,
            config=identity_pipeline_config,
        )

    def get_pipeline_views(
        self,
    ) -> Sequence[
        PipelineView[IntegrationPipeline] | Callable[[], PipelineView[IntegrationPipeline]]
    ]:
        return (
            InstallationConfigView(),
            GitHubEnterpriseInstallationRedirect(),
            # The identity provider pipeline should be constructed at execution
            # time, this allows for the oauth configuration parameters to be made
            # available from the installation config view.
            lambda: self._make_identity_pipeline_view(),
        )

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        pass

    def _get_ghe_installation_info(self, installation_data, access_token, installation_id):
        headers = {
            # TODO(jess): remove this whenever it's out of preview
            "Accept": "application/vnd.github.machine-man-preview+json",
        }
        headers.update(
            jwt.authorization_header(
                get_jwt(
                    github_id=installation_data["id"],
                    github_private_key=installation_data["private_key"],
                )
            )
        )
        with http.build_session() as session:
            resp = session.get(
                f"https://{installation_data['url']}/api/v3/app/installations/{installation_id}",
                headers=headers,
                verify=installation_data["verify_ssl"],
            )
            resp.raise_for_status()
            installation_resp = resp.json()

            resp = session.get(
                f"https://{installation_data['url']}/api/v3/user/installations",
                headers={
                    "Accept": "application/vnd.github.machine-man-preview+json",
                    "Authorization": f"token {access_token}",
                },
                verify=installation_data["verify_ssl"],
            )
            resp.raise_for_status()
            user_installations_resp = resp.json()

        # verify that user actually has access to the installation
        for installation in user_installations_resp["installations"]:
            if installation["id"] == installation_resp["id"]:
                return installation_resp

        return None

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        identity = state["identity"]["data"]
        installation_data = state["installation_data"]
        user = get_user_info(installation_data["url"], identity["access_token"])
        installation = self._get_ghe_installation_info(
            installation_data, identity["access_token"], state["installation_id"]
        )

        domain = urlparse(installation["account"]["html_url"]).netloc
        return {
            "name": installation["account"]["login"],
            # installation id is not enough to be unique for self-hosted GH
            "external_id": "{}:{}".format(domain, installation["id"]),
            # GitHub identity is associated directly to the application, *not*
            # to the installation itself.
            # app id is not enough to be unique for self-hosted GH
            "idp_external_id": "{}:{}".format(domain, installation["app_id"]),
            "metadata": {
                # The access token will be populated upon API usage
                "access_token": None,
                "expires_at": None,
                "icon": installation["account"]["avatar_url"],
                "domain_name": installation["account"]["html_url"].replace("https://", ""),
                "account_type": installation["account"]["type"],
                "installation_id": installation["id"],
                "installation": installation_data,
            },
            "user_identity": {
                "type": IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
                "external_id": user["id"],
                "scopes": [],  # GitHub apps do not have user scopes
                "data": {"access_token": identity["access_token"]},
            },
            "idp_config": state["oauth_config_information"],
        }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            GitHubEnterpriseRepositoryProvider,
            id="integrations:github_enterprise",
        )


class GitHubEnterpriseInstallationRedirect:
    def get_app_url(self, installation_data):
        if installation_data.get("public_link"):
            return installation_data["public_link"]

        url = installation_data.get("url")
        name = installation_data.get("name")
        return f"https://{url}/github-apps/{name}"

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        installation_data = pipeline.fetch_state(key="installation_data")

        if "installation_id" in request.GET:
            pipeline.bind_state("installation_id", request.GET["installation_id"])
            return pipeline.next_step()

        return HttpResponseRedirect(self.get_app_url(installation_data))
