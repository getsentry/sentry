from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.integration import IntegrationEndpoint
from sentry.integrations.github.integration import GitHubIntegration, build_repository_query
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.models.integration import Integration
from sentry.organizations.services.organization import RpcOrganization
from sentry.shared_integrations.exceptions import ApiError


@control_silo_endpoint
class GithubSharedSearchEndpoint(IntegrationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """NOTE: This endpoint is a shared search endpoint for Github and Github Enterprise integrations."""

    def get(
        self, request: Request, organization: RpcOrganization, integration_id: int, **kwds: Any
    ) -> Response:
        try:
            integration = Integration.objects.get(
                organizationintegration__organization_id=organization.id,
                id=integration_id,
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get("field")
        query = request.GET.get("query")
        if field is None:
            return Response({"detail": "field is a required parameter"}, status=400)
        if not query:
            return Response({"detail": "query is a required parameter"}, status=400)

        installation = integration.get_installation(organization.id)
        assert isinstance(
            installation, (GitHubIntegration, GitHubEnterpriseIntegration)
        ), installation
        if field == "externalIssue":
            repo = request.GET.get("repo")
            if repo is None:
                return Response({"detail": "repo is a required parameter"}, status=400)

            try:
                response = installation.search_issues(query=f"repo:{repo} {query}")
            except ApiError as err:
                if err.code == 403:
                    return Response({"detail": "Rate limit exceeded"}, status=429)
                raise
            return Response(
                [
                    {"label": "#{} {}".format(i["number"], i["title"]), "value": i["number"]}
                    for i in response.get("items", [])
                ]
            )

        if field == "repo":
            full_query = build_repository_query(integration.metadata, integration.name, query)
            try:
                response = installation.get_client().search_repositories(full_query)
            except ApiError as err:
                if err.code == 403:
                    return Response({"detail": "Rate limit exceeded"}, status=429)
                if err.code == 422:
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

        return Response(status=400)
