from collections import OrderedDict

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ServiceHook


class ProjectServiceHookStatsEndpoint(ProjectEndpoint, StatsMixin):
    def get(self, request, project, hook_id):
        try:
            hook = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist

        stat_args = self._parse_args(request)

        stats = OrderedDict()
        for model, name in ((tsdb.models.servicehook_fired, "total"),):
            result = tsdb.get_range(model=model, keys=[hook.id], **stat_args)[hook.id]
            for ts, count in result:
                stats.setdefault(int(ts), {})[name] = count

        return self.respond([{"ts": ts, "total": data["total"]} for ts, data in stats.items()])
