from __future__ import absolute_import

import logging

from sentry import tsdb, ratelimits
from sentry.api.serializers import serialize
from sentry.plugins.base import Plugin
from sentry.plugins.base.configuration import react_plugin_config
from sentry.plugins.status import PluginStatus

logger = logging.getLogger(__name__)


class DataForwardingPlugin(Plugin):
    status = PluginStatus.BETA

    def configure(self, project, request):
        return react_plugin_config(self, project, request)

    def has_project_conf(self):
        return True

    def get_rate_limit(self):
        # number of requests, number of seconds (window)
        return (50, 1)

    def forward_event(self, payload):
        """
        Forward the event and return a boolean if it was successful.
        """
        raise NotImplementedError

    def get_event_payload(self, event):
        return serialize(event)

    def get_plugin_type(self):
        return "data-forwarding"

    def post_process(self, event, **kwargs):
        rl_key = u"{}:{}".format(self.conf_key, event.project.organization_id)
        # limit segment to 50 requests/second
        limit, window = self.get_rate_limit()
        if limit and window and ratelimits.is_limited(rl_key, limit=limit, window=window):
            logger.info(
                "data_forwarding.skip_rate_limited",
                extra={
                    "event_id": event.event_id,
                    "issue_id": event.group_id,
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                },
            )
            return

        payload = self.get_event_payload(event)
        success = self.forward_event(event, payload)
        if success is False:
            # TODO(dcramer): record failure
            pass
        tsdb.incr(tsdb.models.project_total_forwarded, event.project.id, count=1)
