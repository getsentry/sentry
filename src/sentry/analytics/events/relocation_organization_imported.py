from sentry import analytics


class RelocationOrganizationImportedEvent(analytics.Event):
    type = "relocation.organization_imported"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("relocation_uuid"),
        analytics.Attribute("owner_id"),
        analytics.Attribute("slug"),
    )


analytics.register(RelocationOrganizationImportedEvent)
