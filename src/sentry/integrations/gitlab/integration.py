from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from typing import Any
from urllib.parse import urlparse

from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _

from sentry.identity.gitlab.provider import GitlabIdentityProvider, get_oauth_data, get_user_info
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.pipeline_types import IntegrationPipelineT, IntegrationPipelineViewT
from sentry.integrations.referrer_ids import GITLAB_OPEN_PR_BOT_REFERRER, GITLAB_PR_BOT_REFERRER
from sentry.integrations.services.repository.model import RpcRepository
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
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationError,
    IntegrationProviderError,
)
from sentry.snuba.referrer import Referrer
from sentry.templatetags.sentry_helpers import small_count
from sentry.users.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.hashlib import sha1_text
from sentry.utils.http import absolute_uri
from sentry.utils.patch_set import patch_to_file_modifications
from sentry.web.helpers import render_to_response

from .client import GitLabApiClient, GitLabSetupApiClient
from .issues import GitlabIssuesSpec
from .repository import GitlabRepositoryProvider

logger = logging.getLogger("sentry.integrations.gitlab")

DESCRIPTION = """
Connect your Sentry organization to an organization in your GitLab instance or gitlab.com, enabling the following features:
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
        Resolve Sentry issues via GitLab commits and merge requests by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create GitLab issues from Sentry
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link Sentry issues to existing GitLab issues
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your GitLab source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Import your GitLab [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/gitlab/#code-owners) and use it alongside your ownership rules to assign Sentry issues.
        """,
        IntegrationFeatures.CODEOWNERS,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitLab%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitlab",
    aspects={},
)


class GitlabIntegration(RepositoryIntegration, GitlabIssuesSpec, CommitContextIntegration):
    codeowners_locations = ["CODEOWNERS", ".gitlab/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.GITLAB

    def get_client(self) -> GitLabApiClient:
        try:
            # eagerly populate this just for the error message
            self.default_identity
        except Identity.DoesNotExist:
            raise IntegrationError("Identity not found.")
        else:
            return GitLabApiClient(self)

    # IntegrationInstallation methods
    def error_message_from_json(self, data):
        """
        Extract error messages from gitlab API errors.
        Generic errors come in the `error` key while validation errors
        are generally in `message`.

        See https://docs.gitlab.com/ee/api/#data-validation-and-error-reporting
        """
        if "message" in data:
            return data["message"]
        if "error" in data:
            return data["error"]

    # RepositoryIntegration methods

    def has_repo_access(self, repo: RpcRepository) -> bool:
        # TODO: define this, used to migrate repositories
        return False

    def get_repositories(self, query: str | None = None) -> list[dict[str, Any]]:
        # Note: gitlab projects are the same things as repos everywhere else
        group = self.get_group_id()
        resp = self.get_client().search_projects(group, query)
        return [{"identifier": repo["id"], "name": repo["name_with_namespace"]} for repo in resp]

    def source_url_matches(self, url: str) -> bool:
        return url.startswith("https://{}".format(self.model.metadata["domain_name"]))

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        base_url = self.model.metadata["base_url"]
        repo_name = repo.config["path"]

        # Must format the url ourselves since `check_file` is a head request
        # "https://gitlab.com/gitlab-org/gitlab/blob/master/README.md"
        return f"{base_url}/{repo_name}/blob/{branch}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/-/blob/", "")
        url = url.replace(f"{repo.url}/blob/", "")
        branch, _, _ = url.partition("/")
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/-/blob/", "")
        url = url.replace(f"{repo.url}/blob/", "")
        _, _, source_path = url.partition("/")
        return source_path

    # CommitContextIntegration methods

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        if api_error.code == 429:
            metrics.incr(
                metrics_base.format(integration=self.integration_name, key="error"),
                tags={"type": "rate_limited_error"},
            )
            return True

        return False

    # Gitlab only functions

    def get_group_id(self):
        return self.model.metadata["group_id"]

    def search_projects(self, query):
        client = self.get_client()
        group_id = self.get_group_id()
        return client.search_projects(group_id, query)

    # TODO(cathy): define in issue ABC
    def search_issues(self, query: str | None, **kwargs) -> list[dict[str, Any]]:
        client = self.get_client()
        project_id = kwargs["project_id"]
        iids = kwargs["iids"]
        resp = client.search_project_issues(project_id, query, iids)
        assert isinstance(resp, list)
        return resp

    def get_pr_comment_workflow(self) -> PRCommentWorkflow:
        return GitlabPRCommentWorkflow(integration=self)

    def get_open_pr_comment_workflow(self) -> OpenPRCommentWorkflow:
        return GitlabOpenPRCommentWorkflow(integration=self)


