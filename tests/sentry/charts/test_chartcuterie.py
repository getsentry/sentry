from unittest.mock import patch

import pytest
import responses
from django.urls.base import reverse

from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.http import absolute_uri


@control_silo_test
class ChartcuterieTest(TestCase):
    def test_enabled(self):
        assert not charts.is_enabled()

        with self.options({"chart-rendering.enabled": True}):
            assert charts.is_enabled()

    @responses.activate
    @patch("sentry.charts.chartcuterie.uuid4")
    def test_simple(self, mock_uuid):
        mock_uuid.return_value = self.get_mock_uuid()

        chart_data = {
            "seriesName": "Discover total period",
            "series": [
                [1616168400, [{"count": 0}]],
                [1616168700, [{"count": 12}]],
                [1616169000, [{"count": 13}]],
            ],
        }

        service_url = "http://chartcuterie"
        image_data = b"this is png data"

        responses.add(
            method=responses.POST,
            url=f"{service_url}/render",
            status=200,
            content_type="image/png",
            body=image_data,
        )

        options = {
            "chart-rendering.enabled": True,
            "chart-rendering.chartcuterie": {"url": service_url},
        }

        # Test the image can be uploaded and we get a URL back
        with self.options(options):
            url = charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, chart_data)

        assert url == absolute_uri(reverse("sentry-serve-media", args=["abc123.png"]))

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "requestId": "abc123",
            "style": ChartType.SLACK_DISCOVER_TOTAL_PERIOD.value,
            "data": chart_data,
        }

        resp = self.client.get(url)
        assert close_streaming_response(resp) == image_data

    @responses.activate
    def test_failed(self):
        chart_data = {"seriesName": "Discover total period", "series": []}

        service_url = "http://chartcuterie"

        responses.add(
            method=responses.POST, url=f"{service_url}/render", status=500, body="Service down"
        )

        options = {
            "chart-rendering.enabled": True,
            "chart-rendering.chartcuterie": {"url": service_url},
        }

        with (
            self.options(options),
            pytest.raises(RuntimeError, match="Chartcuterie responded with 500: Service down"),
        ):
            charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, chart_data)

    @responses.activate
    @patch("sentry.charts.chartcuterie.uuid4")
    def test_custom_size(self, mock_uuid):
        mock_uuid.return_value = self.get_mock_uuid()

        chart_data = {
            "seriesName": "Discover total period",
            "series": [
                [1616168400, [{"count": 0}]],
                [1616168700, [{"count": 12}]],
                [1616169000, [{"count": 13}]],
            ],
        }

        service_url = "http://chartcuterie"
        image_data = b"this is png data"

        responses.add(
            method=responses.POST,
            url=f"{service_url}/render",
            status=200,
            content_type="image/png",
            body=image_data,
        )

        options = {
            "chart-rendering.enabled": True,
            "chart-rendering.chartcuterie": {"url": service_url},
        }

        with self.options(options):
            url = charts.generate_chart(
                ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
                chart_data,
                size={"width": 1000, "height": 200},
            )

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "requestId": "abc123",
            "style": ChartType.SLACK_DISCOVER_TOTAL_PERIOD.value,
            "data": chart_data,
            "width": 1000,
            "height": 200,
        }

        resp = self.client.get(url)
        assert close_streaming_response(resp) == image_data
