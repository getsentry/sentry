from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.integrations.vsts.integration import VstsIntegration


@control_silo_endpoint
class VstsSearchEndpoint(SourceCodeSearchEndpoint):
    @property
    def integration_provider(self):
        return "vsts"

    @property
    def installation_class(self):
        return VstsIntegration

    def handle_search_issues(self, installation, query: str, repo: str) -> Response:
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