MERGED_PR_COMMENT_BODY_TEMPLATE = """\
## Suspect Issues
This merge request was deployed and Sentry observed the following issues:

{issue_list}"""


class GitlabPRCommentWorkflow(PRCommentWorkflow):
    organization_option_key = "sentry:gitlab_pr_bot"
    referrer = Referrer.GITLAB_PR_COMMENT_BOT
    referrer_id = GITLAB_PR_BOT_REFERRER

    @staticmethod
    def format_comment_subtitle(subtitle: str | None) -> str:
        if subtitle is None:
            return ""
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
        return {
            "body": comment_body,
        }


OPEN_PR_COMMENT_BODY_TEMPLATE = """\
## 🔍 Existing Issues For Review
Your merge request is modifying functions with the following pre-existing issues:

{issue_tables}"""

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


class GitlabOpenPRCommentWorkflow(OpenPRCommentWorkflow):
    integration: GitlabIntegration
    organization_option_key = "sentry:gitlab_open_pr_bot"
    referrer = Referrer.GITLAB_PR_COMMENT_BOT
    referrer_id = GITLAB_OPEN_PR_BOT_REFERRER

    def safe_for_comment(self, repo: Repository, pr: PullRequest) -> list[dict[str, Any]]:
        client = self.integration.get_client()

        try:
            diffs = client.get_pr_diffs(repo=repo, pr=pr)
        except ApiError as e:
            logger.info(
                _open_pr_comment_log(
                    integration_name=self.integration.integration_name, suffix="api_error"
                )
            )
            if e.code == 404:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="api_error"
                    ),
                    tags={"type": "missing_pr", "code": e.code},
                )
            else:
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(
                        integration=self.integration.integration_name, key="api_error"
                    ),
                    tags={"type": "unknown_api_error", "code": e.code},
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
        filtered_diffs = []

        organization = Organization.objects.get_from_cache(id=repo.organization_id)
        patch_parsers = get_patch_parsers_for_organization(organization)

        for diff in diffs:
            filename = diff["new_path"]
            # we only count the file if it's modified and if the file extension is in the list of supported file extensions
            # we cannot look at deleted or newly added files because we cannot extract functions from the diffs

            if filename.split(".")[-1] not in patch_parsers:
                continue

            try:
                file_modifications = patch_to_file_modifications(diff["diff"])
            except Exception:
                logger.exception(
                    _open_pr_comment_log(
                        integration_name=self.integration.integration_name,
                        suffix="patch_parsing_error",
                    ),
                )
                continue

            if not file_modifications.modified:
                continue

            changed_file_count += len(file_modifications.modified)
            changed_lines_count += sum(
                modification.lines_modified for modification in file_modifications.modified
            )

            filtered_diffs.append(diff)

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

        return filtered_diffs

    def get_pr_files_safe_for_comment(
        self, repo: Repository, pr: PullRequest
    ) -> list[PullRequestFile]:
        pr_diffs = self.safe_for_comment(repo=repo, pr=pr)

        if len(pr_diffs) == 0:
            logger.info(
                _open_pr_comment_log(
                    integration_name=self.integration.integration_name,
                    suffix="not_safe_for_comment",
                ),
                extra={"file_count": len(pr_diffs)},
            )
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(
                    integration=self.integration.integration_name, key="error"
                ),
                tags={"type": "unsafe_for_comment"},
            )
            return []

        pr_files = [
            PullRequestFile(filename=diff["new_path"], patch=diff["diff"]) for diff in pr_diffs
        ]

        logger.info(
            _open_pr_comment_log(
                integration_name=self.integration.integration_name,
                suffix="pr_filenames",
            ),
            extra={"count": len(pr_files)},
        )

        return pr_files

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
                    url=self.format_comment_url(issue.url, GITLAB_OPEN_PR_BOT_REFERRER),
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


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_("GitLab URL"),
        help_text=_(
            "The base URL for your GitLab instance, including the host and protocol. "
            "Do not include the group path."
            "<br>"
            "If using gitlab.com, enter https://gitlab.com/"
        ),
        widget=forms.TextInput(attrs={"placeholder": "https://gitlab.example.com"}),
    )
    group = forms.CharField(
        label=_("GitLab Group Path"),
        help_text=_(
            "This can be found in the URL of your group's GitLab page."
            "<br>"
            "For example, if your group URL is "
            "https://gitlab.com/my-group/my-subgroup, enter `my-group/my-subgroup`."
            "<br>"
            "If you are trying to integrate an entire self-managed GitLab instance, "
            "leave this empty. Doing so will also allow you to select projects in "
            "all group and user namespaces (such as users' personal repositories and forks)."
        ),
        widget=forms.TextInput(attrs={"placeholder": _("my-group/my-subgroup")}),
        required=False,
    )
    include_subgroups = forms.BooleanField(
        label=_("Include Subgroups"),
        help_text=_(
            "Include projects in subgroups of the GitLab group."
            "<br>"
            "Not applicable when integrating an entire GitLab instance. "
            "All groups are included for instance-level integrations."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=False,
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates "
            "when delivering payloads to your GitLab instance, "
            "and request GitLab to verify SSL when it delivers "
            "webhooks to Sentry."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True,
    )
    client_id = forms.CharField(
        label=_("GitLab Application ID"),
        widget=forms.TextInput(
            attrs={
                "placeholder": _("5832fc6e14300a0d962240a8144466eef4ee93ef0d218477e55f11cf12fc3737")
            }
        ),
    )
    client_secret = forms.CharField(
        label=_("GitLab Application Secret"),
        widget=forms.PasswordInput(attrs={"placeholder": _("***********************")}),
    )

    def clean_url(self):
        """Strip off trailing / as they cause invalid URLs downstream"""
        return self.cleaned_data["url"].rstrip("/")


class InstallationConfigView(IntegrationPipelineViewT):
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipelineT) -> HttpResponseBase:
        if "goback" in request.GET:
            pipeline.state.step_index = 0
            return pipeline.current_step()

        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state("installation_data", form_data)

                pipeline.bind_state(
                    "oauth_config_information",
                    {
                        "access_token_url": "{}/oauth/token".format(form_data.get("url")),
                        "authorize_url": "{}/oauth/authorize".format(form_data.get("url")),
                        "client_id": form_data.get("client_id"),
                        "client_secret": form_data.get("client_secret"),
                        "verify_ssl": form_data.get("verify_ssl"),
                    },
                )
                pipeline.get_logger().info(
                    "gitlab.setup.installation-config-view.success",
                    extra={
                        "base_url": form_data.get("url"),
                        "client_id": form_data.get("client_id"),
                        "verify_ssl": form_data.get("verify_ssl"),
                    },
                )
                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/gitlab-config.html",
            context={"form": form},
            request=request,
        )


