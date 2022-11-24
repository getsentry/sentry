import logging
from datetime import datetime, timedelta
from typing import List, Literal, Mapping, Tuple, TypedDict

import click
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.runner.decorators import configuration

logger = logging.getLogger(__name__)


RULE_RETENTION = timedelta(days=90)
OPTION_NAME = "sentry:transaction_name_normalize_rules"


class RuleSpec(TypedDict):
    type: Literal["glob"]
    value: ReplacementRule
    expires: int  # unix timestamp


@click.command()
@click.option("--merge-threshold", type=int, default=100)
@click.option("--time-range-seconds", type=int, default=3600)
@click.option("--debug", is_flag=True)
@configuration
def cluster_transaction_names(merge_threshold: int, time_range_seconds: int, debug: bool):
    from sentry import features
    from sentry.models import Project
    from sentry.utils.query import RangeQuerySetWrapper

    if debug:
        logger.setLevel(logging.DEBUG)

    now = datetime.now()
    then = now - timedelta(seconds=time_range_seconds)

    for project in RangeQuerySetWrapper(Project.objects.all()):
        if features.has("projects:transaction-name-cluster", project):
            _cluster_project(project, merge_threshold, (then, now))
        else:
            logger.debug("Skipping project %s, feature disabled", project)


def _cluster_project(project, merge_threshold: int, time_range: Tuple[datetime, datetime]):
    from sentry.ingest.transaction_clusterer.tree import TreeClusterer
    from sentry.utils.snuba import raw_snql_query

    clusterer = TreeClusterer(merge_threshold=merge_threshold)

    then, now = time_range
    snuba_request = Request(
        "transactions",
        app_id="transactions",
        query=Query(
            match=Entity("transactions"),
            select=[Column("transaction")],
            where=[
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("finish_ts"), Op.GTE, then),
                Condition(Column("finish_ts"), Op.LT, now),
                # FIXME: Only where transaction_info.source == URL
            ],
            groupby=[Column("transaction")],
        ),
    )
    snuba_response = raw_snql_query(
        snuba_request, referrer="sentry.ingest.cluster_transaction_names"
    )

    clusterer.add_input(row["transaction"] for row in snuba_response["data"])

    # TODO: span for clustering
    rules = clusterer.get_rules()

    _export_rules(project, rules, now)
    logger.debug("Generated %s new rules for project %s", len(rules), project.id)


def _export_rules(project, new_rules: List[ReplacementRule], now: datetime):
    # Load existing rules and remove expired ones:
    now_timestamp = int(now.timestamp())
    new_expiry = int((now + RULE_RETENTION).timestamp())
    existing_rules: List[RuleSpec] = [
        rule
        for rule in project.get_option(OPTION_NAME).get("rules", [])
        if rule["type"] == "glob" and now_timestamp < rule["expires"]
    ]

    rules_by_glob: Mapping[str, RuleSpec] = {rule["value"]: rule for rule in existing_rules}

    # Update existing rules with new rules, bumping expiry dates by
    # overwriting existing entries:
    rules_by_glob.update(
        **{rule: {"type": "glob", "value": rule, "expires": new_expiry} for rule in new_rules}
    )

    rules: List[RuleSpec] = list(rules_by_glob.values())

    # We're mixing old and new rules, so sort again
    rules.sort(key=lambda rule: rule["value"].count("/"), reverse=True)

    # TODO: Integration test
    if rules:
        project.update_option(OPTION_NAME, {"rules": rules})
