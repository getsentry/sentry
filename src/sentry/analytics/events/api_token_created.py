from typing import int
from sentry import analytics


@analytics.eventclass("api_token.created")
class ApiTokenCreated(analytics.Event):
    user_id: int | None = None


analytics.register(ApiTokenCreated)
