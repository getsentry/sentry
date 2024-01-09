from sentry import analytics


class OrganizationImportedEvent(analytics.Event):
    type = "organization.imported"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("owner_id"),
        analytics.Attribute("name"),
        analytics.Attribute("slug"),
    )


analytics.register(OrganizationImportedEvent)
