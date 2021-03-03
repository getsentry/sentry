from django.http import HttpResponse, StreamingHttpResponse

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.lang.native.applecrashreport import AppleCrashReport
from sentry.utils.safe import get_path


class EventAppleCrashReportEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
        """
        Retrieve an Apple Crash Report from an event
        `````````````````````````````````````````````

        This endpoint returns the an apple crash report for a specific event.
        This works only if the event.platform == cocoa
        """
        event = eventstore.get_event_by_id(project.id, event_id)
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

        response = HttpResponse(apple_crash_report_string, content_type="text/plain")

        if request.GET.get("download") is not None:
            filename = "{}{}.crash".format(event.event_id, symbolicated and "-symbolicated" or "")
            response = StreamingHttpResponse(apple_crash_report_string, content_type="text/plain")
            response["Content-Length"] = len(apple_crash_report_string)
            response["Content-Disposition"] = 'attachment; filename="%s"' % filename

        return response
