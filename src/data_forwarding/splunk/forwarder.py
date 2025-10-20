from __future__ import annotations

import logging
from typing import Any

from data_forwarding.base import DataForwardingPlugin
from sentry import tagstore
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event
from sentry.shared_integrations.exceptions import ApiError, ApiHostError, ApiTimeoutError
from sentry.utils.hashlib import md5_text
from sentry_plugins.anonymizeip import anonymize_ip
from sentry_plugins.splunk.client import SplunkApiClient

logger = logging.getLogger(__name__)


DESCRIPTION = """
Send Sentry events to Splunk.

This integration allows you to forward Sentry events to Splunk HTTP Event Collector (HEC) for centralized logging and analysis.

Splunk is a platform for searching, monitoring, and analyzing machine-generated data.
"""


class SplunkDataForwarder(DataForwardingPlugin):
    provider = DataForwarderProviderSlug.SPLUNK
    name = "Splunk"
    description = DESCRIPTION

    def get_rate_limit(self) -> tuple[int, int]:
        return (1000, 1)

    def get_host_for_splunk(self, event: Event) -> str | None:
        host = event.get_tag("server_name")
        if host:
            return host

        user_interface = event.interfaces.get("user")
        if user_interface:
            host = user_interface.ip_address
            if host:
                return host

        return None

    def get_event_payload_properties(self, event: Event) -> dict[str, Any]:
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

    def get_event_payload(self, event: Event) -> dict[str, Any]:
        return {
            "time": int(event.datetime.strftime("%s")),
            "source": "sentry",
            "event": self.get_event_payload_properties(event),
        }

    def send_payload(
        self,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        instance_url = config["instance_url"]
        index = config["index"]
        source = config.get("source", "sentry")
        token = config["token"]

        if instance_url and not instance_url.endswith("/services/collector"):
            instance_url = instance_url.rstrip("/") + "/services/collector"

        payload["index"] = index
        payload["source"] = source

        host = self.get_host_for_splunk(event)
        if host:
            payload["host"] = host

        client = SplunkApiClient(instance_url, token)

        try:
            client.request(payload)
        except Exception as exc:
            logger.info(
                "splunk.send_payload.error",
                extra={
                    "instance": instance_url,
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                    "error": str(exc),
                },
            )

            if isinstance(exc, ApiError) and (
                isinstance(exc, (ApiHostError, ApiTimeoutError))
                or (exc.code is not None and (401 <= exc.code <= 405) or exc.code in (502, 504))
            ):
                return False
            raise

        return True
