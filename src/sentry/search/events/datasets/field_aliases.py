from __future__ import annotations

from typing import List, Tuple

import sentry_sdk
from snuba_sdk import AliasedExpression, Function

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.models.projectteam import ProjectTeam
from sentry.search.events import builder, constants, fields
from sentry.search.events.types import SelectType
from sentry.search.utils import DEVICE_CLASS
from sentry.utils.numbers import format_grouped_length


def resolve_team_key_transaction_alias(
    builder: builder.QueryBuilder, resolve_metric_index: bool = False
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
    builder: builder.QueryBuilder, resolve_metric_index: bool = False
) -> List[Tuple[int, str]]:
    org_id = builder.params.organization.id if builder.params.organization is not None else None
    project_ids = builder.params.project_ids
    team_ids = builder.params.team_ids

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
                resolved_transaction = builder.resolve_tag_value(transaction)  # type: ignore
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


def resolve_project_slug_alias(builder: builder.QueryBuilder, alias: str) -> SelectType:
    builder.value_resolver_map[alias] = lambda project_id: builder.params.project_id_map.get(
        project_id, ""
    )
    builder.meta_resolver_map[alias] = "string"
    return AliasedExpression(exp=builder.column("project_id"), alias=alias)


def resolve_span_module(builder, alias: str) -> SelectType:
    OP_MAPPING = {
        "db.redis": "cache",
        "db.sql.room": "other",
    }
    return Function(
        "if",
        [
            Function("in", [builder.column("span.op"), list(OP_MAPPING.keys())]),
            Function(
                "transform",
                [
                    builder.column("span.op"),
                    list(OP_MAPPING.keys()),
                    list(OP_MAPPING.values()),
                    "other",
                ],
            ),
            Function(
                "transform",
                [
                    builder.column("span.category"),
                    [
                        "cache",
                        "db",
                        "http",
                    ],
                    [
                        "cache",
                        "db",
                        "http",
                    ],
                    "other",
                ],
            ),
        ],
        alias,
    )


def resolve_device_class(builder: builder.QueryBuilder, alias: str) -> SelectType:
    values: List[str] = []
    keys: List[str] = []
    for device_key, device_values in DEVICE_CLASS.items():
        values.extend(device_values)
        keys.extend([device_key] * len(device_values))
    return Function(
        "transform",
        [builder.column("device.class"), values, keys, "Unknown"],
        alias,
    )
