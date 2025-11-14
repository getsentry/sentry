from typing import int
from sentry import analytics


@analytics.eventclass("codeowners.max_length_exceeded")
class CodeOwnersMaxLengthExceeded(analytics.Event):
    organization_id: int


analytics.register(CodeOwnersMaxLengthExceeded)
