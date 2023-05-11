from sentry import analytics


class IssueForecastSaved(analytics.Event):
    type = "issue_forecasts.saved"

    attributes = (analytics.Attribute("num_groups"),)


analytics.register(IssueForecastSaved)
