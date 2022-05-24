from __future__ import annotations

from uuid import uuid4

from django.conf import settings

from sentry.utils import json
from sentry.utils.json import JSONData
from sentry.utils.redis import redis_clusters

SLACK_FAILED_MESSAGE = (
    "The slack resource does not exist or has not been granted access in that workspace."
)


class RedisRuleStatus:
    def __init__(self, uuid: str | None = None) -> None:
        self._uuid = uuid or self._generate_uuid()

        cluster_id = getattr(settings, "SENTRY_RULE_TASK_REDIS_CLUSTER", "default")
        self.client = redis_clusters.get(cluster_id)
        self._set_initial_value()

    @property
    def uuid(self) -> str:
        return self._uuid

    def set_value(
        self,
        status: str,
        rule_id: int | None = None,
        error_message: str | None = None,
    ) -> None:
        value = self._format_value(status, rule_id, error_message)
        self.client.set(self._get_redis_key(), f"{value}", ex=60 * 60)

    def get_value(self) -> JSONData:
        key = self._get_redis_key()
        value = self.client.get(key)
        return json.loads(value)

    def _generate_uuid(self) -> str:
        return uuid4().hex

    def _set_initial_value(self) -> None:
        value = json.dumps({"status": "pending"})
        self.client.set(self._get_redis_key(), f"{value}", ex=60 * 60, nx=True)

    def _get_redis_key(self) -> str:
        return f"slack-channel-task:1:{self.uuid}"

    def _format_value(
        self,
        status: str,
        rule_id: int | None,
        error_message: str | None,
    ) -> str:
        value = {"status": status}
        if rule_id:
            value["rule_id"] = str(rule_id)
        if error_message:
            value["error"] = error_message
        elif status == "failed":
            value["error"] = SLACK_FAILED_MESSAGE

        # Explicitly typing to satisfy mypy.
        _value: str = json.dumps(value)
        return _value
