from typing import Any

from bs4 import BeautifulSoup
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.integration import IntegrationEndpoint
from sentry.integrations.jira_server.integration import JiraServerIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization import RpcOrganization
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError

from .utils import build_user_choice


@control_silo_endpoint
class JiraServerSearchEndpoint(IntegrationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    provider = IntegrationProviderSlug.JIRA_SERVER.value

    def _get_integration(self, organization, integration_id) -> Integration:
        return Integration.objects.get(
            organizationintegration__organization_id=organization.id,
            id=integration_id,
            provider=self.provider,
        )

    def get(
        self, request: Request, organization: RpcOrganization, integration_id: int, **kwds: Any
    ) -> Response:
        try:
            integration = self._get_integration(organization, integration_id)
        except Integration.DoesNotExist:
            return Response(status=404)
        installation = integration.get_installation(organization.id)

        assert isinstance(installation, JiraServerIntegration), installation
        jira_client = installation.get_client()

        field = request.GET.get("field")
        query = request.GET.get("query")

        if field is None:
            return Response({"detail": "field is a required parameter"}, status=400)
        if not query:
            return Response({"detail": "query is a required parameter"}, status=400)

        if field in ("externalIssue", "parent"):
            if not query:
                return Response([])
            try:
                resp = installation.search_issues(query)
            except IntegrationError as e:
                return Response({"detail": str(e)}, status=400)
            return Response(
                [
                    {"label": "({}) {}".format(i["key"], i["fields"]["summary"]), "value": i["key"]}
                    for i in resp.get("issues", [])
                ]
            )

        if field in ("assignee", "reporter"):
            try:
                response = jira_client.search_users_for_project(
                    request.GET.get("project", ""), query
                )
            except (ApiUnauthorized, ApiError):
                return Response({"detail": "Unable to fetch users from Jira"}, status=400)

            user_tuples = filter(
                None, [build_user_choice(user, jira_client.user_id_field()) for user in response]
            )
            users = [{"value": user_id, "label": display} for user_id, display in user_tuples]
            return Response(users)

        try:
            response = jira_client.get_field_autocomplete(name=field, value=query)
        except (ApiUnauthorized, ApiError):
            return Response(
                {"detail": f"Unable to fetch autocomplete for {field} from Jira"},
                status=400,
            )
        choices = [
            {
                "value": result["value"],
                # Jira's response will highlight the matching substring in the name using HTML formatting.
                "label": BeautifulSoup(result["displayName"], "html.parser").get_text(),
            }
            for result in response["results"]
        ]
        return Response(choices)
