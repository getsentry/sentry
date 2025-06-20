from __future__ import annotations

import logging
import re
from collections.abc import Callable, Mapping, Sequence
from enum import StrEnum
from typing import Any, TypedDict
from urllib.parse import parse_qsl

from django.http import HttpResponse
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.github.provider import GitHubIdentityProvider
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.github.constants import ISSUE_LOCKED_ERROR_MESSAGE, RATE_LIMITED_MESSAGE
from sentry.integrations.github.tasks.link_all_repos import link_all_repos
from sentry.integrations.github.tasks.utils import GithubAPIErrorType
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline_types import IntegrationPipelineT, IntegrationPipelineViewT
from sentry.integrations.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER, GITHUB_PR_BOT_REFERRER
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import RpcRepository, repository_service
from sentry.integrations.source_code_management.commit_context import (
    OPEN_PR_MAX_FILES_CHANGED,
    OPEN_PR_MAX_LINES_CHANGED,
    OPEN_PR_METRICS_BASE,
    CommitContextIntegration,
    OpenPRCommentWorkflow,
    PRCommentWorkflow,
    PullRequestFile,
    PullRequestIssue,
    _open_pr_comment_log,
)
from sentry.integrations.source_code_management.language_parsers import (
    get_patch_parsers_for_organization,
)
from sentry.integrations.source_code_management.repo_trees import RepoTreesIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.snuba.referrer import Referrer
from sentry.templatetags.sentry_helpers import small_count
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import metrics
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import determine_active_organization
from sentry.web.helpers import render_to_response

from .client import GitHubApiClient, GitHubBaseClient, GithubSetupApiClient
from .issues import GitHubIssuesSpec
from .repository import GitHubRepositoryProvider

logger = logging.getLogger("sentry.integrations.github")

