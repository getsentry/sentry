from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.deprecation import deprecated
from sentry.api.helpers.environments import get_environment_id
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.environment import Environment
from sentry.tsdb.base import TSDBModel


@region_silo_endpoint
class GroupStatsEndpoint(GroupEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-stats"])
    def get(self, request: Request, group) -> Response:
        try:
            environment_id = get_environment_id(request, group.project.organization_id)
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        data = tsdb.backend.get_range(
            model=TSDBModel.group,
            keys=[group.id],
            **self._parse_args(request, environment_id),
            tenant_ids={"organization_id": group.project.organization_id},
        )[group.id]

        return Response(data)
