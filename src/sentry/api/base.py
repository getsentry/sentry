from __future__ import absolute_import

import logging
import six
import time

from datetime import datetime, timedelta
from django.conf import settings
from django.utils.http import urlquote
from django.views.decorators.csrf import csrf_exempt
from enum import Enum
from pytz import utc
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import tsdb
from sentry.app import raven
from sentry.models import ApiKey, AuditLogEntry
from sentry.utils.cursors import Cursor
from sentry.utils.dates import to_datetime
from sentry.utils.http import absolute_uri, is_valid_origin

from .authentication import ApiKeyAuthentication, TokenAuthentication
from .paginator import Paginator
from .permissions import NoPermission

__all__ = ['DocSection', 'Endpoint', 'StatsMixin']

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24

LINK_HEADER = '<{uri}&cursor={cursor}>; rel="{name}"; results="{has_results}"; cursor="{cursor}"'

DEFAULT_AUTHENTICATION = (
    TokenAuthentication,
    ApiKeyAuthentication,
    SessionAuthentication,
)

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('sentry.audit.api')


class DocSection(Enum):
    ACCOUNTS = 'Accounts'
    EVENTS = 'Events'
    ORGANIZATIONS = 'Organizations'
    PROJECTS = 'Projects'
    RELEASES = 'Releases'
    TEAMS = 'Teams'


