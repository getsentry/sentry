import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.integration import IntegrationEndpoint
from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration.service import integration_service
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket")


@control_silo_endpoint
class BitbucketSearchEndpoint(IntegrationEndpoint):
    def get(self, request: Request, organization, integration_id, **kwds) -> Response:
        try:
            integration = Integration.objects.get(
                organizationintegration__organization_id=organization.id,
                id=integration_id,
                provider="bitbucket",
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get("field")
        query = request.GET.get("query")
        if field is None:
            return Response({"detail": "field is a required parameter"}, status=400)
        if not query:
            return Response({"detail": "query is a required parameter"}, status=400)

        installation: BitbucketIntegration = integration_service.get_installation(
            integration=integration, organization_id=organization.id
        )  # type: ignore

        if field == "externalIssue":
            repo = request.GET.get("repo")
            if not repo:
                return Response({"detail": "repo is a required parameter"}, status=400)

            full_query = f'title~"{query}"'
            try:
                resp = installation.get_client().search_issues(repo, full_query)
            except ApiError as e:
                if "no issue tracker" in str(e):
                    logger.info(
                        "bitbucket.issue-search-no-issue-tracker",
                        extra={"installation_id": installation.model.id, "repo": repo},
                    )
                    return Response(
                        {"detail": "Bitbucket Repository has no issue tracker."}, status=400
                    )
                raise e
            return Response(
                [
                    {"label": "#{} {}".format(i["id"], i["title"]), "value": i["id"]}
                    for i in resp.get("values", [])
                ]
            )

        if field == "repo":

            result = installation.get_repositories(query)
            return Response([{"label": i["name"], "value": i["name"]} for i in result])

        return Response(status=400)
