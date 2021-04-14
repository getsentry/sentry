import logging

from rest_framework.response import Response

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket")


class BitbucketSearchEndpoint(IntegrationEndpoint):
    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization, id=integration_id, provider="bitbucket"
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
            repo = request.GET.get("repo")
            if not repo:
                return Response({"detail": "repo is a required parameter"}, status=400)

            full_query = ('title~"%s"' % (query)).encode("utf-8")
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
