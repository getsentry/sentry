from datetime import datetime, timezone
from typing import MutableMapping, Sequence

from sentry.ingest.transaction_clusterer.datasource.redis import get_redis_client
from sentry.models import Project

from .base import ReplacementRule

#: Retention of a rule derived by the clusterer
RULE_TTL = 90 * 24 * 60 * 60

REDIS_KEY_PREFIX_RULES = "txrules:"


def _get_rules_key(project: Project) -> str:
    return f"{REDIS_KEY_PREFIX_RULES}{project.organization_id}:{project.id}"


def _now():
    return int(datetime.now(timezone.utc).timestamp())


def update_rule_expiry(project: Project, rule_id: str) -> None:
    client = get_redis_client()
    key = _get_rules_key(project)
    client.hset(key, rule_id, _now() + RULE_TTL)


def get(project: Project) -> MutableMapping[str, int]:
    client = get_redis_client()
    key = _get_rules_key(project)
    return client.hgetall(key)


def update(project: Project, new_rules: Sequence[ReplacementRule]):
    new_expiry = _now() + RULE_TTL

    client = get_redis_client()
    key = _get_rules_key(project)

    # Update rules, overwrite existing entries to update their expiry dates
    client.hmset(key, {rule: new_expiry for rule in new_rules})
