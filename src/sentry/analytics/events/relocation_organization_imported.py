from sentry import analytics


@analytics.eventclass("relocation.organization_imported")
class RelocationOrganizationImportedEvent(analytics.Event):
    organization_id: str
    relocation_uuid: str
    owner_id: str
    slug: str


analytics.register(RelocationOrganizationImportedEvent)
