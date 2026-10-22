from __future__ import annotations

from sentry.service_accounts.models import ServiceAccountProject
from sentry.service_accounts.services.service_account.service import ServiceAccountService


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def remove_project_links_outside_org(self, *, project_id: int, organization_id: int) -> None:
        links = (
            ServiceAccountProject.objects.filter(project_id=project_id)
            .exclude(service_account__organization_id=organization_id)
            .select_related("service_account")
        )
        # Deleting one at a time writes each account's outbox, so its replica updates too.
        for link in links:
            link.delete()
