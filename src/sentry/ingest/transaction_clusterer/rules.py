from datetime import datetime, timezone
from typing import Dict, List, Mapping, Protocol, Sequence, Tuple

import sentry_sdk

from sentry.ingest.transaction_clusterer.datasource.redis import get_redis_client
from sentry.models import Project
from sentry.utils import metrics

from .base import ReplacementRule

#: Map from rule string to last_seen timestamp
RuleSet = Mapping[ReplacementRule, int]

#: How long a transaction name rule lasts, in seconds.
TRANSACTION_NAME_RULE_TTL_SECS = 90 * 24 * 60 * 60  # 90 days


class RuleStore(Protocol):
    def read(self, project: Project) -> RuleSet:
        ...

    def write(self, project: Project, rules: RuleSet) -> None:
        ...


class RedisRuleStore:
    """Store rules in both project options and Redis.

    Why Redis?
    We want to update the rule lifetimes when a transaction has been sanitized
    with that rule.  That load is very high for the project options to handle,
    but Redis is capable of doing so.

    Then, why project options?
    Redis is not a persistent store, and rules should be persistent. As a
    result, at some point the up-to-date lifetimes of rules in Redis must be
    updated and merged back to project options. This operation can't happen too
    frequently, and the task to generate rules meets the criteria and thus is
    responsible for that.
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
            if len(rules) > 0:
                p.hmset(key, rules)
            p.execute()

    def update_rule(self, project: Project, rule: str, last_used: int) -> None:
        """Overwrite a rule's last_used timestamp.

        This function does not create the rule if it does not exist.
        """
        client = get_redis_client()
        key = self._get_rules_key(project)
        # There is no atomic "overwrite if exists" for hashes, so fetch keys first:
        existing_rules = client.hkeys(key)
        if rule in existing_rules:
            client.hset(key, rule, last_used)


class ProjectOptionRuleStore:
    _option_name = "sentry:transaction_name_cluster_rules"

    def read_sorted(self, project: Project) -> List[Tuple[ReplacementRule, int]]:
        ret = project.get_option(self._option_name, default=[])
        # normalize tuple vs. list for json writing
        return [tuple(lst) for lst in ret]  # type: ignore[misc]

    def read(self, project: Project) -> RuleSet:
        rules = {rule: last_seen for rule, last_seen in self.read_sorted(project)}
        self.last_read = rules
        return rules

    def _sort(self, rules: RuleSet) -> List[Tuple[ReplacementRule, int]]:
        """Sort rules by number of slashes, i.e. depth of the rule"""
        return sorted(rules.items(), key=lambda p: p[0].count("/"), reverse=True)

    def write(self, project: Project, rules: RuleSet) -> None:
        """Writes the rules to project options, sorted by depth."""
        # we make sure the database stores lists such that they are json round trippable
        converted_rules = [list(tup) for tup in self._sort(rules)]

        # Track the number of rules per project.
        metrics.timing("txcluster.rules_per_project", len(converted_rules))

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
        last_seen_deadline = _now() - TRANSACTION_NAME_RULE_TTL_SECS
        sorted_rules = [rule for rule in sorted_rules if rule[1] >= last_seen_deadline]

        if self.MERGE_MAX_RULES < len(rules):
            with sentry_sdk.configure_scope() as scope:
                sentry_sdk.set_measurement(
                    "discarded_transactions", len(rules) - self.MERGE_MAX_RULES
                )
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


def get_rules(project: Project) -> RuleSet:
    """Get rules from project options."""
    return ProjectOptionRuleStore().read(project)


def get_redis_rules(project: Project) -> RuleSet:
    """Get rules from Redis."""
    return RedisRuleStore().read(project)


def get_sorted_rules(project: Project) -> List[Tuple[ReplacementRule, int]]:
    """Public interface for fetching rules for a project.

    The rules are fetched from project options rather than redis, because
    project options is the more persistent store.

    The rules are ordered by specifity, meaning that rules that go deeper
    into the URL tree occur first.
    """
    return ProjectOptionRuleStore().read_sorted(project)


def update_rules(project: Project, new_rules: Sequence[ReplacementRule]) -> int:
    """Write newly discovered rules to projection option and redis, and update last_used.

    Return the number of _new_ rules (that were not already present in project option).
    """
    # Run the updates even if there aren't any new rules, to get all the stores
    # up-to-date.
    # NOTE: keep in mind this function writes to Postgres, so it shouldn't be
    # called often.

    last_seen = _now()
    new_rule_set = {rule: last_seen for rule in new_rules}
    project_option = ProjectOptionRuleStore()
    rule_store = CompositeRuleStore(
        [
            RedisRuleStore(),
            project_option,
            LocalRuleStore(new_rule_set),
        ]
    )

    rule_store.merge(project)

    num_rules_added = len(new_rule_set.keys() - project_option.last_read.keys())

    return num_rules_added


def bump_last_used(project: Project, pattern: str) -> None:
    """If an entry for `pattern` exists, bump its last_used timestamp in redis.

    The updated last_used timestamps are transferred from redis to project options
    in the `cluster_projects` task.
    """
    RedisRuleStore().update_rule(project, pattern, _now())