DESCRIPTION = """
Connect your Sentry organization into your GitHub organization or user account.
Take a step towards augmenting your sentry issues with commits from your
repositories ([using releases](https://docs.sentry.io/learn/releases/)) and
linking up your GitHub issues and pull requests directly to issues in Sentry.
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

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github",
    aspects={},
)

API_ERRORS = {
    404: "If this repository exists, ensure"
    " that your installation has permission to access this repository"
    " (https://github.com/settings/installations).",
    401: ERR_UNAUTHORIZED,
}

ERR_INTEGRATION_EXISTS_ON_ANOTHER_ORG = _(
    "It seems that your GitHub account has been installed on another Sentry organization. Please uninstall and try again."
)
ERR_INTEGRATION_INVALID_INSTALLATION_REQUEST = _(
    "We could not verify the authenticity of the installation request. We recommend restarting the installation process."
)
ERR_INTEGRATION_PENDING_DELETION = _(
    "It seems that your Sentry organization has an installation pending deletion. Please wait ~15min for the uninstall to complete and try again."
)
ERR_INTEGRATION_INVALID_INSTALLATION = _(
    "Your GitHub account does not have owner privileges for the chosen organization."
)


class GithubInstallationInfo(TypedDict):
    installation_id: str
    github_account: str
    avatar_url: str


def build_repository_query(metadata: Mapping[str, Any], name: str, query: str) -> bytes:
    """
    Builds a query for the GitHub Search API. Always includes both forks and original repositories.
    Test out your query updates here: https://github.com/search/advanced
    """
    account_type = "user" if metadata["account_type"] == "User" else "org"
    return f"fork:true {account_type}:{name} {query}".encode()


def error(
    request,
    org,
    error_short="Invalid installation request.",
    error_long=ERR_INTEGRATION_INVALID_INSTALLATION_REQUEST,
):
    logger.error(
        "github.installation_error",
        extra={"org_id": org.organization.id, "error_short": error_short},
    )

    return render_to_response(
        "sentry/integrations/github-integration-failed.html",
        context={
            "error": error_long,
            "payload": {
                "success": False,
                "data": {"error": _(error_short)},
            },
            "document_origin": get_document_origin(org),
        },
        request=request,
    )


def get_document_origin(org) -> str:
    if org and features.has("system:multi-region"):
        return f'"{generate_organization_url(org.organization.slug)}"'
    return "document.origin"


# Github App docs and list of available endpoints
# https://docs.github.com/en/rest/apps/installations
# https://docs.github.com/en/rest/overview/endpoints-available-for-github-apps


class GitHubIntegration(
    RepositoryIntegration, GitHubIssuesSpec, CommitContextIntegration, RepoTreesIntegration
):
    integration_name = "github"

    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    def get_client(self) -> GitHubBaseClient:
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")
        return GitHubApiClient(integration=self.model, org_integration_id=self.org_integration.id)

    # IntegrationInstallation methods

    def is_rate_limited_error(self, exc: ApiError) -> bool:
        if exc.json and RATE_LIMITED_MESSAGE in exc.json.get("message", ""):
            metrics.incr("github.link_all_repos.rate_limited_error")
            return True

        return False

    def message_from_error(self, exc: Exception) -> str:
        if not isinstance(exc, ApiError):
            return ERR_INTERNAL

        if not exc.code:
            message = ""
        else:
            message = API_ERRORS.get(exc.code, "")

        if exc.code == 404 and exc.url and re.search(r"/repos/.*/(compare|commits)", exc.url):
            message += (
                " Please also confirm that the commits associated with "
                f"the following URL have been pushed to GitHub: {exc.url}"
            )

        if not message:
            message = exc.json.get("message", "unknown error") if exc.json else "unknown error"
        return f"Error Communicating with GitHub (HTTP {exc.code}): {message}"

    # RepositoryIntegration methods

    def source_url_matches(self, url: str) -> bool:
        return url.startswith("https://{}".format(self.model.metadata["domain_name"]))

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        # Must format the url ourselves since `check_file` is a head request
        # "https://github.com/octokit/octokit.rb/blob/master/README.md"
        return f"https://github.com/{repo.name}/blob/{branch}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/blob/", "")
        branch, _, _ = url.partition("/")
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/blob/", "")
        _, _, source_path = url.partition("/")
        return source_path

    def get_repositories(self, query: str | None = None) -> list[dict[str, Any]]:
        """
        args:
        * query - a query to filter the repositories by

        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation
        """
        if not query:
            all_repos = self.get_client().get_repos()
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

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r["identifier"] for r in accessible_repos]

        existing_repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["github"]
        )

        return [repo for repo in existing_repos if repo.name not in accessible_repo_names]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        client = self.get_client()
        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicitly ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://docs.github.com/en/rest/webhooks/repo-config#list-hooks
            client.repo_hooks(repo.config["name"])
        except ApiError:
            return False
        return True

    def search_issues(self, query: str | None, **kwargs) -> dict[str, Any]:
        if query is None:
            query = ""
        resp = self.get_client().search_issues(query)
        assert isinstance(resp, dict)
        return resp

    def get_account_id(self):
        installation_metadata = self.model.metadata
        github_account_id = installation_metadata.get("account_id")

        # Attempt to backfill the id if it does not exist
        if github_account_id is None:
            client: GitHubBaseClient = self.get_client()
            installation_id = self.model.external_id
            updated_installation_info: Mapping[str, Any] = client.get_installation_info(
                installation_id
            )

            github_account_id = updated_installation_info["account"]["id"]
            installation_metadata["account_id"] = github_account_id
            integration_service.update_integration(
                integration_id=self.model.id, metadata=installation_metadata
            )

        return github_account_id

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

    def get_pr_comment_workflow(self) -> PRCommentWorkflow:
        return GitHubPRCommentWorkflow(integration=self)

    def get_open_pr_comment_workflow(self) -> OpenPRCommentWorkflow:
        return GitHubOpenPRCommentWorkflow(integration=self)


MERGED_PR_COMMENT_BODY_TEMPLATE = """\
## Suspect Issues
This pull request was deployed and Sentry observed the following issues:

{issue_list}

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""


