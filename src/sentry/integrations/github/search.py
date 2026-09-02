from typing import TypeVar

from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.exceptions import InvalidIdentity
from sentry.integrations.github.integration import GitHubIntegration, build_repository_query
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionType,
    SourceCodeSearchEndpointHaltReason,
)
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

T = TypeVar("T", bound=SourceCodeIssueIntegration)

PAGE_LIMIT = 1


@control_silo_endpoint
class GithubSharedSearchEndpoint(SourceCodeSearchEndpoint):
    """NOTE: This endpoint is a shared search endpoint for Github and Github Enterprise integrations."""

    @property
    def repository_field(self) -> str:
        return "repo"

    @property
    def integration_provider(self):
        return None

    @property
    def installation_class(self):
        return (GitHubIntegration, GitHubEnterpriseIntegration)

    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES,
            organization_id=installation.organization_id,
            integration_id=installation.org_integration.integration_id,
        ).capture() as lifecycle:
            assert repo

            try:
                response = installation.search_issues(query=f"repo:{repo} {query}")
            except ApiError as err:
                if err.code == 403:
                    lifecycle.record_halt(str(SourceCodeSearchEndpointHaltReason.RATE_LIMITED))
                    return Response({"detail": "Rate limit exceeded"}, status=429)
                raise

            assert isinstance(response, dict)
            return Response(
                [
                    {"label": "#{} {}".format(i["number"], i["title"]), "value": i["number"]}
                    for i in response.get("items", [])
                ]
            )

    def handle_search_repositories(
        self, integration: Integration, installation: T, query: str
    ) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_REPOSITORIES,
            organization_id=installation.organization_id,
            integration_id=integration.id,
        ).capture() as lifecycle:
            assert isinstance(installation, self.installation_class)

            try:
                if not query:
                    repositories = installation.get_repositories(page_number_limit=PAGE_LIMIT)
                    return Response(
                        [
                            {"label": repository["name"], "value": repository["identifier"]}
                            for repository in repositories
                        ]
                    )

                full_query = build_repository_query(integration.metadata, integration.name, query)
                response = installation.get_client().search_repositories(full_query)
            except ApiError as err:
                if err.code in {403, 429}:
                    lifecycle.record_halt(str(SourceCodeSearchEndpointHaltReason.RATE_LIMITED))
                    return Response({"detail": "Rate limit exceeded"}, status=429)
                if err.code == 422:
                    lifecycle.record_halt(
                        str(SourceCodeSearchEndpointHaltReason.MISSING_REPOSITORY_OR_NO_ACCESS)
                    )
                    return Response(
                        {
                            "detail": "Repositories could not be searched because they do not exist, or you do not have access to them."
                        },
                        status=404,
                    )
                raise
            return Response(
                [{"label": i["name"], "value": i["full_name"]} for i in response.get("items", [])]
            )

    def handle_search_field(
        self, installation: T, field: str, query: str, repo: str | None
    ) -> Response | None:
        if field not in {"assignee", "labels"}:
            return None
        if not repo:
            return Response([])
        if repo.count("/") != 1:
            return Response({"detail": "Invalid repository"}, status=400)

        assert isinstance(installation, self.installation_class)
        try:
            if not query:
                # TODO: Use GraphQL for preloads after validating these queries across supported
                # GHES versions.
                if field == "assignee":
                    choices = installation.get_allowed_assignees(repo, PAGE_LIMIT)
                else:
                    owner, repo_name = repo.split("/", 1)
                    choices = installation.get_repo_labels(owner, repo_name, PAGE_LIMIT)
            elif field == "assignee":
                choices = installation.search_allowed_assignees(repo, query)
            else:
                choices = installation.search_repo_labels(repo, query)
        except (IntegrationError, InvalidIdentity) as error:
            if installation.is_broken_integration_error(error) == "rate_limited":
                return Response({"detail": "Rate limit exceeded"}, status=429)
            return Response({"detail": "Unable to fetch options from GitHub"}, status=400)

        return Response([{"label": label, "value": value} for value, label in choices])
