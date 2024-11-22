from typing import TypeVar

from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.github.integration import GitHubIntegration, build_repository_query
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionType,
    SourceCodeSearchEndpointHaltReason,
)
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.shared_integrations.exceptions import ApiError

T = TypeVar("T", bound=SourceCodeIssueIntegration)


@control_silo_endpoint
class GithubSharedSearchEndpoint(SourceCodeSearchEndpoint):
    """NOTE: This endpoint is a shared search endpoint for Github and Github Enterprise integrations."""

    @property
    def repository_field(self):
        return "repo"

    @property
    def integration_provider(self):
        return None

    @property
    def installation_class(self):
        return (GitHubIntegration, GitHubEnterpriseIntegration)

    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES
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
            SCMIntegrationInteractionType.HANDLE_SEARCH_REPOSITORIES
        ).capture() as lifecyle:
            assert isinstance(installation, self.installation_class)

            full_query = build_repository_query(integration.metadata, integration.name, query)
            try:
                response = installation.get_client().search_repositories(full_query)
            except ApiError as err:
                if err.code == 403:
                    lifecyle.record_halt(str(SourceCodeSearchEndpointHaltReason.RATE_LIMITED))
                    return Response({"detail": "Rate limit exceeded"}, status=429)
                if err.code == 422:
                    lifecyle.record_halt(
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
