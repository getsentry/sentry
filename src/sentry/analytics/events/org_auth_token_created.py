from sentry import analytics


class OrgAuthTokenCreated(analytics.Event):
    type = "org_auth_token.created"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(OrgAuthTokenCreated)
