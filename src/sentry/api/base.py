from __future__ import absolute_import

import functools
import logging
import six
import time
import sentry_sdk

from datetime import datetime, timedelta
from django.conf import settings
from django.utils.http import urlquote
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from pytz import utc
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import tsdb
from sentry.auth import access
from sentry.models import Environment
from sentry.utils.cursors import Cursor
from sentry.utils.dates import to_datetime
from sentry.utils.http import absolute_uri, is_valid_origin, origin_from_request
from sentry.utils.audit import create_audit_entry
from sentry.utils.sdk import capture_exception
from sentry.utils import json


from .authentication import ApiKeyAuthentication, TokenAuthentication
from .paginator import BadPaginationError, Paginator
from .permissions import NoPermission


__all__ = ["Endpoint", "EnvironmentMixin", "StatsMixin"]

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24

LINK_HEADER = u'<{uri}&cursor={cursor}>; rel="{name}"; results="{has_results}"; cursor="{cursor}"'

DEFAULT_AUTHENTICATION = (TokenAuthentication, ApiKeyAuthentication, SessionAuthentication)

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("sentry.audit.api")


def allow_cors_options(func):
    """
    Decorator that adds automatic handling of OPTIONS requests for CORS

    If the request is OPTIONS (i.e. pre flight CORS) construct a OK (200) response
    in which we explicitly enable the caller and add the custom headers that we support
    For other requests just add the appropriate CORS headers

    :param func: the original request handler
    :return: a request handler that shortcuts OPTIONS requests and just returns an OK (CORS allowed)
    """

    @functools.wraps(func)
    def allow_cors_options_wrapper(self, request, *args, **kwargs):

        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
            response["Access-Control-Max-Age"] = "3600"  # don't ask for options again for 1 hour
        else:
            response = func(self, request, *args, **kwargs)

        allow = ", ".join(self._allowed_methods())
        response["Allow"] = allow
        response["Access-Control-Allow-Methods"] = allow
        response["Access-Control-Allow-Headers"] = (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding"
        )
        response["Access-Control-Expose-Headers"] = "X-Sentry-Error, Retry-After"

        if request.META.get("HTTP_ORIGIN") == "null":
            origin = "null"  # if ORIGIN header is explicitly specified as 'null' leave it alone
        else:
            origin = origin_from_request(request)

        if origin is None or origin == "null":
            response["Access-Control-Allow-Origin"] = "*"
        else:
            response["Access-Control-Allow-Origin"] = origin

        return response

    return allow_cors_options_wrapper


