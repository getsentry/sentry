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


class GroupSimilarIssuesEmbeddingsCountEvent(analytics.Event):
    type = "group_similar_issues_embeddings.count"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("count_over_threshold", required=False),
    )


analytics.register(OrganizationSavedSearchCreatedEvent)
analytics.register(OrganizationSavedSearchDeletedEvent)
analytics.register(GroupSimilarIssuesEmbeddingsCountEvent)
