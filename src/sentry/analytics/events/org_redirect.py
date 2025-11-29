from sentry import analytics


@analytics.eventclass("org_redirect")
class OrgRedirectEvent(analytics.Event):
    """Tracking analytics for organization redirects"""

    user_id: int
    organization_id: int | None = None
    path: str


# Only register if not already registered (allows getsentry to register its own version)
try:
    analytics.register(OrgRedirectEvent)
except AssertionError:
    # Already registered (likely by getsentry)
    pass
