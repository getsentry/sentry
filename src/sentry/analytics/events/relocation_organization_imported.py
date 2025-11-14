from typing import int
from sentry import analytics


@analytics.eventclass("relocation.organization_imported")
class RelocationOrganizationImportedEvent(analytics.Event):
    organization_id: int
    relocation_uuid: str
    owner_id: int
    slug: str


analytics.register(RelocationOrganizationImportedEvent)