class InstallationGuideView(IntegrationPipelineViewT):
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipelineT) -> HttpResponseBase:
        if "completed_installation_guide" in request.GET:
            return pipeline.next_step()
        return render_to_response(
            template="sentry/integrations/gitlab-config.html",
            context={
                "next_url": f'{absolute_uri("/extensions/gitlab/setup/")}?completed_installation_guide',
                "setup_values": [
                    {"label": "Name", "value": "Sentry"},
                    {"label": "Redirect URI", "value": absolute_uri("/extensions/gitlab/setup/")},
                    {"label": "Scopes", "value": "api"},
                ],
            },
            request=request,
        )


class GitlabIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GITLAB.value
    name = "GitLab"
    metadata = metadata
    integration_cls = GitlabIntegration

    needs_default_identity = True

    features = frozenset(
        [
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    setup_dialog_config = {"width": 1030, "height": 1000}

    def _make_identity_pipeline_view(self) -> IntegrationPipelineViewT:
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
            oauth_scopes=sorted(GitlabIdentityProvider.oauth_scopes),
            redirect_url=absolute_uri("/extensions/gitlab/setup/"),
            **oauth_information,
        )

        return NestedPipelineView(
            bind_key="identity",
            provider_key=IntegrationProviderSlug.GITLAB.value,
            pipeline_cls=IdentityPipeline,
            config=identity_pipeline_config,
        )

    def get_group_info(self, access_token, installation_data):
        client = GitLabSetupApiClient(
            base_url=installation_data["url"],
            access_token=access_token,
            verify_ssl=installation_data["verify_ssl"],
        )

        requested_group = installation_data["group"]
        try:
            resp = client.get_group(requested_group)
            return resp.json
        except ApiError as e:
            self.get_logger().info(
                "gitlab.installation.get-group-info-failure",
                extra={
                    "base_url": installation_data["url"],
                    "verify_ssl": installation_data["verify_ssl"],
                    "group": requested_group,
                    "include_subgroups": installation_data["include_subgroups"],
                    "error_message": str(e),
                    "error_status": e.code,
                },
            )
            # We raise IntegrationProviderError to prevent a Sentry Issue from being created as this is an expected
            # error, and we just want to invoke the error message to the user.
            raise IntegrationProviderError(
                f"The requested GitLab group {requested_group} could not be found."
            )

    def get_pipeline_views(
        self,
    ) -> Sequence[IntegrationPipelineViewT | Callable[[], IntegrationPipelineViewT]]:
        return (
            InstallationGuideView(),
            InstallationConfigView(),
            lambda: self._make_identity_pipeline_view(),
        )

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        data = state["identity"]["data"]

        # Gitlab requires the client_id and client_secret for refreshing the access tokens
        oauth_config = state.get("oauth_config_information", {})
        oauth_data = {
            **get_oauth_data(data),
            "client_id": oauth_config.get("client_id"),
            "client_secret": oauth_config.get("client_secret"),
        }

        user = get_user_info(data["access_token"], state["installation_data"])
        scopes = sorted(GitlabIdentityProvider.oauth_scopes)
        base_url = state["installation_data"]["url"]

        if state["installation_data"].get("group"):
            group = self.get_group_info(data["access_token"], state["installation_data"])
            include_subgroups = state["installation_data"]["include_subgroups"]
        else:
            group = {}
            include_subgroups = False

        hostname = urlparse(base_url).netloc
        verify_ssl = state["installation_data"]["verify_ssl"]

        # Generate a hash to prevent stray hooks from being accepted
        # use a consistent hash so that reinstalls/shared integrations don't
        # rotate secrets.
        secret = sha1_text("".join([hostname, state["installation_data"]["client_id"]]))

        return {
            "name": group.get("full_name", hostname),
            # Splice the gitlab host and project together to
            # act as unique link between a gitlab instance, group + sentry.
            # This value is embedded then in the webhook token that we
            # give to gitlab to allow us to find the integration a hook came
            # from.
            "external_id": "{}:{}".format(hostname, group.get("id", "_instance_")),
            "metadata": {
                "icon": group.get("avatar_url"),
                "instance": hostname,
                "domain_name": "{}/{}".format(hostname, group.get("full_path", "")).rstrip("/"),
                "scopes": scopes,
                "verify_ssl": verify_ssl,
                "base_url": base_url,
                "webhook_secret": secret.hexdigest(),
                "group_id": group.get("id"),
                "include_subgroups": include_subgroups,
            },
            "user_identity": {
                "type": IntegrationProviderSlug.GITLAB.value,
                "external_id": "{}:{}".format(hostname, user["id"]),
                "scopes": scopes,
                "data": oauth_data,
            },
            "post_install_data": {
                "redirect_url_format": absolute_uri(
                    f"/settings/{{org_slug}}/integrations/{self.key}/"
                ),
            },
        }

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitlabRepositoryProvider, id="integrations:gitlab"
        )
