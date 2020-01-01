from __future__ import absolute_import

import six

from sentry.plugins.bases.notify import NotifyPlugin
from sentry.utils.http import absolute_uri

from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

from .client import PagerDutyClient


class PagerDutyPlugin(CorePluginMixin, NotifyPlugin):
    description = "Send alerts to PagerDuty."
    slug = "pagerduty"
    title = "PagerDuty"
    conf_key = slug
    conf_title = title

    def is_configured(self, project, **kwargs):
        return bool(self.get_option("service_key", project))

    def get_config(self, **kwargs):
        service_key = self.get_option("service_key", kwargs["project"])
        secret_field = get_secret_field_config(
            service_key, "PagerDuty's Sentry service Integration Key", include_prefix=True
        )
        secret_field.update({"name": "service_key", "label": "Service Key"})
        return [
            secret_field,
            {
                "name": "routes",
                "label": "Tag routing",
                "type": "textarea",
                "placeholder": "environment,production,KEY1\ndevice,Other,KEY2",
                "required": False,
                "help": (
                    "Route each event to a different PagerDuty service key based "
                    "on the event's tags. Each line should contain a tag, "
                    "value, and service key separated by commas. The first "
                    "line that matches a tag's key and value will send to that "
                    "integration key instead of the main service key above."
                ),
            },
        ]

    def notify_users(self, group, event, fail_silently=False, **kwargs):
        if not self.is_configured(group.project):
            return

        description = event.get_legacy_message()[:1024]

        tags = dict(event.tags)
        details = {
            "event_id": event.event_id,
            "project": group.project.name,
            "release": event.get_tag("sentry:release"),
            "platform": event.platform,
            "culprit": event.culprit,
            "datetime": event.datetime.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "tags": tags,
            "url": group.get_absolute_url(params={"referrer": "pagerduty_plugin"}),
        }

        service_key = self.get_option("service_key", group.project)

        routes = self.get_option("routes", group.project) or ""
        for route in (r.strip() for r in routes.split("\n")):
            fields = [f.strip() for f in route.split(",")]
            if len(fields) != 3:
                continue
            tag_key, tag_value, route_service_key = fields
            if tag_key in tags and tags[tag_key] == tag_value:
                service_key = route_service_key
                break

        client = PagerDutyClient(service_key=service_key)
        try:
            response = client.trigger_incident(
                description=description,
                event_type="trigger",
                incident_key=six.text_type(group.id),
                details=details,
                contexts=[
                    {
                        "type": "link",
                        "href": absolute_uri(
                            group.get_absolute_url(params={"referrer": "pagerduty_plugin"})
                        ),
                        "text": "Issue Details",
                    }
                ],
            )
            assert response["status"] == "success"
        except Exception as e:
            self.raise_error(e)
