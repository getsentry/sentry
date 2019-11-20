from __future__ import absolute_import

import six

from sentry.exceptions import PluginError
from sentry.plugins.bases.notify import NotifyPlugin

from sentry_plugins.base import CorePluginMixin
from sentry_plugins.exceptions import ApiError
from sentry_plugins.utils import get_secret_field_config

from .client import VictorOpsClient

ENHANCED_PRIVACY_BODY = """
Details about this issue are not shown in this notification since enhanced
privacy controls are enabled. For more details about this issue, view this
issue on Sentry.
""".strip()


class VictorOpsPlugin(CorePluginMixin, NotifyPlugin):
    description = "Send alerts to VictorOps."
    slug = "victorops"
    title = "VictorOps"
    conf_key = slug
    conf_title = title

    def is_configured(self, project, **kwargs):
        return bool(self.get_option("api_key", project))

    def get_config(self, **kwargs):
        return [
            get_secret_field_config(
                name="api_key",
                label="API Key",
                secret=self.get_option("api_key", kwargs["project"]),
                help_text="VictorOps's Sentry API Key",
                include_prefix=True,
            ),
            {
                "name": "routing_key",
                "label": "Routing Key",
                "type": "string",
                "default": "everyone",
                "required": False,
            },
        ]

    def get_client(self, project):
        return VictorOpsClient(
            api_key=self.get_option("api_key", project),
            routing_key=self.get_option("routing_key", project),
        )

    def build_description(self, event):
        enhanced_privacy = event.organization.flags.enhanced_privacy
        if enhanced_privacy:
            return ENHANCED_PRIVACY_BODY

        interface_list = []
        for interface in six.itervalues(event.interfaces):
            body = interface.to_string(event)
            if not body:
                continue
            interface_list.append((interface.get_title(), body))

        return u"\n\n".join((u"{}\n-----------\n\n{}".format(k, v) for k, v in interface_list))

    def notify_users(self, group, event, fail_silently=False, **kwargs):
        if not self.is_configured(group.project):
            return

        level = event.get_tag("level")
        if level in ("info", "debug"):
            message_type = "INFO"
        if level == "warning":
            message_type = "WARNING"
        else:
            message_type = "CRITICAL"

        client = self.get_client(group.project)
        try:
            response = client.trigger_incident(
                message_type=message_type,
                entity_id=group.id,
                entity_display_name=event.title,
                state_message=self.build_description(event),
                timestamp=int(event.datetime.strftime("%s")),
                issue_url=group.get_absolute_url(),
                issue_id=group.id,
                project_id=group.project.id,
            )
        except ApiError as e:
            message = "Could not communicate with victorops. Got %s" % e
            raise PluginError(message)

        assert response["result"] == "success"
