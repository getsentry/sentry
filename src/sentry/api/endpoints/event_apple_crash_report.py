from __future__ import absolute_import

from django.http import HttpResponse, CompatibleStreamingHttpResponse

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Event
from sentry.lang.native.utils import get_apple_crash_report


class EventAppleCrashReportEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def get(self, request, event_id):
        """
        Retrieve an Apple Crash Report from and event
        `````````````````````````````````````````````

        This endpoint returns the an apple crash report for a specific event.
        The event ID is the event as it appears in the Sentry database
        and not the event ID that is reported by the client upon submission.
        This works only if the event.platform is cocoa
        """
        try:
            event = Event.objects.get(
                id=event_id
            )
        except Event.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        if event.platform != 'cocoa':
            return HttpResponse({
                'message': 'Only cocoa events can return an apple crash report',
            }, status=403)

        threads = event.data.get(
            'sentry.interfaces.threads',
            event.data.get('threads'
        )).get('values')

        symbolicated = (request.GET.get('minified') not in ('1', 'true'))
        apple_crash_report = get_apple_crash_report(
            threads=threads,
            context=event.data.get('contexts'),
            debug_images=event.data.get('debug_meta').get('images'),
            symbolicated=symbolicated
        )

        response = HttpResponse(apple_crash_report, content_type='text/plain')

        if request.GET.get('download') is not None:
            filename = "{}{}.crash".format(
                event.event_id,
                symbolicated and '-symbolicated' or ''
            )
            response = CompatibleStreamingHttpResponse(
                apple_crash_report,
                content_type='text/plain',
            )
            response['Content-Length'] = len(apple_crash_report)
            response['Content-Disposition'] = 'attachment; filename="%s"' % filename

        return response
