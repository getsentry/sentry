from sentry import analytics


class AiAutofixPrEvent(analytics.Event):
    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("run_id"),
        analytics.Attribute("integration"),
    )


class AiAutofixPrClosedEvent(AiAutofixPrEvent):
    type = "ai.autofix.pr.closed"


class AiAutofixPrMergedEvent(AiAutofixPrEvent):
    type = "ai.autofix.pr.merged"


class AiAutofixPrOpenedEvent(AiAutofixPrEvent):
    type = "ai.autofix.pr.opened"


analytics.register(AiAutofixPrClosedEvent)
analytics.register(AiAutofixPrMergedEvent)
analytics.register(AiAutofixPrOpenedEvent)