class GitHubPRCommentWorkflow(PRCommentWorkflow):
    organization_option_key = "sentry:github_pr_bot"
    referrer = Referrer.GITHUB_PR_COMMENT_BOT
    referrer_id = GITHUB_PR_BOT_REFERRER

    @staticmethod
    def format_comment_subtitle(subtitle: str) -> str:
        return subtitle[:47] + "..." if len(subtitle) > 50 else subtitle

    @staticmethod
    def format_comment_url(url: str, referrer: str) -> str:
        return url + "?referrer=" + referrer

    def get_comment_body(self, issue_ids: list[int]) -> str:
        issues = Group.objects.filter(id__in=issue_ids).order_by("id").all()

        issue_list = "\n".join(
            [
                self.get_merged_pr_single_issue_template(
                    title=issue.title,
                    url=self.format_comment_url(issue.get_absolute_url(), self.referrer_id),
                    environment=self.get_environment_info(issue),
                )
                for issue in issues
            ]
        )

        return MERGED_PR_COMMENT_BODY_TEMPLATE.format(issue_list=issue_list)

    def get_comment_data(
        self,
        organization: Organization,
        repo: Repository,
        pr: PullRequest,
        comment_body: str,
        issue_ids: list[int],
    ) -> dict[str, Any]:
        enabled_copilot = features.has("organizations:gen-ai-features", organization)

        comment_data: dict[str, Any] = {
            "body": comment_body,
        }
        if enabled_copilot:
            comment_data["actions"] = [
                {
                    "name": f"Root cause #{i + 1}",
                    "type": "copilot-chat",
                    "prompt": f"@sentry root cause issue {str(issue_id)} with PR URL https://github.com/{repo.name}/pull/{str(pr.key)}",
                }
                for i, issue_id in enumerate(issue_ids[:3])
            ]

        return comment_data


