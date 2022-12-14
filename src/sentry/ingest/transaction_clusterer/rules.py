from datetime import datetime, timezone
from typing import Dict, List, Mapping, Protocol, Sequence

from sentry.ingest.transaction_clusterer.datasource.redis import get_redis_client
from sentry.models import Project

from .base import ReplacementRule

#: Map from rule string to last_seen timestamp
RuleSet = Mapping[ReplacementRule, int]


class RuleStore(Protocol):
    def read(self, project: Project) -> RuleSet:
        ...

    def write(self, project: Project, rules: RuleSet) -> None:
        ...


class RedisRuleStore:
    """We store rules in both project options and redis.
    The reason for the additional redis store is that in the future, we want
    to extend rule lifetimes when we see a sanitized transaction.
    The load of writes on every sanitized transaction name is very high, but
    the load of writes on the generation of new rules is low. Both postgres and
    redis can handle the latter, but only redis can handle the former. The
    approach consists of writing the former only on redis, and when we generate
    rules (the latter) we merge and update the contents of both postgres and
    redis.
    """

    @staticmethod
    def _get_rules_key(project: Project) -> str:
        return f"txrules:o:{project.organization_id}:p:{project.id}"

    def read(self, project: Project) -> RuleSet:
        client = get_redis_client()
        key = self._get_rules_key(project)
        data = client.hgetall(key)
        return {rule: int(timestamp) for rule, timestamp in data.items()}

    def write(self, project: Project, rules: RuleSet) -> None:
        client = get_redis_client()
        key = self._get_rules_key(project)

        with client.pipeline() as p:
            # to be consistent with other stores, clear previous hash entries:
            p.delete(key)
            p.hmset(key, rules)


class ProjectOptionRuleStore:
    _option_name = "sentry:transaction_name_cluster_rules"

    def read(self, project: Project) -> RuleSet:
        return project.get_option(self._option_name, default={})  # type: ignore

    def write(self, project: Project, rules: RuleSet) -> None:
        project.update_option(self._option_name, rules)


class CompositeRuleStore:
    def __init__(self, stores: List[RuleStore]):
        self._stores = stores

    def read(self, project: Project) -> RuleSet:
        merged_rules: Dict[ReplacementRule, int] = {}
        for store in self._stores:
            rules = store.read(project)
            for rule, last_seen in rules.items():
                if rule not in merged_rules or merged_rules[rule] < last_seen:
                    merged_rules[rule] = last_seen

        return merged_rules

    def write(self, project: Project, rules: RuleSet) -> None:
        for store in self._stores:
            store.write(project, rules)

    def merge(self, project: Project) -> None:
        """Read rules from all stores, merge and write them back so they all are up-to-date."""
        merged_rules = self.read(project)
        self.write(project, merged_rules)


class LocalRuleStore:
    def __init__(self, rules: RuleSet):
        self._rules = rules

    def read(self, project: Project) -> RuleSet:
        return self._rules

    def write(self, project: Project, rules: RuleSet) -> None:
        self._rules = rules


def _now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def get_rules(project: Project) -> Mapping[ReplacementRule, int]:
    """Public interface for fetching rules for a project.
    Project options are the persistent, long-term store for rules, while redis is just a short-term buffer,
    so project options is what we fetch from."""
    return ProjectOptionRuleStore().read(project)


def update_rules(project: Project, new_rules: Sequence[ReplacementRule]) -> None:
    last_seen = _now()
    new_rule_set = {rule: last_seen for rule in new_rules}
    rule_store = CompositeRuleStore(
        [
            RedisRuleStore(),
            ProjectOptionRuleStore(),
            LocalRuleStore(new_rule_set),
        ]
    )
    rule_store.merge(project)
