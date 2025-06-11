from sentry import analytics


@analytics.eventclass()
class AiAutofixPrEvent(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    run_id: str
    integration: str


@analytics.eventclass("ai.autofix.pr.closed")
class AiAutofixPrClosedEvent(AiAutofixPrEvent):
    pass


@analytics.eventclass("ai.autofix.pr.merged")
class AiAutofixPrMergedEvent(AiAutofixPrEvent):
    pass


@analytics.eventclass("ai.autofix.pr.opened")
class AiAutofixPrOpenedEvent(AiAutofixPrEvent):
    pass


analytics.register(AiAutofixPrClosedEvent)
analytics.register(AiAutofixPrMergedEvent)
analytics.register(AiAutofixPrOpenedEvent)
