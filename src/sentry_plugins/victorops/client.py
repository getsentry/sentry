from __future__ import absolute_import

from sentry_plugins.client import ApiClient


class VictorOpsClient(ApiClient):
    monitoring_tool = "sentry"
    routing_key = "everyone"
    plugin_name = "victorops"
    allow_redirects = False

    def __init__(self, api_key, routing_key=None):
        self.api_key = api_key

        if routing_key:
            self.routing_key = routing_key
        super(VictorOpsClient, self).__init__()

    def build_url(self, path):
        # http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/
        return u"https://alert.victorops.com/integrations/generic/20131114/alert/{}/{}".format(
            self.api_key, self.routing_key
        )

    def request(self, data):
        return self._request(path="", method="post", data=data)

    def trigger_incident(
        self,
        message_type,
        entity_id,
        timestamp,
        state_message,
        entity_display_name=None,
        monitoring_tool=None,
        issue_url=None,
        **kwargs
    ):
        kwargs.update(
            {
                "message_type": message_type,
                "entity_id": entity_id,
                "entity_display_name": entity_display_name,
                "timestamp": timestamp,
                "state_message": state_message,
                "monitoring_tool": monitoring_tool or self.monitoring_tool,
                "issue_url": issue_url,
            }
        )
        return self.request(kwargs)
