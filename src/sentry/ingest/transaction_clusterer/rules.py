from datetime import datetime, timezone
from typing import MutableMapping, Sequence

from sentry.ingest.transaction_clusterer.datasource.redis import get_redis_client
from sentry.models import Project

from .base import ReplacementRule

#: Retention of a rule derived by the clusterer
RULE_TTL = 90 * 24 * 60 * 60

REDIS_KEY_PREFIX_RULES = "txrules:"


def _get_rules_key(project: Project) -> str:
    return f"{REDIS_KEY_PREFIX_RULES}o:{project.organization_id}:p:{project.id}"


def _now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def get_rules(project: Project) -> MutableMapping[str, int]:
    client = get_redis_client()
    key = _get_rules_key(project)
    return client.hgetall(key)  # type: ignore


def update_rules(project: Project, new_rules: Sequence[ReplacementRule]) -> None:
    new_expiry = _now() + RULE_TTL

    client = get_redis_client()
    key = _get_rules_key(project)

    # Update rules, overwrite existing entries to update their expiry dates
    client.hmset(key, {rule: new_expiry for rule in new_rules})
