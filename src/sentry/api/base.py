from __future__ import annotations

import functools
import logging
import time
from abc import abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Iterable, Mapping, Optional

import sentry_sdk
from django.conf import settings
from django.http import HttpResponse
from django.http.response import Http404
from django.utils.http import urlquote
from django.views.decorators.csrf import csrf_exempt
from pytz import utc
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import analytics, tsdb
from sentry.auth import access
from sentry.models import Environment
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json
from sentry.utils.audit import create_audit_entry
from sentry.utils.cursors import Cursor
from sentry.utils.dates import to_datetime
from sentry.utils.http import absolute_uri, is_valid_origin, origin_from_request
from sentry.utils.sdk import capture_exception

from .authentication import ApiKeyAuthentication, TokenAuthentication
from .paginator import BadPaginationError, Paginator
from .permissions import NoPermission

__all__ = ["Endpoint", "EnvironmentMixin", "StatsMixin"]

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24

LINK_HEADER = '<{uri}&cursor={cursor}>; rel="{name}"; results="{has_results}"; cursor="{cursor}"'

DEFAULT_AUTHENTICATION = (TokenAuthentication, ApiKeyAuthentication, SessionAuthentication)

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("sentry.audit.api")
api_access_logger = logging.getLogger("sentry.access.api")


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
    def allow_cors_options_wrapper(self, request: Request, *args, **kwargs):

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

    cursor_name = "cursor"

    # Default Rate Limit Values, override in subclass
    # Should be of format: { <http function>: { <category>: RateLimit(limit, window) } }
    rate_limits: Mapping[str, Mapping[RateLimitCategory | str, RateLimit]] = {}
    enforce_rate_limit: bool = settings.SENTRY_RATELIMITER_ENABLED

    def build_cursor_link(self, request: Request, name, cursor):
        querystring = None
        if request.GET.get("cursor") is None:
            querystring = request.GET.urlencode()
        else:
            mutable_query_dict = request.GET.copy()
            mutable_query_dict.pop("cursor")
            querystring = mutable_query_dict.urlencode()

        base_url = absolute_uri(urlquote(request.path))

        if querystring is not None:
            base_url = f"{base_url}?{querystring}"
        else:
            base_url = base_url + "?"

        return LINK_HEADER.format(
            uri=base_url,
            cursor=str(cursor),
            name=name,
            has_results="true" if bool(cursor) else "false",
        )

    def convert_args(self, request: Request, *args, **kwargs):
        return (args, kwargs)

    def handle_exception(self, request: Request, exc):
        try:
            response = super().handle_exception(exc)
        except Exception:
            import sys
            import traceback

            sys.stderr.write(traceback.format_exc())
            event_id = capture_exception()
            context = {"detail": "Internal Error", "errorId": event_id}
            response = Response(context, status=500)
            response.exception = True
        return response

    def create_audit_entry(self, request: Request, transaction_id=None, **kwargs):
        return create_audit_entry(request, transaction_id, audit_logger, **kwargs)

    def load_json_body(self, request: Request):
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

    def initialize_request(self, request: Request, *args, **kwargs):
        # XXX: Since DRF 3.x, when the request is passed into
        # `initialize_request` it's set as an internal variable on the returned
        # request. Then when we call `rv.auth` it attempts to authenticate,
        # fails and sets `user` and `auth` to None on the internal request. We
        # keep track of these here and reassign them as needed.
        orig_auth = getattr(request, "auth", None)
        orig_user = getattr(request, "user", None)
        rv = super().initialize_request(request, *args, **kwargs)
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
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
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

        start_time = time.time()

        origin = request.META.get("HTTP_ORIGIN", "null")
        # A "null" value should be treated as no Origin for us.
        # See RFC6454 for more information on this behavior.
        if origin == "null":
            origin = None

        try:
            with sentry_sdk.start_span(op="base.dispatch.request", description=type(self).__name__):
                if origin:
                    if request.auth:
                        allowed_origins = request.auth.get_allowed_origins()
                    else:
                        allowed_origins = None
                    if not is_valid_origin(origin, allowed=allowed_origins):
                        response = Response(f"Invalid origin: {origin}", status=400)
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
                description=f"{type(self).__name__}.{handler.__name__}",
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
                    op="base.dispatch.sleep",
                    description=type(self).__name__,
                ) as span:
                    span.set_data("SENTRY_API_RESPONSE_DELAY", settings.SENTRY_API_RESPONSE_DELAY)
                    time.sleep(settings.SENTRY_API_RESPONSE_DELAY / 1000.0 - duration)

        return self.response

    def add_cors_headers(self, request: Request, response):
        response["Access-Control-Allow-Origin"] = request.META["HTTP_ORIGIN"]
        response["Access-Control-Allow-Methods"] = ", ".join(self.http_method_names)

    def add_cursor_headers(self, request: Request, response, cursor_result):
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

    def respond(self, context: Mapping[str, Any] | None = None, **kwargs: Any) -> Response:
        return Response(context, **kwargs)

    def respond_with_text(self, text):
        return self.respond({"text": text})

    def get_per_page(self, request: Request, default_per_page=100, max_per_page=100):
        try:
            per_page = int(request.GET.get("per_page", default_per_page))
        except ValueError:
            raise ParseError(detail="Invalid per_page parameter.")

        max_per_page = max(max_per_page, default_per_page)
        if per_page > max_per_page:
            raise ParseError(detail=f"Invalid per_page value. Cannot exceed {max_per_page}.")

        return per_page

    def get_cursor_from_request(self, request: Request, cursor_cls=Cursor):
        if not request.GET.get(self.cursor_name):
            return

        try:
            return cursor_cls.from_string(request.GET.get(self.cursor_name))
        except ValueError:
            raise ParseError(detail="Invalid cursor parameter.")

    def paginate(
        self,
        request,
        on_results=None,
        paginator=None,
        paginator_cls=Paginator,
        default_per_page=100,
        max_per_page=100,
        cursor_cls=Cursor,
        **paginator_kwargs,
    ):
        assert (paginator and not paginator_kwargs) or (paginator_cls and paginator_kwargs)

        per_page = self.get_per_page(request, default_per_page, max_per_page)

        input_cursor = self.get_cursor_from_request(request, cursor_cls=cursor_cls)

        if not paginator:
            paginator = paginator_cls(**paginator_kwargs)

        try:
            with sentry_sdk.start_span(
                op="base.paginate.get_result",
                description=type(self).__name__,
            ) as span:
                span.set_data("Limit", per_page)
                cursor_result = paginator.get_result(limit=per_page, cursor=input_cursor)
        except BadPaginationError as e:
            raise ParseError(detail=str(e))

        # map results based on callback
        if on_results:
            with sentry_sdk.start_span(
                op="base.paginate.on_results",
                description=type(self).__name__,
            ):
                results = on_results(cursor_result.results)
        else:
            results = cursor_result.results

        response = Response(results)

        self.add_cursor_headers(request, response, cursor_result)

        return response


