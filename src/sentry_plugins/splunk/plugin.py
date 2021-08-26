"""
- Turn on HTTP Event Collector by enabling its endpoint. HEC is not enabled by default.
  - http://dev.splunk.com/view/event-collector/SP-CAAAE7F
  - Settings > Data Inputs > HTTP Event Collector > Add new
    - Name: Sentry
  - You'll be given an HEC token, which is needed to configure Sentry.
- On the client that will log to HEC, create a POST request, and set its authentication header or key/value pair to include the HEC token.
- POST data to the HEC token receiver.

Note: Managed Splunk Cloud customers can turn on HTTP Event Collector by filing a request ticket with Splunk Support.
Note: Managed Splunk Cloud customers can create a HEC token by filing a request ticket with Splunk Support.

For more details on the payload: http://dev.splunk.com/view/event-collector/SP-CAAAE6M
"""


import logging

from sentry import tagstore
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.data_forwarding import DataForwardingPlugin
from sentry.shared_integrations.exceptions import ApiError, ApiHostError, ApiTimeoutError
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry_plugins.anonymizeip import anonymize_ip
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

from .client import SplunkApiClient

logger = logging.getLogger(__name__)

SETUP_URL = "https://github.com/getsentry/sentry/blob/master/src/sentry_plugins/splunk/Splunk_Instructions.rst"

DESCRIPTION = """
Send Sentry events to Splunk.
"""


class SplunkPlugin(CorePluginMixin, DataForwardingPlugin):
    title = "Splunk"
    slug = "splunk"
    description = DESCRIPTION
    conf_key = "splunk"
    resource_links = [("Splunk Setup Instructions", SETUP_URL)] + CorePluginMixin.resource_links
    required_field = "instance"
    project_token = None
    project_index = None
    project_source = None
    project_instance = None
    host = None
    feature_descriptions = [
        FeatureDescription(
            """
            Forward Sentry errors and events to Splunk.
            """,
            IntegrationFeatures.DATA_FORWARDING,
        )
    ]

    def get_rate_limit(self):
        # number of requests, number of seconds (window)
        return (1000, 1)

    def get_client(self):
        return SplunkApiClient(self.project_instance, self.project_token)

    def get_config(self, project, **kwargs):
        return [
            {
                "name": "instance",
                "label": "Instance URL",
                "type": "url",
                "required": True,
                "help": "The HTTP Event Collector endpoint for your Splunk instance.",
                "placeholder": "e.g. https://input-foo.cloud.splunk.com:8088",
            },
            {
                "name": "index",
                "label": "Index",
                "type": "string",
                "required": True,
                "default": "main",
            },
            {
                "name": "source",
                "label": "Source",
                "type": "string",
                "required": True,
                "default": "sentry",
            },
            get_secret_field_config(
                name="token", label="Token", secret=self.get_option("token", project)
            ),
        ]

    def get_host_for_splunk(self, event):
        host = event.get_tag("server_name")
        if host:
            return host

        user_interface = event.interfaces.get("sentry.interfaces.User")
        if user_interface:
            host = user_interface.ip_address
            if host:
                return host

        return None

    def get_event_payload_properties(self, event):
        props = {
            "event_id": event.event_id,
            "issue_id": event.group_id,
            "project_id": event.project.slug,
            "transaction": event.get_tag("transaction") or "",
            "release": event.get_tag("sentry:release") or "",
            "environment": event.get_tag("environment") or "",
            "type": event.get_event_type(),
        }
        props["tags"] = [[k.format(tagstore.get_standardized_key(k)), v] for k, v in event.tags]
        for key, value in event.interfaces.items():
            if key == "request":
                headers = value.headers
                if not isinstance(headers, dict):
                    headers = dict(headers or ())

                props.update(
                    {
                        "request_url": value.url,
                        "request_method": value.method,
                        "request_referer": headers.get("Referer", ""),
                    }
                )
            elif key == "exception":
                exc = value.values[0]
                props.update({"exception_type": exc.type, "exception_value": exc.value})
            elif key == "logentry":
                props.update({"message": value.formatted or value.message})
            elif key in ("csp", "expectct", "expectstable", "hpkp"):
                props.update(
                    {
                        "{}_{}".format(key.rsplit(".", 1)[-1].lower(), k): v
                        for k, v in value.to_json().items()
                    }
                )
            elif key == "user":
                user_payload = {}
                if value.id:
                    user_payload["user_id"] = value.id
                if value.email:
                    user_payload["user_email_hash"] = md5_text(value.email).hexdigest()
                if value.ip_address:
                    user_payload["user_ip_trunc"] = anonymize_ip(value.ip_address)
                if user_payload:
                    props.update(user_payload)
        return props

    def initialize_variables(self, event):
        self.project_token = self.get_option("token", event.project)
        self.project_index = self.get_option("index", event.project)
        self.project_instance = self.get_option("instance", event.project)
        self.host = self.get_host_for_splunk(event)

        if self.project_instance and not self.project_instance.endswith("/services/collector"):
            self.project_instance = self.project_instance.rstrip("/") + "/services/collector"

        self.project_source = self.get_option("source", event.project) or "sentry"

    def get_rl_key(self, event):
        return f"{self.conf_key}:{md5_text(self.project_token).hexdigest()}"

    def is_ratelimited(self, event):
        if super().is_ratelimited(event):
            metrics.incr(
                "integrations.splunk.forward-event.rate-limited",
                tags={
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "event_type": event.get_event_type(),
                },
            )
            return True
        return False

    def get_event_payload(self, event):
        payload = {
            "time": int(event.datetime.strftime("%s")),
            "source": self.project_source,
            "index": self.project_index,
            "event": self.get_event_payload_properties(event),
        }
        return payload

    def forward_event(self, event, payload):
        if not (self.project_token and self.project_index and self.project_instance):
            metrics.incr(
                "integrations.splunk.forward-event.unconfigured",
                tags={
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "event_type": event.get_event_type(),
                },
            )
            return False

        if self.host:
            payload["host"] = self.host

        client = self.get_client()

        try:
            # https://docs.splunk.com/Documentation/Splunk/7.2.3/Data/TroubleshootHTTPEventCollector
            client.request(payload)

            metrics.incr(
                "integrations.splunk.forward-event.success",
                tags={
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "event_type": event.get_event_type(),
                },
            )
            return True
        except Exception as exc:
            metric = "integrations.splunk.forward-event.error"
            metrics.incr(
                metric,
                tags={
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "event_type": event.get_event_type(),
                },
            )
            logger.info(
                metric,
                extra={
                    "instance": self.project_instance,
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "error": str(exc),
                },
            )

            if isinstance(
                exc,
                (
                    ApiHostError,
                    ApiTimeoutError,
                ),
            ):
                # The above errors are already handled by the API client.
                # Just log and return.
                return False

            if isinstance(exc, ApiError) and 401 <= exc.code <= 404:
                # Most 4xxs are not errors or actionable for us do not re-raise
                return False

            raise
