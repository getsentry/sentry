import sentry_sdk
from snuba_sdk import Function

from sentry.discover.models import TeamKeyTransaction
from sentry.models import Project, ProjectTeam
from sentry.search.events import constants, fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import SelectType
from sentry.sentry_metrics import indexer
from sentry.utils.numbers import format_grouped_length


def resolve_team_key_transaction_alias(
    builder: QueryBuilder, resolve_metric_index: bool = False
) -> SelectType:
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

    count = len(team_key_transactions)
    if resolve_metric_index:
        team_key_transactions = [
            (project, indexer.resolve(transaction))
            for project, transaction in team_key_transactions
        ]

    # NOTE: this raw count is not 100% accurate because if it exceeds
    # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
    sentry_sdk.set_tag("team_key_txns.count", count)
    sentry_sdk.set_tag(
        "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
    )

    if count == 0:
        return Function("toInt8", [0], constants.TEAM_KEY_TRANSACTION_ALIAS)

    return Function(
        "in",
        [
            (builder.column("project_id"), builder.column("transaction")),
            team_key_transactions,
        ],
        constants.TEAM_KEY_TRANSACTION_ALIAS,
    )


def resolve_project_slug_alias(builder: QueryBuilder, alias: str) -> SelectType:
    project_ids = {
        project_id
        for project_id in builder.params.get("project_id", [])
        if isinstance(project_id, int)
    }

    # Try to reduce the size of the transform by using any existing conditions on projects
    # Do not optimize projects list if conditions contain OR operator
    if not builder.has_or_condition and len(builder.projects_to_filter) > 0:
        project_ids &= builder.projects_to_filter

    projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

    return Function(
        "transform",
        [
            builder.column("project.id"),
            [project["id"] for project in projects],
            [project["slug"] for project in projects],
            "",
        ],
        alias,
    )
