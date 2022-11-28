import logging
from datetime import datetime, timedelta
from typing import List, Literal, Mapping, Tuple, TypedDict

import click

from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.runner.decorators import configuration

logger = logging.getLogger(__name__)


RULE_RETENTION = timedelta(days=90)
OPTION_NAME = "sentry:transaction_name_normalize_rules"


class RuleSpec(TypedDict):
    sources: List[str]  # only apply rule to the given transaction sources
    type: Literal["glob"]
    value: ReplacementRule
    expires: int  # unix timestamp


@click.command()
@click.option("--merge-threshold", type=int, default=100)
@click.option("--time-range-seconds", type=int, default=3600)
@click.option("--snuba-limit", type=int, default=1000)
@click.option("--debug", is_flag=True)
@configuration
def cluster_transaction_names(
    merge_threshold: int, time_range_seconds: int, snuba_limit: int, debug: bool
):
    from sentry import features
    from sentry.models import Project
    from sentry.utils.query import RangeQuerySetWrapper

    if debug:
        logger.setLevel(logging.DEBUG)

    # TODO: Try to acquire a lock, skip if job is already running.

    now = datetime.now()
    then = now - timedelta(seconds=time_range_seconds)

    for project in RangeQuerySetWrapper(Project.objects.all()):
        if features.has("projects:transaction-name-cluster", project):
            _cluster_project(project, merge_threshold, (then, now), snuba_limit)
        else:
            logger.debug("Skipping project %s, feature disabled", project)


def _cluster_project(
    project, merge_threshold: int, time_range: Tuple[datetime, datetime], limit: int
):
    from sentry.ingest.transaction_clusterer.datasource import fetch_unique_transaction_names
    from sentry.ingest.transaction_clusterer.tree import TreeClusterer

    clusterer = TreeClusterer(merge_threshold=merge_threshold)

    transaction_names = fetch_unique_transaction_names(project, time_range, limit)

    clusterer.add_input(transaction_names)

    # TODO: span for clustering
    rules = clusterer.get_rules()

    _export_rules(project, rules, time_range[0])
    logger.debug("Generated %s new rules for project %s", len(rules), project.id)


def _export_rules(project, new_rules: List[ReplacementRule], now: datetime):
    from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE

    # Load existing rules and remove expired ones:
    now_timestamp = int(now.timestamp())
    new_expiry = int((now + RULE_RETENTION).timestamp())
    existing_rules: List[RuleSpec] = [
        rule
        for rule in project.get_option(OPTION_NAME).get("rules", [])
        if rule.get("source") == TRANSACTION_SOURCE
        and rule["type"] == "glob"
        and now_timestamp < rule["expires"]
    ]

    # TODO: Skip projects that never had any URL transactions.

    rules_by_glob: Mapping[str, RuleSpec] = {rule["value"]: rule for rule in existing_rules}

    # Update existing rules with new rules, bumping expiry dates by
    # overwriting existing entries:
    # FIXME: This won't work, we have to bump the expiry date when we see
    # a sanitized transaction because that means the rule is still in place.
    rules_by_glob.update(
        **{
            rule: {
                "source": TRANSACTION_SOURCE,
                "type": "glob",
                "value": rule,
                "expires": new_expiry,
            }
            for rule in new_rules
        }
    )

    rules: List[RuleSpec] = list(rules_by_glob.values())

    # We're mixing old and new rules, so sort again
    rules.sort(key=lambda rule: rule["value"].count("/"), reverse=True)

    # TODO: Integration test
    project.update_option(OPTION_NAME, {"rules": rules})
