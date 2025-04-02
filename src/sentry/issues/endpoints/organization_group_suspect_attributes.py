from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint

# from sentry.api.helpers.environments import get_environments
from sentry.issues.suspect_flags import get_suspect_flag_scores
from sentry.models.group import Group


@region_silo_endpoint
class OrganizationGroupSuspectAttributesEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, group: Group) -> Response:
        """Stats bucketed by time."""
        # environments = [e.id for e in get_environments(request, group.organization)]
        group_id = group.id
        organization_id = group.organization_id
        project_id = group.project_id
        start, end = group.first_seen, group.last_seen

        return Response(
            {
                "data": [
                    {"flag": score[0], "score": score[1]}
                    for score in get_suspect_flag_scores(
                        organization_id,
                        project_id,
                        start,
                        end,
                        group_id,
                    )
                ]
            },
            status=200,
        )
