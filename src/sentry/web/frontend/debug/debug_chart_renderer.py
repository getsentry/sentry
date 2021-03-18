from django.views.generic import View

from sentry.charts import generate_chart
from sentry.charts.types import ChartType
from sentry.web.helpers import render_to_response

discover_total = {
    "seriesName": "Discover total period",
    "series": [
        [1616168400, [{"count": 0}]],
        [1616168700, [{"count": 12}]],
        [1616169000, [{"count": 13}]],
        [1616169300, [{"count": 9}]],
        [1616169600, [{"count": 12}]],
        [1616169900, [{"count": 21}]],
        [1616170200, [{"count": 11}]],
        [1616170500, [{"count": 22}]],
        [1616170800, [{"count": 18}]],
        [1616171100, [{"count": 15}]],
        [1616171400, [{"count": 14}]],
        [1616171700, [{"count": 31}]],
        [1616172000, [{"count": 18}]],
        [1616172300, [{"count": 13}]],
        [1616172600, [{"count": 17}]],
        [1616172900, [{"count": 9}]],
        [1616173200, [{"count": 9}]],
        [1616173500, [{"count": 13}]],
        [1616173800, [{"count": 11}]],
    ],
}


class DebugChartRendererView(View):
    def get(self, request):
        charts = []

        url = generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, discover_total)
        charts.append(url)

        return render_to_response("sentry/debug/chart-renderer.html", context={"charts": charts})
