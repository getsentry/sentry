from typing import TypeVar

from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.gitlab.integration import GitlabIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import SCMIntegrationInteractionType
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.shared_integrations.exceptions import ApiError

T = TypeVar("T", bound=SourceCodeIssueIntegration)


@control_silo_endpoint
class GitlabIssueSearchEndpoint(SourceCodeSearchEndpoint):
    @property
    def repository_field(self):
        return "project"

    @property
    def integration_provider(self):
        return "gitlab"

    @property
    def installation_class(self):
        return GitlabIntegration

    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES
        ).capture() as lifecycle:
            assert repo

            full_query: str | None = query

            try:
                iids = [int(query)]
                full_query = None
            except ValueError:
                iids = None

            try:
                response = installation.search_issues(query=full_query, project_id=repo, iids=iids)
            except ApiError as e:
                lifecycle.record_failure(e)
                return Response({"detail": str(e)}, status=400)

            assert isinstance(response, list)
            return Response(
                [
                    {
                        "label": "(#{}) {}".format(i["iid"], i["title"]),
                        "value": "{}#{}".format(i["project_id"], i["iid"]),
                    }
                    for i in response
                ]
            )

    def handle_search_repositories(
        self, integration: Integration, installation: T, query: str
    ) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_REPOSITORIES
        ).capture() as lifecyle:
            assert isinstance(installation, self.installation_class)
            try:
                response = installation.search_projects(query)
            except ApiError as e:
                lifecyle.record_failure(e)
                return Response({"detail": str(e)}, status=400)
            return Response(
                [
                    {"label": project["name_with_namespace"], "value": project["id"]}
                    for project in response
                ]
            )
