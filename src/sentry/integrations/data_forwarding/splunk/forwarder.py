from __future__ import annotations

import logging
from typing import int, Any

from sentry import http, tagstore
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event
from sentry.shared_integrations.exceptions import ApiError, ApiHostError, ApiTimeoutError
from sentry.utils.hashlib import md5_text
from sentry_plugins.anonymizeip import anonymize_ip

logger = logging.getLogger(__name__)

DESCRIPTION = """
Send Sentry events to Splunk.

This integration allows you to forward Sentry events to Splunk HTTP Event Collector (HEC) for centralized logging and analysis.

Splunk is a platform for searching, monitoring, and analyzing machine-generated data.
"""


class SplunkForwarder(BaseDataForwarder):
    provider = DataForwarderProviderSlug.SPLUNK
    rate_limit = (1000, 1)  # 1000 requests per second
    description = DESCRIPTION

    @classmethod
    def get_host_for_splunk(cls, event: Event) -> str | None:
        host = event.get_tag("server_name")
        if host:
            return host

        user_interface = event.interfaces.get("user")
        if user_interface:
            host = user_interface.ip_address
            if host:
                return host

        return None

    @classmethod
    def get_event_payload_properties(cls, event: Event) -> dict[str, Any]:
        props = {
            "event_id": event.event_id,
            "issue_id": event.group_id,
            "project_id": event.project.slug,
            "transaction": event.get_tag("transaction") or "",
            "release": event.get_tag("sentry:release") or "",
            "environment": event.get_tag("environment") or "",
            "type": event.get_event_type(),
        }
        props["tags"] = [[tagstore.backend.get_standardized_key(k), v] for k, v in event.tags]
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

    @classmethod
    def get_event_payload(cls, event: Event, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "time": int(event.datetime.timestamp()),
            "source": config.get("source", "sentry"),
            "index": config["index"],
            "event": cls.get_event_payload_properties(event),
        }

    @classmethod
    def send_payload(
        cls,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        instance_url = config["instance_url"]
        token = config["token"]

        if instance_url and not instance_url.endswith("/services/collector"):
            instance_url = instance_url.rstrip("/") + "/services/collector"

        host = cls.get_host_for_splunk(event)
        if host:
            payload["host"] = host

        headers = {"Authorization": f"Splunk {token}"}

        try:
            with http.build_session() as session:
                response = session.post(
                    instance_url,
                    json=payload,
                    headers=headers,
                    timeout=5,
                    verify=False,
                )
                if not response.ok:
                    raise ApiError.from_response(response, url=instance_url)
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
                # These two are already handled by the API client, Just log and return.
                isinstance(exc, (ApiHostError, ApiTimeoutError))
                # Most 4xxs are not errors or actionable for us do not re-raise.
                or (exc.code is not None and ((401 <= exc.code <= 405) or exc.code in (502, 504)))
            ):
                return False
            raise

        return True

    @classmethod
    def forward_event(cls, event: Event, data_forwarder_project: DataForwarderProject) -> bool:
        config = data_forwarder_project.get_config()
        payload = cls.get_event_payload(event, config)
        return cls.send_payload(payload, config, event, data_forwarder_project)
