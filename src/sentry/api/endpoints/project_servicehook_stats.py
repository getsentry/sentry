from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.tsdb.base import TSDBModel


@region_silo_endpoint
class ProjectServiceHookStatsEndpoint(ProjectEndpoint, StatsMixin):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, hook_id) -> Response:
        try:
            hook = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist

        stat_args = self._parse_args(request)

        stats: dict[int, dict[str, int]] = {}
        for model, name in ((TSDBModel.servicehook_fired, "total"),):
            result = tsdb.backend.get_range(
                model=model,
                keys=[hook.id],
                **stat_args,
                tenant_ids={"organization_id": project.organization_id},
            )[hook.id]
            for ts, count in result:
                stats.setdefault(int(ts), {})[name] = count

        return self.respond([{"ts": ts, "total": data["total"]} for ts, data in stats.items()])
