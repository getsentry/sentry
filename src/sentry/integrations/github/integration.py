from __future__ import absolute_import

import re
from django.utils.text import slugify
from django.utils.translation import ugettext_lazy as _

from sentry import http, options

from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.integrations.repositories import RepositoryMixin
from sentry.models import Repository
from sentry.pipeline import PipelineView
from sentry.tasks.integrations import migrate_repo

from .client import GitHubAppsClient
from .issues import GitHubIssueBasic
from .repository import GitHubRepositoryProvider
from .utils import get_jwt


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
        Sentry bug to tracked issue or PR!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
]


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github",
    aspects={},
)

API_ERRORS = {
    404: "If this repository exists, ensure"
    " that your installation has permission to access this repository"
    " (https://github.com/settings/installations).",
    401: ERR_UNAUTHORIZED,
}


def build_repository_query(metadata, name, query):
    account_type = "user" if metadata["account_type"] == "User" else "org"
    return (u"%s:%s %s" % (account_type, name, query)).encode("utf-8")


class GitHubIntegration(IntegrationInstallation, GitHubIssueBasic, RepositoryMixin):
    repo_search = True

    def get_client(self):
        return GitHubAppsClient(integration=self.model)

    def get_repositories(self, query=None):
        if not query:
            return [
                {"name": i["name"], "identifier": i["full_name"]}
                for i in self.get_client().get_repositories()
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {"name": i["name"], "identifier": i["full_name"]} for i in response.get("items", [])
        ]

    def search_issues(self, query):
        return self.get_client().search_issues(query)

    def get_stacktrace_link(self, repo, filepath, default_version):
        try:
            resp = self.get_client().get_file_url(repo.name, filepath)
        except ApiError as e:
            if e.code != 404:
                raise
            return

        # if it exists return the url
        return resp["html_url"]

    def get_unmigratable_repositories(self):
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r["identifier"] for r in accessible_repos]

        existing_repos = Repository.objects.filter(
            organization_id=self.organization_id, provider="github"
        )

        return [repo for repo in existing_repos if repo.name not in accessible_repo_names]

    def reinstall(self):
        self.reinstall_repositories()

    def message_from_error(self, exc):
        if isinstance(exc, ApiError):
            message = API_ERRORS.get(exc.code)
            if exc.code == 404 and re.search(r"/repos/.*/(compare|commits)", exc.url):
                message += (
                    " Please also confirm that the commits associated with the following URL have been pushed to GitHub: %s"
                    % exc.url
                )

            if message is None:
                message = exc.json.get("message", "unknown error") if exc.json else "unknown error"
            return "Error Communicating with GitHub (HTTP %s): %s" % (exc.code, message)
        else:
            return ERR_INTERNAL

    def has_repo_access(self, repo):
        client = self.get_client()
        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicitly ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://developer.github.com/v3/repos/hooks/#list-hooks
            client.repo_hooks(repo.config["name"])
        except ApiError:
            return False
        return True


class GitHubIntegrationProvider(IntegrationProvider):
    key = "github"
    name = "GitHub"
    metadata = metadata
    integration_cls = GitHubIntegration
    features = frozenset([IntegrationFeatures.COMMITS, IntegrationFeatures.ISSUE_BASIC])

    setup_dialog_config = {"width": 1030, "height": 1000}

    def post_install(self, integration, organization, extra=None):
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider__in=["github", "integrations:github"],
            integration_id__isnull=True,
        ).values_list("id", flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo_id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

    def get_pipeline_views(self):
        return [GitHubInstallationRedirect()]

    def get_installation_info(self, installation_id):
        session = http.build_session()
        resp = session.get(
            "https://api.github.com/app/installations/%s" % installation_id,
            headers={
                "Authorization": "Bearer %s" % get_jwt(),
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
        )
        resp.raise_for_status()
        installation_resp = resp.json()

        return installation_resp

    def build_integration(self, state):
        installation = self.get_installation_info(state["installation_id"])

        integration = {
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
            },
        }

        if state.get("reinstall_id"):
            integration["reinstall_id"] = state["reinstall_id"]

        return integration

    def setup(self):
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )


class GitHubInstallationRedirect(PipelineView):
    def get_app_url(self):
        name = options.get("github-app.name")
        return "https://github.com/apps/%s" % slugify(name)

    def dispatch(self, request, pipeline):
        if "reinstall_id" in request.GET:
            pipeline.bind_state("reinstall_id", request.GET["reinstall_id"])

        if "installation_id" in request.GET:
            pipeline.bind_state("installation_id", request.GET["installation_id"])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
