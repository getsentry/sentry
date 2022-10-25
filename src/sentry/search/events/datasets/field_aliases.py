from typing import Any, List, Tuple

import sentry_sdk
from snuba_sdk import AliasedExpression, Function

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.models import ProjectTeam
from sentry.search.events import constants, fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import SelectType
from sentry.utils.numbers import format_grouped_length


def dry_run_default(builder: QueryBuilder, alias: str, *args: Any, **kwargs: Any) -> SelectType:
    """It doesn't really matter what we return here, the query won't be run

    This is so we can easily swap to something when we're dry running to prevent hitting postgres at all
    """
    return Function("toUInt64", [0], alias)


def resolve_team_key_transaction_alias(
    builder: QueryBuilder, resolve_metric_index: bool = False
) -> SelectType:
    team_key_transactions = get_team_transactions(builder, resolve_metric_index)
    if len(team_key_transactions) == 0:
        return Function("toInt8", [0], constants.TEAM_KEY_TRANSACTION_ALIAS)

    return Function(
        "in",
        [
            (builder.column("project_id"), builder.column("transaction")),
            team_key_transactions,
        ],
        constants.TEAM_KEY_TRANSACTION_ALIAS,
    )


def get_team_transactions(
    builder: QueryBuilder, resolve_metric_index: bool = False
) -> List[Tuple[int, str]]:
    org_id = builder.params.get("organization_id")
    project_ids = builder.params.get("project_id")
    team_ids = builder.params.get("team_id")

    if org_id is None or team_ids is None or project_ids is None:
        raise TypeError("Team key transactions parameters cannot be None")

    team_key_transactions = list(
        TeamKeyTransaction.objects.filter(
            organization_id=org_id,
            project_team__in=ProjectTeam.objects.filter(
                project_id__in=project_ids, team_id__in=team_ids
            ),
        )
        .order_by("transaction", "project_team__project_id")
        .values_list("project_team__project_id", "transaction")
        .distinct("transaction", "project_team__project_id")[
            : fields.MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS
        ]
    )

    if resolve_metric_index:
        team_key_transactions_list = []
        # Its completely possible that a team_key_transaction never existed in the metrics dataset
        for project, transaction in team_key_transactions:
            try:
                resolved_transaction = builder.resolve_tag_value(transaction)
            except IncompatibleMetricsQuery:
                continue
            if resolved_transaction:
                team_key_transactions_list.append((project, resolved_transaction))
        team_key_transactions = team_key_transactions_list

    count = len(team_key_transactions)

    # NOTE: this raw count is not 100% accurate because if it exceeds
    # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
    sentry_sdk.set_tag("team_key_txns.count", count)
    sentry_sdk.set_tag(
        "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
    )
    return team_key_transactions


def resolve_project_slug_alias(builder: QueryBuilder, alias: str) -> SelectType:
    builder.value_resolver_map[alias] = lambda project_id: builder.project_ids.get(project_id, "")
    builder.meta_resolver_map[alias] = "string"
    return AliasedExpression(exp=builder.column("project_id"), alias=alias)
