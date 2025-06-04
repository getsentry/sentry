from sentry import analytics


class RelocationForkedEvent(analytics.Event):
    type = "relocation.forked"

    attributes = (
        analytics.Attribute("creator_id"),
        analytics.Attribute("owner_id"),
        analytics.Attribute("uuid"),
        analytics.Attribute("from_org_slug"),
        analytics.Attribute("requesting_region_name"),
        analytics.Attribute("replying_region_name"),
    )


analytics.register(RelocationForkedEvent)
