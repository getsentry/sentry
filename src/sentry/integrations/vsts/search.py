from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.hybridcloud.rpc import coerce_id_from
from sentry.integrations.api.bases.integration import IntegrationEndpoint
from sentry.integrations.models.integration import Integration
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.organizations.services.organization import RpcOrganization


@control_silo_endpoint
class VstsSearchEndpoint(IntegrationEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
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
        assert isinstance(installation, VstsIntegration), installation

        if field == "externalIssue":
            if not query:
                return Response([])

            resp = installation.search_issues(query=query)
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
