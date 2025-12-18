from __future__ import annotations

import logging

from django.utils import timezone

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.outcomes import Outcome

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.organization_contributors.reset_num_actions_for_organization_contributors",
    namespace=integrations_tasks,
    silo_mode=SiloMode.REGION,
)
def reset_num_actions_for_organization_contributors(organization_id: int) -> None:
    """
    Reset num_actions for all OrganizationContributors rows in the given organization.
    """
    updated_count = (
        OrganizationContributors.objects.filter(organization_id=organization_id)
        .exclude(num_actions=0)
        .update(num_actions=0, date_updated=timezone.now())
    )
    logger.info(
        "organization_contributors.reset_num_actions",
        extra={"organization_id": organization_id, "rows_updated": updated_count},
    )


@instrumented_task(
    name="sentry.tasks.organization_contributors.assign_seat_to_organization_contributor",
    namespace=integrations_tasks,
    silo_mode=SiloMode.REGION,
    retry=Retry(times=3, delay=60),
)
def assign_seat_to_organization_contributor(contributor_id) -> None:
    try:
        organization_contributor = OrganizationContributors.objects.get(id=contributor_id)
    except OrganizationContributors.DoesNotExist:
        logger.warning(
            "organization_contributors.assign_seat.contributor_not_found",
            extra={"contributor_id": contributor_id},
        )
        return

    logger.info(
        "organization_contributors.assign_seat.start",
        extra={
            "organization_contributor_id": organization_contributor.id,
            "organization_id": organization_contributor.organization_id,
            "integration_id": organization_contributor.integration_id,
            "external_identifier": organization_contributor.external_identifier,
        },
    )

    outcome = quotas.backend.assign_seat(DataCategory.SEER_USER, organization_contributor)

    if outcome != Outcome.ACCEPTED:
        logger.warning(
            "organization_contributors.assign_seat.failed",
            extra={
                "organization_contributor_id": organization_contributor.id,
                "organization_id": organization_contributor.organization_id,
                "integration_id": organization_contributor.integration_id,
                "external_identifier": organization_contributor.external_identifier,
                "outcome": outcome,
            },
        )
