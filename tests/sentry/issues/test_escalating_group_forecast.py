from datetime import datetime

from sentry.issues.escalating_group_forecast import (
    DEFAULT_MINIMUM_CEILING_FORECAST,
    EscalatingGroupForecast,
)
from sentry.testutils import TestCase


class TestEscalatingGroupForecast(TestCase):  # type: ignore[misc]
    def test_date_added_conversion(self):
        """
        Test converting EscalatingGroupForecast to EscalatingGroupForecastData does not
        change the time value of `date_added`
        """
        now = datetime.now()
        escalating_group_forecast = EscalatingGroupForecast(
            project_id=1, group_id=1, forecast=DEFAULT_MINIMUM_CEILING_FORECAST, date_added=now
        )
        escalating_group_forecast_to_dict = escalating_group_forecast.to_dict()
        escalating_group_forecast_from_dict = EscalatingGroupForecast.from_dict(
            escalating_group_forecast_to_dict
        )
        assert (
            escalating_group_forecast_from_dict.date_added.replace(tzinfo=None)
            == escalating_group_forecast.date_added
        )