@dataclass
class MethodVersion:
    """Structure for mapping an endpoint method as a versioned handler."""

    body: Callable
    http_method: str
    version: int = 1

    def __post_init__(self):
        if self.version <= 0:
            raise ValueError("version must be positive")
        if self.http_method not in APIView.http_method_names:
            raise ValueError(f"http_method must be one of: {APIView.http_method_names}")


class _MethodVersionTable:
    """A table of all handler methods on a versioned endpoint."""

    def __init__(self) -> None:
        self._table: Dict[str, Dict[int, MethodVersion]] = defaultdict(dict)

    def register(self, mv: MethodVersion) -> None:
        method_table = self._table[mv.http_method]
        if mv.version in method_table:
            raise VersionedApiValidationError(
                f"Multiple methods mapped to [method={mv.http_method!r}, version={mv.version!r}]"
            )
        method_table[mv.version] = mv

    def supports_http_method(self, http_method: str) -> bool:
        """Check whether the endpoint supports an HTTP method.

        This determines whether a 405 response status is appropriate.
        """
        return bool(self._table[http_method])

    def get_method_version(self, http_method: str, version: int) -> Optional[Callable]:
        """Look up a method version, or None if it doesn't exist."""
        mv = self._table[http_method].get(version)
        return mv and mv.body


class VersionedApiValidationError(Exception):
    pass


