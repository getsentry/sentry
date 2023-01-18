from typing import TYPE_CHECKING, List

from sentry.discover.models import TeamKeyTransaction
from sentry.dynamic_sampling.rules.utils import BOOSTED_KEY_TRANSACTION_LIMIT

if TYPE_CHECKING:
    from sentry.models import Project


def get_key_transactions(project: "Project") -> List[str]:
    """
    This function fetch up to BOOSTED_KEY_TRANSACTION_LIMIT unique transactions
    for given project.
    """
    key_transactions = list(
        TeamKeyTransaction.objects.filter(
            organization_id=project.organization.id,
            project_team__project_id=project.id,
        )
        .values_list("transaction", flat=True)
        .distinct()[:BOOSTED_KEY_TRANSACTION_LIMIT]
    )
    return key_transactions
