from sentry import analytics


class OrgAuthTokenDeleted(analytics.Event):
    type = "org_auth_token.deleted"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(OrgAuthTokenDeleted)
