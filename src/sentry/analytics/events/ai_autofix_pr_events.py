from sentry import analytics


@analytics.eventclass()
class AiAutofixPrEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    run_id: int
    integration: str
    github_app: str


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
