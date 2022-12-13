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
    Writing to postgres every time we see a sanitzed transaction will presumably
    create too much load, so we write to both redis and postgres and merge
    their contents every time we discover new rules.
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
        """Read rules from all stores and write back so they all contain the same set"""
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
