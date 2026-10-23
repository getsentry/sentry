from __future__ import annotations

from datetime import datetime

from django.db.models import Q

from sentry.service_accounts.models import ServiceAccountProject
from sentry.service_accounts.services.service_account.service import ServiceAccountService


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def remove_project_links_after_transfer(
        self,
        *,
        project_id: int,
        organization_id: int,
        previous_organization_id: int,
        transferred_at: datetime,
    ) -> None:
        links = (
            ServiceAccountProject.objects.filter(project_id=project_id)
            .filter(
                ~Q(service_account__organization_id=organization_id)
                | Q(
                    service_account__organization_id=previous_organization_id,
                    date_added__lte=transferred_at,
                )
            )
            .select_related("service_account")
        )
        # Deleting one at a time writes each account's outbox, so its replica updates too.
        for link in links:
            link.delete()
