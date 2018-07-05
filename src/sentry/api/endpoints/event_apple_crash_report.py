from __future__ import absolute_import

import six

try:
    from django.http import (
        HttpResponse,
        CompatibleStreamingHttpResponse as StreamingHttpResponse)
except ImportError:
    from django.http import HttpResponse, StreamingHttpResponse

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Event
from sentry.lang.native.applecrashreport import AppleCrashReport


class EventAppleCrashReportEndpoint(Endpoint):
    permission_classes = (GroupPermission, )

    def get(self, request, event_id):
        """
        Retrieve an Apple Crash Report from and event
        `````````````````````````````````````````````

        This endpoint returns the an apple crash report for a specific event.
        The event ID is the event as it appears in the Sentry database
        and not the event ID that is reported by the client upon submission.
        This works only if the event.platform == cocoa
        """
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        if event.platform not in ('cocoa', 'native'):
            return HttpResponse(
                {
                    'message': 'Only cocoa events can return an apple crash report',
                }, status=403
            )

        threads = (event.data.get('threads') or {}).get('values')
        exceptions = (event.data.get(
            'sentry.interfaces.Exception') or {}).get('values')

        symbolicated = (request.GET.get('minified') not in ('1', 'true'))
        debug_images = None
        if (event.data.get('debug_meta') and event.data.get('debug_meta').get('images')):
            debug_images = event.data.get('debug_meta').get('images')

        apple_crash_report_string = six.text_type(
            AppleCrashReport(
                threads=threads,
                context=event.data.get('contexts'),
                debug_images=debug_images,
                symbolicated=symbolicated,
                exceptions=exceptions
            )
        )

        response = HttpResponse(apple_crash_report_string,
                                content_type='text/plain')

        if request.GET.get('download') is not None:
            filename = "{}{}.crash".format(
                event.event_id, symbolicated and '-symbolicated' or '')
            response = StreamingHttpResponse(
                apple_crash_report_string,
                content_type='text/plain',
            )
            response['Content-Length'] = len(apple_crash_report_string)
            response['Content-Disposition'] = 'attachment; filename="%s"' % filename

        return response
