import uuid

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.models.organization import Organization
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance


@region_silo_endpoint
class OrganizationReplayDetailsEndpoint(OrganizationEndpoint):
    """
    The same data as ProjectReplayDetails, except no project is required.
    This works as we'll query for this replay_id across all projects in the
    organization that the user has access to.
    """

    def get(self, request: Request, organization: Organization, replay_id: str) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(
                request, organization, project_ids=ALL_ACCESS_PROJECTS
            )
        except NoProjects:
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        snuba_response = query_replay_instance(
            project_id=filter_params["project_id"],
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            tenant_ids={"organization_id": organization.id},
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        if len(response) == 0:
            return Response(status=404)
        else:
            return Response({"data": response[0]}, status=200)
