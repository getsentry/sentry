from rest_framework.response import Response

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.models import Integration


class VstsSearchEndpoint(IntegrationEndpoint):
    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization, id=integration_id, provider="vsts"
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
                        "label": "(%s) %s"
                        % (i["fields"]["system.id"], i["fields"]["system.title"]),
                        "value": i["fields"]["system.id"],
                    }
                    for i in resp.get("results", [])
                ]
            )

        return Response(status=400)