OPEN_PR_COMMENT_BODY_TEMPLATE = """\
## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

{issue_tables}
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

OPEN_PR_ISSUE_TABLE_TEMPLATE = """\
📄 File: **{filename}**

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}"""

OPEN_PR_ISSUE_TABLE_TOGGLE_TEMPLATE = """\
<details>
<summary><b>📄 File: {filename} (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}
</details>"""

OPEN_PR_ISSUE_DESCRIPTION_LENGTH = 52


class GitHubOpenPRCommentWorkflow(OpenPRCommentWorkflow):
    integration: GitHubIntegration
    organization_option_key = "sentry:github_open_pr_bot"
    referrer = Referrer.GITHUB_PR_COMMENT_BOT
    referrer_id = GITHUB_OPEN_PR_BOT_REFERRER

    def safe_for_comment(self, repo: Repository, pr: PullRequest) -> list[dict[str, Any]]:
        client = self.integration.get_client()
        logger.info(
            _open_pr_comment_log(
                integration_name=self.integration.integration_name, suffix="check_safe_for_comment"
            )
        )
        try:
            pr_files = client.get_pullrequest_files(repo=repo.name, pull_number=pr.key)
        except ApiError as e:
            logger.info(
                _open_pr_comment_log(
                    integration_name=self.integration.integration_name, suffix="api_error"
                )
            )
            if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="api_error"
                    ),
                    tags={"type": GithubAPIErrorType.RATE_LIMITED.value, "code": e.code},
                )
            elif e.code == 404:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="api_error"
                    ),
                    tags={"type": GithubAPIErrorType.MISSING_PULL_REQUEST.value, "code": e.code},
                )
            else:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="api_error"
                    ),
                    tags={"type": GithubAPIErrorType.UNKNOWN.value, "code": e.code},
                )
                logger.exception(
                    _open_pr_comment_log(
                        integration_name=self.integration.integration_name,
                        suffix="unknown_api_error",
                    ),
                    extra={"error": str(e)},
                )
            return []

        changed_file_count = 0
        changed_lines_count = 0
        filtered_pr_files = []

        organization = Organization.objects.get_from_cache(id=repo.organization_id)
        patch_parsers = get_patch_parsers_for_organization(organization)

        for file in pr_files:
            filename = file["filename"]
            # we only count the file if it's modified and if the file extension is in the list of supported file extensions
            # we cannot look at deleted or newly added files because we cannot extract functions from the diffs
            if file["status"] != "modified" or filename.split(".")[-1] not in patch_parsers:
                continue

            changed_file_count += 1
            changed_lines_count += file["changes"]
            filtered_pr_files.append(file)

            if changed_file_count > OPEN_PR_MAX_FILES_CHANGED:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="rejected_comment"
                    ),
                    tags={"reason": "too_many_files"},
                )
                return []
            if changed_lines_count > OPEN_PR_MAX_LINES_CHANGED:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="rejected_comment"
                    ),
                    tags={"reason": "too_many_lines"},
                )
                return []

        return filtered_pr_files

    def get_pr_files(self, pr_files: list[dict[str, Any]]) -> list[PullRequestFile]:
        # new files will not have sentry issues associated with them
        # only fetch Python files
        pullrequest_files = [
            PullRequestFile(filename=file["filename"], patch=file["patch"])
            for file in pr_files
            if "patch" in file
        ]

        logger.info(
            _open_pr_comment_log(
                integration_name=self.integration.integration_name,
                suffix="pr_filenames",
            ),
            extra={"count": len(pullrequest_files)},
        )

        return pullrequest_files

    def get_pr_files_safe_for_comment(
        self, repo: Repository, pr: PullRequest
    ) -> list[PullRequestFile]:
        pr_files = self.safe_for_comment(repo=repo, pr=pr)

        if len(pr_files) == 0:
            logger.info(
                _open_pr_comment_log(
                    integration_name=self.integration.integration_name,
                    suffix="not_safe_for_comment",
                ),
                extra={"file_count": len(pr_files)},
            )
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(
                    integration=self.integration.integration_name, key="error"
                ),
                tags={"type": "unsafe_for_comment"},
            )
            return []

        return self.get_pr_files(pr_files)

    def get_comment_data(self, comment_body: str) -> dict[str, Any]:
        return {
            "body": comment_body,
        }

    @staticmethod
    def format_comment_url(url: str, referrer: str) -> str:
        return url + "?referrer=" + referrer

    @staticmethod
    def format_open_pr_comment(issue_tables: list[str]) -> str:
        return OPEN_PR_COMMENT_BODY_TEMPLATE.format(issue_tables="\n".join(issue_tables))

    @staticmethod
    def format_open_pr_comment_subtitle(title_length, subtitle):
        # the title length + " " + subtitle should be <= 52
        subtitle_length = OPEN_PR_ISSUE_DESCRIPTION_LENGTH - title_length - 1
        return (
            subtitle[: subtitle_length - 3] + "..." if len(subtitle) > subtitle_length else subtitle
        )

    def format_issue_table(
        self,
        diff_filename: str,
        issues: list[PullRequestIssue],
        patch_parsers: dict[str, Any],
        toggle: bool,
    ) -> str:
        language_parser = patch_parsers.get(diff_filename.split(".")[-1], None)

        if not language_parser:
            return ""

        issue_row_template = language_parser.issue_row_template

        issue_rows = "\n".join(
            [
                issue_row_template.format(
                    title=issue.title,
                    subtitle=self.format_open_pr_comment_subtitle(len(issue.title), issue.subtitle),
                    url=self.format_comment_url(issue.url, GITHUB_OPEN_PR_BOT_REFERRER),
                    event_count=small_count(issue.event_count),
                    function_name=issue.function_name,
                    affected_users=small_count(issue.affected_users),
                )
                for issue in issues
            ]
        )

        if toggle:
            return OPEN_PR_ISSUE_TABLE_TOGGLE_TEMPLATE.format(
                filename=diff_filename, issue_rows=issue_rows
            )

        return OPEN_PR_ISSUE_TABLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)


class GitHubIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GITHUB.value
    name = "GitHub"
    metadata = metadata
    integration_cls: type[IntegrationInstallation] = GitHubIntegration
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    setup_dialog_config = {"width": 1030, "height": 1000}

    @property
    def client(self) -> GithubSetupApiClient:
        # The endpoints we need to hit at this step authenticate via JWT so no need for access token in client
        return GithubSetupApiClient()

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        repos = repository_service.get_repositories(
            organization_id=organization.id,
            providers=["github", "integrations:github"],
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

        link_all_repos.apply_async(
            kwargs={
                "integration_key": self.key,
                "integration_id": integration.id,
                "organization_id": organization.id,
            }
        )

    def get_pipeline_views(
        self,
    ) -> Sequence[IntegrationPipelineViewT | Callable[[], IntegrationPipelineViewT]]:
        return [OAuthLoginView(), GithubOrganizationSelection(), GitHubInstallation()]

    def get_installation_info(self, installation_id: str) -> Mapping[str, Any]:
        resp: Mapping[str, Any] = self.client.get_installation_info(installation_id=installation_id)
        return resp

    def build_integration(self, state: Mapping[str, str]) -> IntegrationData:
        try:
            installation = self.get_installation_info(
                state["installation_id"],
            )
        except ApiError as api_error:
            if api_error.code == 404:
                raise IntegrationError("The GitHub installation could not be found.")
            raise

        integration: IntegrationData = {
            "name": installation["account"]["login"],
            # TODO(adhiraj): This should be a constant representing the entire github cloud.
            "external_id": installation["id"],
            # GitHub identity is associated directly to the application, *not*
            # to the installation itself.
            "idp_external_id": installation["app_id"],
            "metadata": {
                # The access token will be populated upon API usage
                "access_token": None,
                "expires_at": None,
                "icon": installation["account"]["avatar_url"],
                "domain_name": installation["account"]["html_url"].replace("https://", ""),
                "account_type": installation["account"]["type"],
                "account_id": installation["account"]["id"],
            },
        }

        if state.get("sender"):
            integration["metadata"]["sender"] = state["sender"]

        return integration

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )


class GitHubInstallationError(StrEnum):
    INVALID_STATE = "Invalid state"
    MISSING_TOKEN = "Missing access token"
    MISSING_LOGIN = "Missing login info"
    PENDING_DELETION = "GitHub installation pending deletion."
    INSTALLATION_EXISTS = "Github installed on another Sentry organization."
    USER_MISMATCH = "Authenticated user is not the same as who installed the app."
    MISSING_INTEGRATION = "Integration does not exist."
    INVALID_INSTALLATION = "User does not have access to given installation."
    FEATURE_NOT_AVAILABLE = "Your organization does not have access to this feature."


def record_event(event: IntegrationPipelineViewType):
    return IntegrationPipelineViewEvent(
        event, IntegrationDomain.SOURCE_CODE_MANAGEMENT, GitHubIntegrationProvider.key
    )


class OAuthLoginView(IntegrationPipelineViewT):
    client: GithubSetupApiClient

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipelineT) -> HttpResponseBase:
        with record_event(IntegrationPipelineViewType.OAUTH_LOGIN).capture() as lifecycle:
            self.active_user_organization = determine_active_organization(request)
            lifecycle.add_extra(
                "organization_id",
                (
                    self.active_user_organization.organization.id
                    if self.active_user_organization
                    else None
                ),
            )

            ghip = GitHubIdentityProvider()
            github_client_id = ghip.get_oauth_client_id()
            github_client_secret = ghip.get_oauth_client_secret()

            installation_id = request.GET.get("installation_id")
            if installation_id:
                pipeline.bind_state("installation_id", installation_id)

            if not request.GET.get("state"):
                state = pipeline.signature

                redirect_uri = absolute_uri(
                    reverse("sentry-extension-setup", kwargs={"provider_id": "github"})
                )
                return HttpResponseRedirect(
                    f"{ghip.get_oauth_authorize_url()}?client_id={github_client_id}&state={state}&redirect_uri={redirect_uri}"
                )

            # At this point, we are past the GitHub "authorize" step
            if request.GET.get("state") != pipeline.signature:
                lifecycle.record_failure(GitHubInstallationError.INVALID_STATE)
                return error(
                    request,
                    self.active_user_organization,
                    error_short=GitHubInstallationError.INVALID_STATE,
                )

            # similar to OAuth2CallbackView.get_token_params
            data = {
                "code": request.GET.get("code"),
                "client_id": github_client_id,
                "client_secret": github_client_secret,
            }

            # similar to OAuth2CallbackView.exchange_token
            req = safe_urlopen(url=ghip.get_oauth_access_token_url(), data=data)
            try:
                body = safe_urlread(req).decode("utf-8")
                payload = dict(parse_qsl(body))
            except Exception:
                payload = {}

            if "access_token" not in payload:
                lifecycle.record_failure(GitHubInstallationError.MISSING_TOKEN)
                return error(
                    request,
                    self.active_user_organization,
                    error_short=GitHubInstallationError.MISSING_TOKEN,
                )
            self.client = GithubSetupApiClient(access_token=payload["access_token"])
            authenticated_user_info = self.client.get_user_info()

            if self.active_user_organization is not None and features.has(
                "organizations:github-multi-org",
                organization=self.active_user_organization.organization,
            ):
                owner_orgs = self._get_owner_github_organizations()

                installation_info = self._get_eligible_multi_org_installations(
                    owner_orgs=owner_orgs
                )
                pipeline.bind_state("existing_installation_info", installation_info)

            if "login" not in authenticated_user_info:
                lifecycle.record_failure(GitHubInstallationError.MISSING_LOGIN)
                return error(
                    request,
                    self.active_user_organization,
                    error_short=GitHubInstallationError.MISSING_LOGIN,
                )
            pipeline.bind_state("github_authenticated_user", authenticated_user_info["login"])
            return pipeline.next_step()

    def _get_owner_github_organizations(self) -> list[str]:
        user_org_membership_details = self.client.get_organization_memberships_for_user()

        return [
            gh_org.get("organization", {}).get("login")
            for gh_org in user_org_membership_details
            if (
                gh_org.get("role", "").lower() == "admin"
                and gh_org.get("state", "").lower() == "active"
            )
        ]

    def _get_eligible_multi_org_installations(
        self, owner_orgs: list[str]
    ) -> list[GithubInstallationInfo]:
        installed_orgs = self.client.get_user_info_installations()

        return [
            {
                "installation_id": str(installation.get("id")),
                "github_account": installation.get("account").get("login"),
                "avatar_url": installation.get("account").get("avatar_url"),
            }
            for installation in installed_orgs["installations"]
            if (
                installation.get("account").get("login") in owner_orgs
                or installation.get("target_type") == "User"
            )
        ]


class GithubOrganizationSelection(IntegrationPipelineViewT):
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipelineT) -> HttpResponseBase:
        self.active_user_organization = determine_active_organization(request)
        has_scm_multi_org = (
            features.has(
                "organizations:integrations-scm-multi-org",
                organization=self.active_user_organization.organization,
            )
            if self.active_user_organization is not None
            else False
        )

        if self.active_user_organization is None or not features.has(
            "organizations:github-multi-org",
            organization=self.active_user_organization.organization,
        ):
            return pipeline.next_step()

        with record_event(
            IntegrationPipelineViewType.ORGANIZATION_SELECTION
        ).capture() as lifecycle:
            installation_info = pipeline.fetch_state("existing_installation_info") or []
            if len(installation_info) == 0:
                return pipeline.next_step()

            # add an option for users to install on a new GH organization
            installation_info.append(
                {
                    "installation_id": "-1",
                    "github_account": "Integrate with a new GitHub organization",
                    "avatar_url": "",
                }
            )

            if chosen_installation_id := request.GET.get("chosen_installation_id"):
                if chosen_installation_id == "-1":
                    return pipeline.next_step()

                # Validate the same org is installing and that they have the multi org feature
                installing_organization_slug = pipeline.fetch_state("installing_organization_slug")
                is_same_installing_org = (
                    (installing_organization_slug is not None)
                    and installing_organization_slug
                    == self.active_user_organization.organization.slug
                )
                if not has_scm_multi_org or not is_same_installing_org:
                    lifecycle.record_failure(GitHubInstallationError.FEATURE_NOT_AVAILABLE)
                    return error(
                        request,
                        self.active_user_organization,
                        error_short=GitHubInstallationError.FEATURE_NOT_AVAILABLE,
                    )

                # Verify that the given GH installation belongs to the person installing the pipeline
                installation_ids = [
                    installation["installation_id"] for installation in installation_info
                ]
                if chosen_installation_id not in installation_ids:
                    lifecycle.record_failure(
                        failure_reason=GitHubInstallationError.INVALID_INSTALLATION
                    )
                    return error(
                        request,
                        self.active_user_organization,
                        error_short=GitHubInstallationError.INVALID_INSTALLATION,
                        error_long=ERR_INTEGRATION_INVALID_INSTALLATION,
                    )

                pipeline.bind_state("chosen_installation", chosen_installation_id)
                return pipeline.next_step()
            pipeline.bind_state(
                "installing_organization_slug", self.active_user_organization.organization.slug
            )
            serialized_organization = organization_service.serialize_organization(
                id=self.active_user_organization.organization.id,
                as_user=(
                    serialize_rpc_user(request.user) if isinstance(request.user, User) else None
                ),
            )
            return self.render_react_view(
                request=request,
                pipeline_name="githubInstallationSelect",
                props={
                    "installation_info": installation_info,
                    "has_scm_multi_org": has_scm_multi_org,
                    "organization": serialized_organization,
                    "organization_slug": self.active_user_organization.organization.slug,
                },
            )


class GitHubInstallation(IntegrationPipelineViewT):
    def get_app_url(self) -> str:
        name = options.get("github-app.name")
        return f"https://github.com/apps/{slugify(name)}"

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipelineT) -> HttpResponseBase:
        with record_event(IntegrationPipelineViewType.GITHUB_INSTALLATION).capture() as lifecycle:
            self.active_user_organization = determine_active_organization(request)

            chosen_installation_id = pipeline.fetch_state("chosen_installation")
            if chosen_installation_id is not None:
                pipeline.bind_state("installation_id", chosen_installation_id)

            installation_id = pipeline.fetch_state("installation_id") or request.GET.get(
                "installation_id", None
            )
            if installation_id is None:
                return HttpResponseRedirect(self.get_app_url())

            pipeline.bind_state("installation_id", installation_id)

            lifecycle.add_extra(
                "organization_id",
                (
                    self.active_user_organization.organization.id
                    if self.active_user_organization is not None
                    else None
                ),
            )

            error_page = self.check_pending_integration_deletion(request=request)
            if error_page is not None:
                lifecycle.record_failure(GitHubInstallationError.PENDING_DELETION)
                return error_page

            if self.active_user_organization is not None:
                if features.has(
                    "organizations:github-multi-org",
                    organization=self.active_user_organization.organization,
                ):
                    try:
                        integration = Integration.objects.get(
                            external_id=installation_id, status=ObjectStatus.ACTIVE
                        )
                    except Integration.DoesNotExist:
                        return pipeline.next_step()

                else:
                    try:
                        # We want to limit GitHub integrations to 1 organization
                        installations_exist = OrganizationIntegration.objects.filter(
                            integration=Integration.objects.get(external_id=installation_id)
                        ).exists()
                    except Integration.DoesNotExist:
                        return pipeline.next_step()

                    if installations_exist:
                        lifecycle.record_failure(GitHubInstallationError.INSTALLATION_EXISTS)
                        return error(
                            request,
                            self.active_user_organization,
                            error_short=GitHubInstallationError.INSTALLATION_EXISTS,
                            error_long=ERR_INTEGRATION_EXISTS_ON_ANOTHER_ORG,
                        )

                    # OrganizationIntegration does not exist, but Integration does exist.
                    try:
                        integration = Integration.objects.get(
                            external_id=installation_id, status=ObjectStatus.ACTIVE
                        )
                    except Integration.DoesNotExist:
                        lifecycle.record_failure(GitHubInstallationError.MISSING_INTEGRATION)
                        return error(request, self.active_user_organization)

            # Check that the authenticated GitHub user is the same as who installed the app.
            if (
                chosen_installation_id is None
                and pipeline.fetch_state("github_authenticated_user")
                != integration.metadata["sender"]["login"]
            ):
                lifecycle.record_failure(GitHubInstallationError.USER_MISMATCH)
                return error(
                    request,
                    self.active_user_organization,
                    error_short=GitHubInstallationError.USER_MISMATCH,
                )

            return pipeline.next_step()

    def check_pending_integration_deletion(self, request: HttpRequest) -> HttpResponse | None:
        if self.active_user_organization is None:
            return None
        # We want to wait until the scheduled deletions finish or else the
        # post install to migrate repos do not work.
        integration_pending_deletion_exists = OrganizationIntegration.objects.filter(
            integration__provider=GitHubIntegrationProvider.key,
            organization_id=self.active_user_organization.organization.id,
            status=ObjectStatus.PENDING_DELETION,
        ).exists()

        if integration_pending_deletion_exists:
            return error(
                request,
                self.active_user_organization,
                error_short=GitHubInstallationError.PENDING_DELETION,
                error_long=ERR_INTEGRATION_PENDING_DELETION,
            )
        return None
