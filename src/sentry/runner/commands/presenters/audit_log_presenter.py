import itertools
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import TypedDict

import httpx

from sentry import options
from sentry.runner.commands.presenters.webhookpresenter import WebhookPresenter

logger = logging.getLogger()


class AuditLogPresenter(WebhookPresenter):
    def __init__(
        self, source: str, request_fn: Callable[["AuditLogRequest"], None] | None = None
    ) -> None:
        super().__init__(source)

        if request_fn is not None:
            self.request_fn = request_fn
        else:
            self.request_fn = send_audit_log_request

    @staticmethod
    def is_webhook_enabled() -> bool:
        return (
            options.get("flags:options-audit-log-webhook-url") is not None
            and options.get("flags:options-audit-log-token") is not None
            and options.get("flags:options-audit-log-is-disabled") is False
        )

    def flush(self) -> None:
        if self.is_webhook_enabled():
            request = create_audit_log_request(items=self._create_audit_log_items())
            self.request_fn(request)
        else:
            logger.warning("Options audit log webhook is disabled.")
            return None

    def _create_audit_log_items(self) -> list["AuditLogItem"]:
        return [
            {
                "action": action,
                "created_at": datetime.now(tz=timezone.utc).isoformat(),
                "created_by": "internal",
                "flag": flag,
                "tags": tags,
            }
            for flag, action, tags in itertools.chain(
                ((flag, "created", {"value": v}) for flag, v in self.set_options),
                ((flag, "deleted", {}) for flag in self.unset_options),
                ((flag, "updated", {"value": v}) for flag, _, v in self.updated_options),
                ((flag, "updated", {}) for flag, _ in self.drifted_options),
            )
        ]


AuditLogRequestHeaders = TypedDict(
    "AuditLogRequestHeaders",
    {
        "Authorization": str,
        "Content-Type": str,
    },
)


class AuditLogRequest(TypedDict):
    url: str
    data: list["AuditLogItem"]
    headers: AuditLogRequestHeaders


class AuditLogItem(TypedDict):
    action: str
    flag: str
    created_at: str
    created_by: str
    tags: dict[str, str]


def create_audit_log_request(items: list[AuditLogItem]) -> AuditLogRequest:
    token = options.get("flags:options-audit-log-token")
    return {
        "data": items,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        "url": options.get("flags:options-audit-log-webhook-url"),
    }


def send_audit_log_request(request: AuditLogRequest) -> None:
    """Send an audit-log request."""
    request_data = {"data": request["data"]}
    response = httpx.post(url=request["url"], json=request_data, headers=request["headers"])
    if response.status_code != 201:
        logger.error("Request failed.")
    else:
        logger.info("Success. Submitted log entries.")