class Endpoint(APIView):
    # Note: the available renderer and parser classes can be found in conf/server.py.
    authentication_classes = DEFAULT_AUTHENTICATION
    permission_classes = (NoPermission,)

    def build_cursor_link(self, request, name, cursor):
        querystring = u"&".join(
            u"{0}={1}".format(urlquote(k), urlquote(v))
            for k, v in six.iteritems(request.GET)
            if k != "cursor"
        )
        base_url = absolute_uri(urlquote(request.path))
        if querystring:
            base_url = u"{0}?{1}".format(base_url, querystring)
        else:
            base_url = base_url + "?"

        return LINK_HEADER.format(
            uri=base_url,
            cursor=six.text_type(cursor),
            name=name,
            has_results="true" if bool(cursor) else "false",
        )

    def convert_args(self, request, *args, **kwargs):
        return (args, kwargs)

    def handle_exception(self, request, exc):
        try:
            response = super(Endpoint, self).handle_exception(exc)
        except Exception:
            import sys
            import traceback

            sys.stderr.write(traceback.format_exc())
            event_id = capture_exception()
            context = {"detail": "Internal Error", "errorId": event_id}
            response = Response(context, status=500)
            response.exception = True
        return response

    def create_audit_entry(self, request, transaction_id=None, **kwargs):
        return create_audit_entry(request, transaction_id, audit_logger, **kwargs)

    def load_json_body(self, request):
        """
        Attempts to load the request body when it's JSON.

        The end result is ``request.json_body`` having a value. When it can't
        load the body as JSON, for any reason, ``request.json_body`` is None.

        The request flow is unaffected and no exceptions are ever raised.
        """

        request.json_body = None

        if not request.META.get("CONTENT_TYPE", "").startswith("application/json"):
            return

        if not len(request.body):
            return

        try:
            request.json_body = json.loads(request.body)
        except json.JSONDecodeError:
            return

    def initialize_request(self, request, *args, **kwargs):
        # XXX: Since DRF 3.x, when the request is passed into
        # `initialize_request` it's set as an internal variable on the returned
        # request. Then when we call `rv.auth` it attempts to authenticate,
        # fails and sets `user` and `auth` to None on the internal request. We
        # keep track of these here and reassign them as needed.
        orig_auth = getattr(request, "auth", None)
        orig_user = getattr(request, "user", None)
        rv = super(Endpoint, self).initialize_request(request, *args, **kwargs)
        # If our request is being made via our internal API client, we need to
        # stitch back on auth and user information
        if getattr(request, "__from_api_client__", False):
            if rv.auth is None:
                rv.auth = orig_auth
            if rv.user is None:
                rv.user = orig_user
        return rv

    @csrf_exempt
    @allow_cors_options
    def dispatch(self, request, *args, **kwargs):
        """
        Identical to rest framework's dispatch except we add the ability
        to convert arguments (for common URL params).
        """
        with sentry_sdk.start_span(op="base.dispatch.setup", description=type(self).__name__):
            self.args = args
            self.kwargs = kwargs
            request = self.initialize_request(request, *args, **kwargs)
            self.load_json_body(request)
            self.request = request
            self.headers = self.default_response_headers  # deprecate?

        # Tags that will ultimately flow into the metrics backend at the end of
        # the request (happens via middleware/stats.py).
        request._metric_tags = {}

        if settings.SENTRY_API_RESPONSE_DELAY:
            start_time = time.time()

        origin = request.META.get("HTTP_ORIGIN", "null")
        # A "null" value should be treated as no Origin for us.
        # See RFC6454 for more information on this behavior.
        if origin == "null":
            origin = None

        try:
            with sentry_sdk.start_span(op="base.dispatch.request", description=type(self).__name__):
                if origin and request.auth:
                    allowed_origins = request.auth.get_allowed_origins()
                    if not is_valid_origin(origin, allowed=allowed_origins):
                        response = Response("Invalid origin: %s" % (origin,), status=400)
                        self.response = self.finalize_response(request, response, *args, **kwargs)
                        return self.response

                self.initial(request, *args, **kwargs)

                # Get the appropriate handler method
                if request.method.lower() in self.http_method_names:
                    handler = getattr(self, request.method.lower(), self.http_method_not_allowed)

                    (args, kwargs) = self.convert_args(request, *args, **kwargs)
                    self.args = args
                    self.kwargs = kwargs
                else:
                    handler = self.http_method_not_allowed

                if getattr(request, "access", None) is None:
                    # setup default access
                    request.access = access.from_request(request)

            with sentry_sdk.start_span(
                op="base.dispatch.execute",
                description="{}.{}".format(type(self).__name__, handler.__name__),
            ):
                response = handler(request, *args, **kwargs)

        except Exception as exc:
            response = self.handle_exception(request, exc)

        if origin:
            self.add_cors_headers(request, response)

        self.response = self.finalize_response(request, response, *args, **kwargs)

        if settings.SENTRY_API_RESPONSE_DELAY:
            duration = time.time() - start_time

            if duration < (settings.SENTRY_API_RESPONSE_DELAY / 1000.0):
                with sentry_sdk.start_span(
                    op="base.dispatch.sleep", description=type(self).__name__,
                ) as span:
                    span.set_data("SENTRY_API_RESPONSE_DELAY", settings.SENTRY_API_RESPONSE_DELAY)
                    time.sleep(settings.SENTRY_API_RESPONSE_DELAY / 1000.0 - duration)

        return self.response

    def add_cors_headers(self, request, response):
        response["Access-Control-Allow-Origin"] = request.META["HTTP_ORIGIN"]
        response["Access-Control-Allow-Methods"] = ", ".join(self.http_method_names)

    def add_cursor_headers(self, request, response, cursor_result):
        if cursor_result.hits is not None:
            response["X-Hits"] = cursor_result.hits
        if cursor_result.max_hits is not None:
            response["X-Max-Hits"] = cursor_result.max_hits
        response["Link"] = ", ".join(
            [
                self.build_cursor_link(request, "previous", cursor_result.prev),
                self.build_cursor_link(request, "next", cursor_result.next),
            ]
        )

    def respond(self, context=None, **kwargs):
        return Response(context, **kwargs)

    def paginate(
        self,
        request,
        on_results=None,
        paginator=None,
        paginator_cls=Paginator,
        default_per_page=100,
        max_per_page=100,
        **paginator_kwargs
    ):
        assert (paginator and not paginator_kwargs) or (paginator_cls and paginator_kwargs)

        try:
            per_page = int(request.GET.get("per_page", default_per_page))
        except ValueError:
            raise ParseError(detail="Invalid per_page parameter.")

        input_cursor = None
        if request.GET.get("cursor"):
            try:
                input_cursor = Cursor.from_string(request.GET.get("cursor"))
            except ValueError:
                raise ParseError(detail="Invalid cursor parameter.")

        max_per_page = max(max_per_page, default_per_page)
        if per_page > max_per_page:
            raise ParseError(
                detail="Invalid per_page value. Cannot exceed {}.".format(max_per_page)
            )

        if not paginator:
            paginator = paginator_cls(**paginator_kwargs)

        try:
            with sentry_sdk.start_span(
                op="base.paginate.get_result", description=type(self).__name__,
            ) as span:
                span.set_data("Limit", per_page)
                cursor_result = paginator.get_result(limit=per_page, cursor=input_cursor)
        except BadPaginationError as e:
            raise ParseError(detail=six.text_type(e))

        # map results based on callback
        if on_results:
            with sentry_sdk.start_span(
                op="base.paginate.on_results", description=type(self).__name__,
            ):
                results = on_results(cursor_result.results)
        else:
            results = cursor_result.results

        response = Response(results)
        self.add_cursor_headers(request, response, cursor_result)
        return response