class Endpoint(APIView):
    authentication_classes = DEFAULT_AUTHENTICATION
    renderer_classes = (JSONRenderer,)
    parser_classes = (JSONParser,)
    permission_classes = (NoPermission,)

    def build_cursor_link(self, request, name, cursor):
        querystring = u'&'.join(
            u'{0}={1}'.format(urlquote(k), urlquote(v))
            for k, v in six.iteritems(request.GET)
            if k != 'cursor'
        )
        base_url = absolute_uri(urlquote(request.path))
        if querystring:
            base_url = '{0}?{1}'.format(base_url, querystring)
        else:
            base_url = base_url + '?'

        return LINK_HEADER.format(
            uri=base_url,
            cursor=six.text_type(cursor),
            name=name,
            has_results='true' if bool(cursor) else 'false',
        )

    def convert_args(self, request, *args, **kwargs):
        return (args, kwargs)

    def handle_exception(self, request, exc):
        try:
            return super(Endpoint, self).handle_exception(exc)
        except Exception as exc:
            import sys
            import traceback
            sys.stderr.write(traceback.format_exc())
            event_id = raven.captureException(request=request)
            context = {
                'detail': 'Internal Error',
                'errorId': event_id,
            }
            return Response(context, status=500)

    def create_audit_entry(self, request, transaction_id=None, **kwargs):
        user = request.user if request.user.is_authenticated() else None
        api_key = request.auth if isinstance(request.auth, ApiKey) else None

        entry = AuditLogEntry(
            actor=user,
            actor_key=api_key,
            ip_address=request.META['REMOTE_ADDR'],
            **kwargs
        )

        # Only create a real AuditLogEntry record if we are passing an event type
        # otherwise, we want to still log to our actual logging
        if entry.event is not None:
            entry.save()

        extra = {
            'ip_address': entry.ip_address,
            'organization_id': entry.organization_id,
            'object_id': entry.target_object,
            'entry_id': entry.id,
            'actor_label': entry.actor_label
        }
        if entry.actor_id:
            extra['actor_id'] = entry.actor_id
        if entry.actor_key_id:
            extra['actor_key_id'] = entry.actor_key_id
        if transaction_id is not None:
            extra['transaction_id'] = transaction_id

        audit_logger.info(entry.get_event_display(), extra=extra)

        return entry

    def initialize_request(self, request, *args, **kwargs):
        rv = super(Endpoint, self).initialize_request(request, *args, **kwargs)
        # If our request is being made via our internal API client, we need to
        # stitch back on auth and user information
        if getattr(request, '__from_api_client__', False):
            if rv.auth is None:
                rv.auth = getattr(request, 'auth', None)
            if rv.user is None:
                rv.user = getattr(request, 'user', None)
        return rv

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        """
        Identical to rest framework's dispatch except we add the ability
        to convert arguments (for common URL params).
        """
        self.args = args
        self.kwargs = kwargs
        request = self.initialize_request(request, *args, **kwargs)
        self.request = request
        self.headers = self.default_response_headers  # deprecate?

        if settings.SENTRY_API_RESPONSE_DELAY:
            time.sleep(settings.SENTRY_API_RESPONSE_DELAY / 1000.0)

        origin = request.META.get('HTTP_ORIGIN', 'null')
        # A "null" value should be treated as no Origin for us.
        # See RFC6454 for more information on this behavior.
        if origin == 'null':
            origin = None

        try:
            if origin and request.auth:
                allowed_origins = request.auth.get_allowed_origins()
                if not is_valid_origin(origin, allowed=allowed_origins):
                    response = Response('Invalid origin: %s' % (origin,), status=400)
                    self.response = self.finalize_response(request, response, *args, **kwargs)
                    return self.response

            self.initial(request, *args, **kwargs)

            # Get the appropriate handler method
            if request.method.lower() in self.http_method_names:
                handler = getattr(self, request.method.lower(),
                                  self.http_method_not_allowed)

                (args, kwargs) = self.convert_args(request, *args, **kwargs)
                self.args = args
                self.kwargs = kwargs
            else:
                handler = self.http_method_not_allowed

            response = handler(request, *args, **kwargs)

        except Exception as exc:
            response = self.handle_exception(request, exc)

        if origin:
            self.add_cors_headers(request, response)

        self.response = self.finalize_response(request, response, *args, **kwargs)

        return self.response

    def add_cors_headers(self, request, response):
        response['Access-Control-Allow-Origin'] = request.META['HTTP_ORIGIN']
        response['Access-Control-Allow-Methods'] = ', '.join(self.http_method_names)

    def paginate(self, request, on_results=None, paginator_cls=Paginator,
                 default_per_page=100, **kwargs):
        per_page = int(request.GET.get('per_page', default_per_page))
        input_cursor = request.GET.get('cursor')
        if input_cursor:
            input_cursor = Cursor.from_string(input_cursor)
        else:
            input_cursor = None

        assert per_page <= max(100, default_per_page)

        paginator = paginator_cls(**kwargs)
        cursor_result = paginator.get_result(
            limit=per_page,
            cursor=input_cursor,
        )

        # map results based on callback
        if on_results:
            results = on_results(cursor_result.results)

        headers = {}
        headers['Link'] = ', '.join([
            self.build_cursor_link(request, 'previous', cursor_result.prev),
            self.build_cursor_link(request, 'next', cursor_result.next),
        ])

        return Response(results, headers=headers)


class StatsMixin(object):
    def _parse_args(self, request):
        resolution = request.GET.get('resolution')
        if resolution:
            resolution = self._parse_resolution(resolution)
            assert resolution in tsdb.get_rollups()

        end = request.GET.get('until')
        if end:
            end = to_datetime(float(end))
        else:
            end = datetime.utcnow().replace(tzinfo=utc)

        start = request.GET.get('since')
        if start:
            start = to_datetime(float(start))
            assert start <= end, 'start must be before or equal to end'
        else:
            start = end - timedelta(days=1, seconds=-1)

        return {
            'start': start,
            'end': end,
            'rollup': resolution,
        }

    def _parse_resolution(self, value):
        if value.endswith('h'):
            return int(value[:-1]) * ONE_HOUR
        elif value.endswith('d'):
            return int(value[:-1]) * ONE_DAY
        elif value.endswith('m'):
            return int(value[:-1]) * ONE_MINUTE
        elif value.endswith('s'):
            return int(value[:-1])
        else:
            raise ValueError(value)
