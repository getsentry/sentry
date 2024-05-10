from sentry import analytics


class AiAutofixPrMergedEvent(analytics.Event):
    type = "ai.autofix.pr.merged"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("run_id"),
        analytics.Attribute("integration"),
    )


analytics.register(AiAutofixPrMergedEvent)
