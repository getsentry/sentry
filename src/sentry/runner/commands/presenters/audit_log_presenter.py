import itertools
import logging
from datetime import datetime, timezone
from typing import Any

from sentry import options
from sentry.flags.providers import FlagAuditLogItem, handle_flag_pole_event_internal
from sentry.runner.commands.presenters.webhookpresenter import WebhookPresenter

logger = logging.getLogger()


def _tags_for_value(value: Any) -> dict[str, Any]:
    """Build FlagLog tags for a create/update, extracting purpose text when present.

    Flagpole Feature values may carry an optional `description` (human-readable
    purpose). Surface it as `flag_description` so the FEATURE_FLAG_CHANGE
    annotation producer can prefer purpose text over synthetic copy.
    """
    tags: dict[str, Any] = {"value": value}
    if isinstance(value, dict):
        purpose = value.get("description")
        if isinstance(purpose, str):
            purpose = purpose.strip()
            if purpose:
                tags["flag_description"] = purpose
    return tags


class AuditLogPresenter(WebhookPresenter):
    def __init__(self, source: str, dry_run: bool = False) -> None:
        self.dry_run = dry_run
        super().__init__(source)

    @staticmethod
    def is_webhook_enabled() -> bool:
        return (
            options.get("flags:options-audit-log-is-enabled") is True
            and options.get("flags:options-audit-log-organization-id") is not None
        )

    def flush(self) -> None:
        if self.dry_run:
            logger.warning("Dry run. Skipping audit-log process.")
            return None

        if not self.is_webhook_enabled():
            logger.warning("Options audit log webhook is disabled.")
            return None

        items = self._create_audit_log_items()
        handle_flag_pole_event_internal(
            items, organization_id=options.get("flags:options-audit-log-organization-id")
        )

    def _create_audit_log_items(self) -> list[FlagAuditLogItem]:
        return [
            {
                "action": action,
                "created_at": datetime.now(tz=timezone.utc),
                "created_by": "internal",
                "flag": flag,
                "tags": tags,
            }
            for flag, action, tags in itertools.chain(
                ((flag, "created", _tags_for_value(v)) for flag, v in self.set_options),
                ((flag, "deleted", {}) for flag in self.unset_options),
                ((flag, "updated", _tags_for_value(v)) for flag, _, v in self.updated_options),
                ((flag, "updated", {}) for flag, _ in self.drifted_options),
            )
        ]
