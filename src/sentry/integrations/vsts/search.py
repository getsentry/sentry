from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.integration import IntegrationEndpoint
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.organization import RpcOrganization


@control_silo_endpoint
class VstsSearchEndpoint(IntegrationEndpoint):
    owner = ApiOwner.OWNERS_SNUBA
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(
        self, request: Request, organization: RpcOrganization, integration_id: int, **kwds: Any
    ) -> Response:
        try:
            integration = Integration.objects.get(
                organizationintegration__organization_id=coerce_id_from(organization),
                id=integration_id,
                provider="vsts",
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

        if field == "externalIssue":
            if not query:
                return Response([])

            resp = installation.get_client().search_issues(integration.name, query)
            return Response(
                [
                    {
                        "label": f'({i["fields"]["system.id"]}) {i["fields"]["system.title"]}',
                        "value": i["fields"]["system.id"],
                    }
                    for i in resp.get("results", [])
                ]
            )

        return Response(status=400)
