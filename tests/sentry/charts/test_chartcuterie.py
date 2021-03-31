import pytest
import responses

from django.urls.base import reverse

from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.compat.mock import patch
from sentry.charts.types import ChartType
from sentry.charts import generate_chart, is_enabled
from sentry.testutils import TestCase


class ChartcuterieTest(TestCase):
    def test_enabled(self):
        assert not is_enabled()

        with self.options({"chart-rendering.enabled": True}):
            assert is_enabled()

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

        # Don't upload our image anywhere
        with self.options(options):
            data = generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, chart_data, upload=False)

        assert data == image_data

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "requestId": "abc123",
            "style": ChartType.SLACK_DISCOVER_TOTAL_PERIOD.value,
            "data": chart_data,
        }

        # Test the image can be uploaded and we get a URL back
        with self.options(options):
            url = generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, chart_data)

        assert url == absolute_uri(reverse("sentry-serve-media", args=["abc123.png"]))

        resp = self.client.get(url)
        assert next(resp.streaming_content) == image_data

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

        with self.options(options), pytest.raises(
            RuntimeError, match="Chartcuterie responded with 500: Service down"
        ):
            generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, chart_data)
