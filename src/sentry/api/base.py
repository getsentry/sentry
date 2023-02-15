from __future__ import annotations

import functools
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Iterable, List, Mapping, Optional, Type

import sentry_sdk
from django.conf import settings
from django.http import HttpResponse
from django.utils.http import urlquote
from django.views.decorators.csrf import csrf_exempt
from pytz import utc
from rest_framework import status
from rest_framework.authentication import BaseAuthentication, SessionAuthentication
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import analytics, tsdb
from sentry.apidocs.hooks import HTTP_METHODS_SET
from sentry.auth import access
from sentry.models import Environment
from sentry.ratelimits.config import DEFAULT_RATE_LIMIT_CONFIG, RateLimitConfig
from sentry.silo import SiloLimit, SiloMode
from sentry.utils import json
from sentry.utils.audit import create_audit_entry
from sentry.utils.cursors import Cursor
from sentry.utils.dates import to_datetime
from sentry.utils.http import is_valid_origin, origin_from_request
from sentry.utils.sdk import capture_exception

from .authentication import ApiKeyAuthentication, TokenAuthentication
from .paginator import BadPaginationError, Paginator
from .permissions import NoPermission

__all__ = [
    "Endpoint",
    "EnvironmentMixin",
    "StatsMixin",
    "control_silo_endpoint",
    "region_silo_endpoint",
    "pending_silo_endpoint",
]

from ..services.hybrid_cloud.auth import ApiAuthentication, ApiAuthenticatorType
from ..utils.pagination_factory import (
    annotate_span_with_pagination_args,
    clamp_pagination_per_page,
    get_cursor,
    get_paginator,
)

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24

