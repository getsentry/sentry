from sentry import analytics


@analytics.eventclass("codeowners.max_length_exceeded")
class CodeownersMaxLengthExceeded(analytics.Event):
    organization_id: int


analytics.register(CodeownersMaxLengthExceeded)