class VersionedEndpoint(Endpoint):
    """An endpoint with that takes requests for multiple versions.

    Do not override the handlers for HTTP methods (such as `get`) as you would in a
    regular Endpoint class. Instead, create a uniquely named handler method for each
    version and represent them as MethodVersion objects in declare_method_versions.
    """

    _method_version_table = None

    def __init_subclass__(cls) -> None:
        cls._method_version_table = _MethodVersionTable()
        for mv in cls.declare_method_versions():
            cls._method_version_table.register(mv)

        for method_name in cls.http_method_names:
            cls._validate_method_override(method_name)

    @classmethod
    @abstractmethod
    def declare_method_versions(cls) -> Iterable[MethodVersion]:
        """Declare each versioned handler method.

        Example:
        ```
            class MyEndpoint(VersionedEndpoint):
                def get_v1(self, request):
                    return serialize(something())

                def get_v2(self, request):
                    return serialize(something_else())

                @classmethod
                def declare_method_versions(cls):
                    yield MethodVersion(cls.get_v1, "get", 1)
                    yield MethodVersion(cls.get_v2, "get", 2)
        ```
        """
        raise NotImplementedError

    @classmethod
    def _validate_method_override(cls, method_name: str) -> None:
        """Check that a subclass doesn't improperly override a base method.

        If a VersionedEndpoint subclass declares one or more method versions for an
        HTTP method, it must not override the base handler for the same HTTP method.
        """
        if cls._method_version_table.supports_http_method(method_name):
            base_method = getattr(VersionedEndpoint, method_name)
            subclass_method = getattr(cls, method_name)
            if subclass_method is not base_method:
                raise VersionedApiValidationError(f"{cls.__name__} must not override {method_name}")

    def _dispatch_to_version(self, http_method: str, request, *args, **kwargs):
        if http_method not in self.http_method_names:
            raise VersionedApiValidationError(
                f"Method name ({http_method!r}) must be one of: {self.http_method_names!r} "
                "(don't call _dispatch_to_version from VersionedEndpoint subclasses)"
            )

        if not self._method_version_table.supports_http_method(http_method):
            return self.http_method_not_allowed(request)

        kwargs.pop("version", None)
        try:
            version = int(request.version) if request.version else 1
        except ValueError:
            raise Http404("Version must be an integer")

        method_version = self._method_version_table.get_method_version(http_method, version)
        if method_version is None:
            raise Http404("Version does not exist")
        return method_version(self, request, *args, **kwargs)

    # We expect Endpoint.dispatch to hit the methods below.
    # Subclasses must use different names to avoid overriding these.

    def get(self, request, *args, **kwargs):
        return self._dispatch_to_version("get", request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self._dispatch_to_version("post", request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        return self._dispatch_to_version("put", request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        return self._dispatch_to_version("patch", request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self._dispatch_to_version("delete", request, *args, **kwargs)

    def head(self, request, *args, **kwargs):
        return self._dispatch_to_version("head", request, *args, **kwargs)

    def options(self, request, *args, **kwargs):
        return self._dispatch_to_version("options", request, *args, **kwargs)

    def trace(self, request, *args, **kwargs):
        return self._dispatch_to_version("trace", request, *args, **kwargs)


class EnvironmentMixin:
    def _get_environment_func(self, request: Request, organization_id):
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

    def _get_environment_id_from_request(self, request: Request, organization_id):
        environment = self._get_environment_from_request(request, organization_id)
        return environment and environment.id

    def _get_environment_from_request(self, request: Request, organization_id):
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


class StatsMixin:
    def _parse_args(self, request: Request, environment_id=None):
        try:
            resolution = request.GET.get("resolution")
            if resolution:
                resolution = self._parse_resolution(resolution)
                if resolution not in tsdb.get_rollups():
                    raise ValueError
        except ValueError:
            raise ParseError(detail="Invalid resolution")

        try:
            end = request.GET.get("until")
            if end:
                end = to_datetime(float(end))
            else:
                end = datetime.utcnow().replace(tzinfo=utc)
        except ValueError:
            raise ParseError(detail="until must be a numeric timestamp.")

        try:
            start = request.GET.get("since")
            if start:
                start = to_datetime(float(start))
                assert start <= end
            else:
                start = end - timedelta(days=1, seconds=-1)
        except ValueError:
            raise ParseError(detail="since must be a numeric timestamp")
        except AssertionError:
            raise ParseError(detail="start must be before or equal to end")

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


class ReleaseAnalyticsMixin:
    def track_set_commits_local(self, request: Request, organization_id=None, project_ids=None):
        analytics.record(
            "release.set_commits_local",
            user_id=request.user.id if request.user and request.user.id else None,
            organization_id=organization_id,
            project_ids=project_ids,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
