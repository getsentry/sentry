from sentry import analytics


@analytics.eventclass("relocation.forked")
class RelocationForkedEvent(analytics.Event):
    creator_id: str
    owner_id: str
    uuid: str
    from_org_slug: str
    requesting_region_name: str
    replying_region_name: str


analytics.register(RelocationForkedEvent)
