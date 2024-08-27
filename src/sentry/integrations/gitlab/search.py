from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.gitlab.integration import GitlabIntegration
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.shared_integrations.exceptions import ApiError


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

    def handle_search_issues(
        self, installation: IssueBasicIntegration, query: str, repo: str
    ) -> Response:
        try:
            iids = [int(query)]
            query = None
        except ValueError:
            iids = None

        try:
            response = installation.search_issues(query=query, project_id=repo, iids=iids)
        except ApiError as e:
            return Response({"detail": str(e)}, status=400)

        return Response(
            [
                {
                    "label": "(#{}) {}".format(i["iid"], i["title"]),
                    "value": "{}#{}".format(i["project_id"], i["iid"]),
                }
                for i in response
            ]
        )

    # TODO: somehow type installation with installation_class
    def handle_search_repositories(
        self, integration: Integration, installation, query: str
    ) -> Response:
        try:
            response = installation.search_projects(query)
        except ApiError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(
            [
                {"label": project["name_with_namespace"], "value": project["id"]}
                for project in response
            ]
        )
