import logging
from typing import TypeVar

from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionType,
    SourceCodeSearchEndpointHaltReason,
)
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket")

T = TypeVar("T", bound=SourceCodeIssueIntegration)


@control_silo_endpoint
class BitbucketSearchEndpoint(SourceCodeSearchEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @property
    def repository_field(self):
        return "repo"

    @property
    def integration_provider(self):
        return "bitbucket"

    @property
    def installation_class(self):
        return BitbucketIntegration

    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES
        ).capture() as lifecycle:
            assert repo

            full_query = f'title~"{query}"'
            try:
                response = installation.search_issues(query=full_query, repo=repo)
            except ApiError as e:
                if "no issue tracker" in str(e):
                    lifecycle.record_halt(str(SourceCodeSearchEndpointHaltReason.NO_ISSUE_TRACKER))
                    logger.info(
                        "bitbucket.issue-search-no-issue-tracker",
                        extra={"installation_id": installation.model.id, "repo": repo},
                    )
                    return Response(
                        {"detail": "Bitbucket Repository has no issue tracker."}, status=400
                    )
                raise

            assert isinstance(response, dict)
            return Response(
                [
                    {"label": "#{} {}".format(i["id"], i["title"]), "value": i["id"]}
                    for i in response.get("values", [])
                ]
            )

    def handle_search_repositories(
        self, integration: Integration, installation: T, query: str
    ) -> Response:
        with self.record_event(SCMIntegrationInteractionType.HANDLE_SEARCH_REPOSITORIES).capture():
            result = installation.get_repositories(query)
            return Response([{"label": i["name"], "value": i["name"]} for i in result])
