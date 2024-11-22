from typing import TypeVar

from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import SCMIntegrationInteractionType
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.integrations.vsts.integration import VstsIntegration

T = TypeVar("T", bound=SourceCodeIssueIntegration)


@control_silo_endpoint
class VstsSearchEndpoint(SourceCodeSearchEndpoint):
    @property
    def integration_provider(self):
        return "vsts"

    @property
    def installation_class(self):
        return VstsIntegration

    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        with self.record_event(SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES).capture():
            if not query:
                return Response([])

            assert isinstance(installation, self.installation_class)
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
