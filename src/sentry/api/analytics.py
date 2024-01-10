from sentry import analytics


class OrganizationSavedSearchCreatedEvent(analytics.Event):
    type = "organization_saved_search.created"

    attributes = (
        analytics.Attribute("org_id"),
        analytics.Attribute("search_type"),
        analytics.Attribute("query"),
    )


class OrganizationSavedSearchDeletedEvent(analytics.Event):
    type = "organization_saved_search.deleted"

    attributes = (
        analytics.Attribute("org_id"),
        analytics.Attribute("search_type"),
        analytics.Attribute("query"),
    )


class FunctionTimerEvent(analytics.Event):
    type = "function_timer.timed"

    attributes = (
        analytics.Attribute("function_name"),
        analytics.Attribute("duration"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id", required=False),
        analytics.Attribute("frame_abs_path", required=False),
    )


analytics.register(OrganizationSavedSearchCreatedEvent)
analytics.register(OrganizationSavedSearchDeletedEvent)
analytics.register(FunctionTimerEvent)
