from django.http import HttpResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.lang.native.applecrashreport import AppleCrashReport
from sentry.utils.safe import get_path


@region_silo_endpoint
class EventAppleCrashReportEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_NATIVE
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, event_id) -> HttpResponseBase:
        """
        Retrieve an Apple Crash Report from an event
        `````````````````````````````````````````````

        This endpoint returns the an apple crash report for a specific event.
        This works only if the event.platform == cocoa
        """
        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise ResourceDoesNotExist

        if event.platform not in ("cocoa", "native"):
            return HttpResponse(
                {"message": "Only cocoa events can return an apple crash report"}, status=403
            )

        symbolicated = request.GET.get("minified") not in ("1", "true")

        apple_crash_report_string = str(
            AppleCrashReport(
                threads=get_path(event.data, "threads", "values", filter=True),
                context=event.data.get("contexts"),
                debug_images=get_path(event.data, "debug_meta", "images", filter=True),
                exceptions=get_path(event.data, "exception", "values", filter=True),
                symbolicated=symbolicated,
            )
        )

        if request.GET.get("download") is not None:
            filename = "{}{}.crash".format(event.event_id, symbolicated and "-symbolicated" or "")
            return StreamingHttpResponse(
                apple_crash_report_string,
                content_type="text/plain",
                headers={
                    "Content-Length": len(apple_crash_report_string),
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
        else:
            return HttpResponse(apple_crash_report_string, content_type="text/plain")
