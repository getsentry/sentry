from __future__ import absolute_import

from sentry.api.bases.monitor import MonitorEndpoint
from sentry.api.serializers import serialize


class MonitorDetailsEndpoint(MonitorEndpoint):
    def get(self, request, project, monitor):
        """
        Retrieve a monitor
        ``````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        return self.respond(serialize(monitor, request.user))
