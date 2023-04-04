from datetime import datetime, timezone
from typing import Dict, List, Mapping, Protocol, Sequence, Tuple

import sentry_sdk

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

    def read_sorted(self, project: Project) -> List[Tuple[ReplacementRule, int]]:
        ret = project.get_option(self._option_name, default=[])
        # normalize tuple vs. list (write_pickle vs. write_json)
        return [tuple(lst) for lst in ret]  # type: ignore[misc]

    def read(self, project: Project) -> RuleSet:
        return {rule: last_seen for rule, last_seen in self.read_sorted(project)}

    def _sort(self, rules: RuleSet) -> List[Tuple[ReplacementRule, int]]:
        """Sort rules by number of slashes, i.e. depth of the rule"""
        return sorted(rules.items(), key=lambda p: p[0].count("/"), reverse=True)

    def write(self, project: Project, rules: RuleSet) -> None:
        """Writes the rules to project options, sorted by depth."""
        # we make sure the database stores lists such that they are json round trippable
        converted_rules = [list(tup) for tup in self._sort(rules)]
        project.update_option(self._option_name, converted_rules)


class CompositeRuleStore:
    #: Maximum number (non-negative integer) of rules to write to stores.
    MERGE_MAX_RULES: int = 50

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
        trimmed_rules = self._trim_rules(merged_rules)
        self.write(project, trimmed_rules)

    def _trim_rules(self, rules: RuleSet) -> RuleSet:
        sorted_rules = sorted(rules.items(), key=lambda p: p[1], reverse=True)
        if self.MERGE_MAX_RULES < len(rules):
            with sentry_sdk.configure_scope() as scope:
                scope.set_tag("discarded", len(rules) - self.MERGE_MAX_RULES)
                scope.set_context(
                    "clustering_rules_max",
                    {
                        "num_existing_rules": len(rules),
                        "max_amount": self.MERGE_MAX_RULES,
                        "discarded_rules": sorted_rules[self.MERGE_MAX_RULES :],
                    },
                )
                sentry_sdk.capture_message("Transaction clusterer discarded rules", level="warn")
            sorted_rules = sorted_rules[: self.MERGE_MAX_RULES]

        return {rule: last_seen for rule, last_seen in sorted_rules}


class LocalRuleStore:
    def __init__(self, rules: RuleSet):
        self._rules = rules

    def read(self, project: Project) -> RuleSet:
        return self._rules

    def write(self, project: Project, rules: RuleSet) -> None:
        self._rules = rules


def _now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _get_rules(project: Project) -> RuleSet:
    return ProjectOptionRuleStore().read(project)


def get_sorted_rules(project: Project) -> List[Tuple[ReplacementRule, int]]:
    """Public interface for fetching rules for a project.

    The rules are fetched from project options rather than redis, because
    project options is the more persistent store.

    The rules are ordered by specifity, meaning that rules that go deeper
    into the URL tree occur first.
    """
    return ProjectOptionRuleStore().read_sorted(project)


def update_rules(project: Project, new_rules: Sequence[ReplacementRule]) -> None:
    # Run the updates even if there aren't any new rules, to get all the stores
    # up-to-date.

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


def update_redis_rules(project: Project, new_rules: Sequence[ReplacementRule]) -> None:
    if not new_rules:
        return

    last_seen = _now()
    new_rule_set = {rule: last_seen for rule in new_rules}
    rule_store = CompositeRuleStore(
        [
            RedisRuleStore(),
            LocalRuleStore(new_rule_set),
        ]
    )
    rule_store.merge(project)
