from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, StatsMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.tsdb.base import TSDBModel
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class ProjectGroupStatsEndpoint(ProjectEndpoint, EnvironmentMixin, StatsMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=20, window=1),
            RateLimitCategory.USER: RateLimit(limit=20, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1),
        }
    }

    def get(self, request: Request, project: Project) -> Response:
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        group_id_strs = request.GET.getlist("id")
        if not group_id_strs:
            return Response(status=204)

        group_list = Group.objects.filter(project=project, id__in=group_id_strs)
        group_ids = [g.id for g in group_list]

        if not group_ids:
            return Response(status=204)

        data = tsdb.backend.get_range(
            model=TSDBModel.group,
            keys=group_ids,
            **self._parse_args(request, environment_id),
            tenant_ids={"organization_id": project.organization_id},
        )

        return Response({str(k): v for k, v in data.items()})
