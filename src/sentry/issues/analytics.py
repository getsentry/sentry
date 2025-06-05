from sentry import analytics


@analytics.eventclass("issue_forecasts.saved")
class IssueForecastSaved(analytics.Event):
    num_groups: str


analytics.register(IssueForecastSaved)
