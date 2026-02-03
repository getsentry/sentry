from __future__ import annotations

import logging
from typing import Any

from sentry import tagstore
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.exceptions import ApiError, ApiHostError, ApiTimeoutError
from sentry.utils.hashlib import md5_text
from sentry_plugins.anonymizeip import anonymize_ip
from sentry_plugins.splunk.client import SplunkApiClient

logger = logging.getLogger(__name__)


class SplunkForwarder(BaseDataForwarder):
    provider = DataForwarderProviderSlug.SPLUNK
    rate_limit = (1000, 1)  # 1000 requests per second
    project_token: str | None = None
    project_index: str | None = None
    project_instance: str | None = None
    host: str | None = None
    project_source: str | None = None

    def get_host_for_splunk(self, event: Event | GroupEvent) -> str | None:
        host = event.get_tag("server_name")
        if host:
            return host

        user_interface = event.interfaces.get("user")
        if user_interface:
            host = user_interface.ip_address
            if host:
                return host

        return None

    def initialize_variables(self, event: Event | GroupEvent, config: dict[str, Any]):
        self.project_token = config.get("token")
        self.project_index = config.get("index")
        self.project_instance = config.get("instance_url")
        self.host = self.get_host_for_splunk(event)

        if self.project_instance and not self.project_instance.endswith("/services/collector"):
            self.project_instance = self.project_instance.rstrip("/") + "/services/collector"

        self.project_source = config.get("source", "sentry")

    def get_rl_key(self, event: Event | GroupEvent) -> str:
        return f"{self.provider.value}:{md5_text(self.project_token).hexdigest()}"

    def get_event_payload_properties(self, event: Event | GroupEvent) -> dict[str, Any]:
        props = {
            "event_id": event.event_id,
            "issue_id": event.group_id,
            "project_id": event.project.slug,
            "transaction": event.get_tag("transaction") or "",
            "release": event.get_tag("sentry:release") or "",
            "environment": event.get_tag("environment") or "",
            "type": event.get_event_type(),
        }
        props["tags"] = [
            [k.format(tagstore.backend.get_standardized_key(k)), v] for k, v in event.tags
        ]
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

    def get_event_payload(
        self, event: Event | GroupEvent, config: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "time": int(event.datetime.strftime("%s")),
            "source": config.get("source", "sentry"),
            "index": config["index"],
            "event": self.get_event_payload_properties(event),
        }

    def forward_event(
        self,
        event: Event | GroupEvent,
        payload: dict[str, Any],
        config: dict[str, Any],
    ) -> bool:
        if not self.project_token or not self.project_index or not self.project_instance:
            return False

        if self.host:
            payload["host"] = self.host

        client = SplunkApiClient(self.project_instance, self.project_token)

        try:
            # https://docs.splunk.com/Documentation/Splunk/7.2.3/Data/TroubleshootHTTPEventCollector
            client.request(payload)
        except Exception as exc:
            metric = "integrations.splunk.forward-event.error"
            logger.info(
                metric,
                extra={
                    "instance": self.project_instance,
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "error": str(exc),
                },
            )

            if isinstance(exc, ApiError) and (
                # These two are already handled by the API client, Just log and return.
                isinstance(exc, (ApiHostError, ApiTimeoutError))
                # Most 4xxs are not errors or actionable for us do not re-raise.
                or (exc.code is not None and (401 <= exc.code <= 405) or exc.code in (502, 504))
            ):
                return False
            raise
        return True
