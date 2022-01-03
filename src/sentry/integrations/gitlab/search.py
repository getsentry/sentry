from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError


class GitlabIssueSearchEndpoint(IntegrationEndpoint):
    def get(self, request: Request, organization, integration_id) -> Response:
        try:
            integration = Integration.objects.get(
                organizations=organization, id=integration_id, provider="gitlab"
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get("field")
        query = request.GET.get("query")
        if field is None:
            return Response({"detail": "field is a required parameter"}, status=400)
        if query is None:
            return Response({"detail": "query is a required parameter"}, status=400)

        installation = integration.get_installation(organization.id)

        if field == "externalIssue":
            project = request.GET.get("project")
            if project is None:
                return Response({"detail": "project is a required parameter"}, status=400)
            try:
                iids = [int(query)]
                query = None
            except ValueError:
                iids = None

            try:
                response = installation.search_issues(query=query, project_id=project, iids=iids)
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

        elif field == "project":
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

        return Response({"detail": "invalid field value"}, status=400)
