from __future__ import annotations

import logging

from django.utils import timezone

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks

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