CURSOR_LINK_HEADER = (
    '<{uri}&cursor={cursor}>; rel="{name}"; results="{has_results}"; cursor="{cursor}"'
)

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
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage, X-CSRFToken"
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

    # end user of endpoint must set private to true, or define public endpoints
    private: Optional[bool] = None
    public: Optional[HTTP_METHODS_SET] = None

    rate_limits: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
    enforce_rate_limit: bool = settings.SENTRY_RATELIMITER_ENABLED

    def get_authenticators(self) -> List[BaseAuthentication]:
        """
        Instantiates and returns the list of authenticators that this view can use.
        Aggregates together authenticators that can be supported using HybridCloud.
        """

        # TODO: Increase test coverage and get this working for monolith mode.
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return super().get_authenticators()

        last_api_authenticator = ApiAuthentication([])
        result: List[BaseAuthentication] = []
        for authenticator_cls in self.authentication_classes:
            auth_type = ApiAuthenticatorType.from_authenticator(authenticator_cls)
            if auth_type:
                last_api_authenticator.types.append(auth_type)
            else:
                if last_api_authenticator.types:
                    result.append(last_api_authenticator)
                    last_api_authenticator = ApiAuthentication([])
                result.append(authenticator_cls())

        if last_api_authenticator.types:
            result.append(last_api_authenticator)
        return result

    def build_link_header(self, request: Request, path: str, rel: str):
        # TODO(dcramer): it would be nice to expand this to support params to consolidate `build_cursor_link`
        uri = request.build_absolute_uri(urlquote(path))
        return f'<{uri}>; rel="{rel}">'

    def build_cursor_link(self, request: Request, name: str, cursor: Cursor):
        querystring = None
        if request.GET.get("cursor") is None:
            querystring = request.GET.urlencode()
        else:
            mutable_query_dict = request.GET.copy()
            mutable_query_dict.pop("cursor")
            querystring = mutable_query_dict.urlencode()

        base_url = request.build_absolute_uri(urlquote(request.path))

        if querystring is not None:
            base_url = f"{base_url}?{querystring}"
        else:
            base_url = base_url + "?"

        return CURSOR_LINK_HEADER.format(
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
                method = request.method.lower()
                if method in self.http_method_names and hasattr(self, method):
                    handler = getattr(self, method)

                    # Only convert args when using defined handlers
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
            return clamp_pagination_per_page(
                request.GET.get("per_page", default_per_page),
                default_per_page=default_per_page,
                max_per_page=max_per_page,
            )
        except ValueError as e:
            raise ParseError(detail=str(e))

    def get_cursor_from_request(self, request: Request, cursor_cls=Cursor):
        try:
            return get_cursor(request.GET.get(self.cursor_name), cursor_cls)
        except ValueError as e:
            raise ParseError(detail=str(e))

    def paginate(
        self,
        request,
        on_results=None,
        paginator=None,
        paginator_cls=Paginator,
        default_per_page=100,
        max_per_page=100,
        cursor_cls=Cursor,
        response_cls=Response,
        response_kwargs=None,
        count_hits=None,
        **paginator_kwargs,
    ):
        try:
            per_page = self.get_per_page(request, default_per_page, max_per_page)
            cursor = self.get_cursor_from_request(request, cursor_cls)
            with sentry_sdk.start_span(
                op="base.paginate.get_result",
                description=type(self).__name__,
            ) as span:
                annotate_span_with_pagination_args(span, per_page)
                paginator = get_paginator(paginator, paginator_cls, paginator_kwargs)
                result_args = dict(count_hits=count_hits) if count_hits is not None else dict()
                cursor_result = paginator.get_result(
                    limit=per_page,
                    cursor=cursor,
                    **result_args,
                )
        except BadPaginationError as e:
            raise ParseError(detail=str(e))

        if response_kwargs is None:
            response_kwargs = {}

        # map results based on callback
        if on_results:
            with sentry_sdk.start_span(
                op="base.paginate.on_results",
                description=type(self).__name__,
            ):
                results = on_results(cursor_result.results)
        else:
            results = cursor_result.results

        response = response_cls(results, **response_kwargs)
        self.add_cursor_headers(request, response, cursor_result)
        return response


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


def resolve_region(request: Request):
    subdomain = getattr(request, "subdomain", None)
    if subdomain is None:
        return None
    if subdomain in {"us", "eu"}:
        return subdomain
    return None


class EndpointSiloLimit(SiloLimit):
    def modify_endpoint_class(self, decorated_class: Type[Endpoint]) -> type:
        dispatch_override = self.create_override(decorated_class.dispatch)
        new_class = type(
            decorated_class.__name__,
            (decorated_class,),
            {
                "dispatch": dispatch_override,
                "silo_limit": self,
            },
        )
        new_class.__module__ = decorated_class.__module__
        return new_class

    def create_override(
        self,
        original_method: Callable[..., Any],
        extra_modes: Iterable[SiloMode] = (),
    ) -> Callable[..., Any]:
        limiting_override = super().create_override(original_method, extra_modes)

        def single_process_silo_mode_wrapper(*args: Any, **kwargs: Any) -> Any:
            if SiloMode.single_process_silo_mode():
                entering_mode: SiloMode = SiloMode.MONOLITH
                for mode in self.modes:
                    # Select a mode, if available, from the target modes.
                    entering_mode = mode
                with SiloMode.enter_single_process_silo_context(entering_mode):
                    return limiting_override(*args, **kwargs)
            else:
                return limiting_override(*args, **kwargs)

        functools.update_wrapper(single_process_silo_mode_wrapper, limiting_override)
        return single_process_silo_mode_wrapper

    def modify_endpoint_method(self, decorated_method: Callable[..., Any]) -> Callable[..., Any]:
        return self.create_override(decorated_method)

    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        def handle(obj: Any, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
            mode_str = ", ".join(str(m) for m in available_modes)
            message = (
                f"Received {request.method} request at {request.path!r} to server in "
                f"{current_mode} mode. This endpoint is available only in: {mode_str}"
            )
            if settings.FAIL_ON_UNAVAILABLE_API_CALL:
                raise self.AvailabilityError(message)
            else:
                logger.warning(message)
                return HttpResponse(status=status.HTTP_404_NOT_FOUND)

        return handle

    def __call__(self, decorated_obj: Any) -> Any:
        if isinstance(decorated_obj, type):
            if not issubclass(decorated_obj, Endpoint):
                raise ValueError("`@EndpointSiloLimit` can decorate only Endpoint subclasses")
            return self.modify_endpoint_class(decorated_obj)

        if callable(decorated_obj):
            return self.modify_endpoint_method(decorated_obj)

        raise TypeError("`@EndpointSiloLimit` must decorate a class or method")


control_silo_endpoint = EndpointSiloLimit(SiloMode.CONTROL)
region_silo_endpoint = EndpointSiloLimit(SiloMode.REGION)

# Use this decorator to mark endpoints that still need to be marked as either
# control_silo_endpoint or region_silo_endpoint. Marking a class with
# pending_silo_endpoint keeps it from tripping SiloLimitCoverageTest, while ensuring
# that the test will fail if a new endpoint is added with no decorator at all.
# Eventually we should replace all instances of this decorator and delete it.
pending_silo_endpoint = EndpointSiloLimit()
