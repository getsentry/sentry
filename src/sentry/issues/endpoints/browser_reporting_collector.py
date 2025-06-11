import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint, allow_cors_options
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@all_silo_endpoint
class BrowserReportingCollectorEndpoint(Endpoint):
    """
    An experimental endpoint which is a proxy for browser Reporting API reports. For now just
    records metrics and forwards data to GCP, so we can collect real-world data on what gets sent,
    how much gets sent, etc.
    """

    permission_classes = ()
    # TODO: Do we need to specify this parser? Content type will be `application/reports+json`, so
    # it might just work automatically.
    parser_classes = [JSONParser]
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    # TODO: It's unclear if either of these decorators is necessary
    @csrf_exempt
    @allow_cors_options
    def post(self, request: Request, *args, **kwargs) -> HttpResponse:
        if not options.get("issues.browser_reporting.collector_endpoint_enabled"):
            return HttpResponse(status=404)

        logger.info("browser_report_received", extra={"request_body": request.data})

        report_type = request.data.get("type")
        metrics.incr(
            "browser_reporting.raw_report_received",
            tags={
                "type": (
                    report_type
                    if report_type in ["crash", "deprecation", "intervention"]
                    else "other"
                )
            },
        )

        return HttpResponse(status=200)
