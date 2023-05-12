from sentry import analytics


class CodeOwnersMaxLengthExceeded(analytics.Event):
    type = "codeowners.max_length_exceeded"

    attributes = (analytics.Attribute("organization_id"),)


analytics.register(CodeOwnersMaxLengthExceeded)