class EnvironmentMixin(object):
    def _get_environment_func(self, request, organization_id):
        """\
        Creates a function that when called returns the ``Environment``
        associated with a request object, or ``None`` if no environment was
        provided. If the environment doesn't exist, an ``Environment.DoesNotExist``
        exception will be raised.

        This returns as a callable since some objects outside of the API
        endpoint need to handle the "environment was provided but does not
        exist" state in addition to the two non-exceptional states (the
        environment was provided and exists, or the environment was not
        provided.)
        """
        return functools.partial(self._get_environment_from_request, request, organization_id)

    def _get_environment_id_from_request(self, request, organization_id):
        environment = self._get_environment_from_request(request, organization_id)
        return environment and environment.id

    def _get_environment_from_request(self, request, organization_id):
        if not hasattr(request, "_cached_environment"):
            environment_param = request.GET.get("environment")
            if environment_param is None:
                environment = None
            else:
                environment = Environment.get_for_organization_id(
                    name=environment_param, organization_id=organization_id
                )

            request._cached_environment = environment

        return request._cached_environment


class StatsMixin(object):
    def _parse_args(self, request, environment_id=None):
        resolution = request.GET.get("resolution")
        if resolution:
            resolution = self._parse_resolution(resolution)
            assert resolution in tsdb.get_rollups()

        end = request.GET.get("until")
        if end:
            end = to_datetime(float(end))
        else:
            end = datetime.utcnow().replace(tzinfo=utc)

        start = request.GET.get("since")
        if start:
            start = to_datetime(float(start))
            assert start <= end, "start must be before or equal to end"
        else:
            start = end - timedelta(days=1, seconds=-1)

        if not resolution:
            resolution = tsdb.get_optimal_rollup(start, end)

        return {
            "start": start,
            "end": end,
            "rollup": resolution,
            "environment_ids": environment_id and [environment_id],
        }

    def _parse_resolution(self, value):
        if value.endswith("h"):
            return int(value[:-1]) * ONE_HOUR
        elif value.endswith("d"):
            return int(value[:-1]) * ONE_DAY
        elif value.endswith("m"):
            return int(value[:-1]) * ONE_MINUTE
        elif value.endswith("s"):
            return int(value[:-1])
        else:
            raise ValueError(value)
