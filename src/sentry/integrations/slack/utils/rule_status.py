from __future__ import annotations

from typing import Union, cast
from uuid import uuid4

import orjson
import sentry_sdk
from django.conf import settings

from sentry.features.rollout import in_random_rollout
from sentry.utils import json
from sentry.utils.json import JSONData
from sentry.utils.redis import redis_clusters

SLACK_FAILED_MESSAGE = (
    "The slack resource does not exist or has not been granted access in that workspace."
)


# TODO: remove this when orjson experiment is successful
def dump_json(data) -> str | bytes:
    if in_random_rollout("integrations.slack.enable-orjson"):
        return orjson.dumps(data)
    else:
        return json.dumps(data)


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
        if in_random_rollout("integrations.slack.enable-orjson"):
            # Span is required because `json.loads` calls it by default
            with sentry_sdk.start_span(op="sentry.utils.json.loads"):
                return orjson.loads(cast(Union[str, bytes], value))
        return json.loads(cast(Union[str, bytes], value))

    def _generate_uuid(self) -> str:
        return uuid4().hex

    def _set_initial_value(self) -> None:
        value = dump_json({"status": "pending"})
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

        return dump_json(value)
