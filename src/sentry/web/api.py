from __future__ import absolute_import, print_function

import base64
import math

import io
import jsonschema
import logging
import random
import six
import traceback
import uuid

from time import time

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.core.files import uploadhandler
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotAllowed
from django.http.multipartparser import MultiPartParser
from django.utils.encoding import force_bytes
from django.views.decorators.cache import never_cache, cache_control
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View as BaseView
from functools import wraps
from querystring_parser import parser
from symbolic import ProcessMinidumpError, Unreal4Crash, Unreal4Error
from sentry_relay import ProcessingErrorInvalidTransaction

from sentry import features, options, quotas
from sentry.attachments import CachedAttachment
from sentry.constants import DataCategory, ObjectStatus
from sentry.coreapi import (
    Auth,
    APIError,
    APIForbidden,
    APIRateLimited,
    ClientApiHelper,
    ClientAuthHelper,
    SecurityAuthHelper,
    MinidumpAuthHelper,
    safely_load_json_string,
    logger as api_logger,
)
from sentry.event_manager import EventManager
from sentry.interfaces import schemas
from sentry.interfaces.base import get_interface
from sentry.lang.native.unreal import (
    merge_unreal_user,
    unreal_attachment_type,
    merge_unreal_context_event,
    merge_unreal_logs_event,
    write_applecrashreport_placeholder,
)

from sentry.lang.native.minidump import (
    merge_attached_event,
    merge_attached_breadcrumbs,
    write_minidump_placeholder,
    MINIDUMP_ATTACHMENT_TYPE,
)
from sentry.models import Project, File, EventAttachment, Organization
from sentry.signals import event_accepted, event_received
from sentry.quotas.base import RateLimit
from sentry.utils import json, metrics
from sentry.utils.data_filters import FilterStatKeys
from sentry.utils.http import is_valid_origin, get_origins, is_same_domain, origin_from_request
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.pubsub import QueuedPublisherService, KafkaPublisher
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import configure_scope
from sentry.web.helpers import render_to_response
from sentry.web.client_config import get_client_config
from sentry.relay.config import get_project_config
from sentry.datascrubbing import scrub_data

logger = logging.getLogger("sentry")
minidumps_logger = logging.getLogger("sentry.minidumps")

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = base64.b64decode("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=")

PROTOCOL_VERSIONS = frozenset(("2.0", "3", "4", "5", "6", "7"))

kafka_publisher = (
    QueuedPublisherService(
        KafkaPublisher(
            getattr(settings, "KAFKA_RAW_EVENTS_PUBLISHER_CONNECTION", None), asynchronous=False
        )
    )
    if getattr(settings, "KAFKA_RAW_EVENTS_PUBLISHER_ENABLED", False)
    else None
)


def allow_cors_options(func):
    """
    Decorator that adds automatic handling of OPTIONS requests for CORS

    If the request is OPTIONS (i.e. pre flight CORS) construct a OK (200) response
    in which we explicitly enable the caller and add the custom headers that we support
    For other requests just add the appropriate CORS headers

    :param func: the original request handler
    :return: a request handler that shortcuts OPTIONS requests and just returns an OK (CORS allowed)
    """

    @wraps(func)
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


def disable_transaction_events():
    """
    Do not send a transaction event for the current transaction.

    This is used in StoreView to prevent infinite recursion.
    """
    with configure_scope() as scope:
        if scope.span:
            scope.span.sampled = False


def api(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        data = func(request, *args, **kwargs)
        if request.is_ajax():
            response = HttpResponse(data)
            response["Content-Type"] = "application/json"
        else:
            ref = request.META.get("HTTP_REFERER")
            if ref is None or not is_same_domain(ref, request.build_absolute_uri()):
                ref = reverse("sentry")
            return HttpResponseRedirect(ref)
        return response

    return wrapped


def _get_project_id_from_request(project_id, request, auth_helper_cls, helper):
    """
    Tries to return the project id (as a string) from the request params or from the auth info

    :param project_id: the project id from the url (or None if not specified)
    :param request: the HTTP request
    :param auth_helper_cls: Authentication helper class (from APIView)
    :param helper: client API helper
    :return: the project id (as string) if found raises if not found

    :raises APIUnauthorized if bad Authorization header detected or the key is not usable (e.g. disabled)
    """
    if project_id is not None:
        # we have an explicit project id, just return it
        return six.text_type(project_id)
    else:  # look in the authentication information for the project id
        auth = auth_helper_cls.auth_from_request(request)
        return helper.project_id_from_auth(auth)


def process_event(event_manager, project, key, remote_addr, helper, attachments, project_config):
    event_received.send_robust(ip=remote_addr, project=project, sender=process_event)

    start_time = time()

    data = event_manager.get_data()
    should_filter, filter_reason = event_manager.should_filter()
    del event_manager

    event_id = data["event_id"]
    data_category = DataCategory.from_event_type(data.get("type"))

    if should_filter:
        track_outcome(
            project_config.organization_id,
            project_config.project_id,
            key.id,
            Outcome.FILTERED,
            filter_reason,
            event_id=event_id,
            category=data_category,
        )
        metrics.incr("events.blacklisted", tags={"reason": filter_reason}, skip_internal=False)

        # relay will no longer be able to provide information about filter
        # status so to see the impact we're adding a way to turn on relay
        # like behavior here.
        if options.get("store.lie-about-filter-status"):
            return event_id

        raise APIForbidden("Event dropped due to filter: %s" % (filter_reason,))

    # TODO: improve this API (e.g. make RateLimit act on __ne__)
    rate_limit = safe_execute(
        quotas.is_rate_limited, project=project, key=key, _with_transaction=False
    )
    if isinstance(rate_limit, bool):
        rate_limit = RateLimit(is_limited=rate_limit, retry_after=None)

    # XXX(dcramer): when the rate limiter fails we drop events to ensure
    # it cannot cascade
    if rate_limit is None or rate_limit.is_limited:
        if rate_limit is None:
            api_logger.debug("Dropped event due to error with rate limiter")

        reason = rate_limit.reason_code if rate_limit else None
        track_outcome(
            project_config.organization_id,
            project_config.project_id,
            key.id,
            Outcome.RATE_LIMITED,
            reason,
            event_id=event_id,
            category=data_category,
        )
        metrics.incr("events.dropped", tags={"reason": reason or "unknown"}, skip_internal=False)

        if rate_limit is not None:
            raise APIRateLimited(rate_limit.retry_after)

    # TODO(dcramer): ideally we'd only validate this if the event_id was
    # supplied by the user
    cache_key = "ev:%s:%s" % (project_config.project_id, event_id)

    # XXX(markus): I believe this code is extremely broken:
    #
    # * it practically uses memcached in prod which has no consistency
    #   guarantees (no idea how we don't run into issues there)
    #
    # * a TTL of 1h basically doesn't guarantee any deduplication at all. It
    #   just guarantees a good error message... for one hour.
    if cache.get(cache_key) is not None:
        track_outcome(
            project_config.organization_id,
            project_config.project_id,
            key.id,
            Outcome.INVALID,
            "duplicate",
            event_id=event_id,
            category=data_category,
        )
        raise APIForbidden("An event with the same ID already exists (%s)" % (event_id,))

    data = scrub_data(project_config, dict(data))

    # mutates data (strips a lot of context if not queued)
    helper.insert_data_to_database(data, start_time=start_time, attachments=attachments)

    cache.set(cache_key, "", 60 * 60)  # Cache for 1 hour

    api_logger.debug("New event received (%s)", event_id)

    event_accepted.send_robust(ip=remote_addr, data=data, project=project, sender=process_event)

    return event_id


class APIView(BaseView):
    auth_helper_cls = ClientAuthHelper

    def _get_project_from_id(self, project_id):
        if not project_id:
            return
        if not project_id.isdigit():
            track_outcome(0, 0, None, Outcome.INVALID, "project_id")
            raise APIError("Invalid project_id: %r" % project_id)
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            track_outcome(0, 0, None, Outcome.INVALID, "project_id")
            raise APIError("Invalid project_id: %r" % project_id)
        else:
            if project.status != ObjectStatus.VISIBLE:
                track_outcome(0, 0, None, Outcome.INVALID, "project_id")
                raise APIError("Invalid project_id: %r" % project_id)
            return project

    def _parse_header(self, request, project_config):
        auth = self.auth_helper_cls.auth_from_request(request)

        if auth.version not in PROTOCOL_VERSIONS:
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                None,
                Outcome.INVALID,
                "auth_version",
            )
            raise APIError(
                "Client using unsupported server protocol version (%r)"
                % six.text_type(auth.version or "")
            )

        if not auth.client:
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                None,
                Outcome.INVALID,
                "auth_client",
            )
            raise APIError("Client did not send 'client' identifier")

        return auth

    def _publish_to_kafka(self, request, project_config):
        """
        Sends raw event data to Kafka for later offline processing.
        """
        try:
            raw_event_sample_rate = options.get("kafka-publisher.raw-event-sample-rate")

            # Early return if sampling is disabled
            if raw_event_sample_rate == 0:
                return

            # This may fail when we e.g. send a multipart form. We ignore those errors for now.
            data = request.body

            if not data or len(data) > options.get("kafka-publisher.max-event-size"):
                return

            # Sampling
            if random.random() >= raw_event_sample_rate:
                return

            # We want to send only serializable items from request.META
            meta = {}
            for key, value in request.META.items():
                try:
                    json.dumps([key, value])
                    meta[key] = value
                except (TypeError, ValueError):
                    pass

            meta["SENTRY_API_VIEW_NAME"] = self.__class__.__name__

            kafka_publisher.publish(
                channel=getattr(settings, "KAFKA_RAW_EVENTS_PUBLISHER_TOPIC", "raw-store-events"),
                value=json.dumps([meta, base64.b64encode(data), project_config.to_dict()]),
            )
        except Exception as e:
            logger.debug("Cannot publish event to Kafka: {}".format(six.text_type(e)))

    @csrf_exempt
    @never_cache
    @allow_cors_options
    def dispatch(self, request, project_id=None, *args, **kwargs):
        helper = None
        try:
            helper = ClientApiHelper(
                agent=request.META.get("HTTP_USER_AGENT"),
                project_id=project_id,
                ip_address=request.META["REMOTE_ADDR"],
            )

            # if the project id is not directly specified get it from the authentication information
            project_id = _get_project_id_from_request(
                project_id, request, self.auth_helper_cls, helper
            )

            project = self._get_project_from_id(six.text_type(project_id))

            # Explicitly bind Organization so we don't implicitly query it later
            # this just allows us to comfortably assure that `project.organization` is safe.
            # This also allows us to pull the object from cache, instead of being
            # implicitly fetched from database.
            project.organization = Organization.objects.get_from_cache(id=project.organization_id)

            # XXX: This never returns a disabled project since visibility of the
            # project is already verified in `self._get_project_from_id`.
            project_config = get_project_config(project)

            helper.context.bind_project(project_config.project)

            if kafka_publisher is not None:
                self._publish_to_kafka(request, project_config)

            origin = self.auth_helper_cls.origin_from_request(request)

            response = self._dispatch(
                request, helper, project_config, origin=origin, *args, **kwargs
            )
        except APIError as e:
            context = {"error": force_bytes(e.msg, errors="replace")}
            if e.name:
                context["error_name"] = e.name

            response = HttpResponse(
                json.dumps(context), content_type="application/json", status=e.http_status
            )
            # Set X-Sentry-Error as in many cases it is easier to inspect the headers
            response["X-Sentry-Error"] = context["error"]

            if isinstance(e, APIRateLimited) and e.retry_after is not None:
                response["Retry-After"] = six.text_type(int(math.ceil(e.retry_after)))

        except Exception as e:
            # TODO(dcramer): test failures are not outputting the log message
            # here
            if settings.DEBUG:
                content = traceback.format_exc()
            else:
                content = ""
            logger.exception(e)
            response = HttpResponse(content, content_type="text/plain", status=500)

        # TODO(dcramer): it'd be nice if we had an incr_multi method so
        # tsdb could optimize this
        metrics.incr("client-api.all-versions.requests", skip_internal=False)
        metrics.incr(
            "client-api.all-versions.responses.%s" % (response.status_code,), skip_internal=False
        )
        metrics.incr(
            "client-api.all-versions.responses.%sxx" % (six.text_type(response.status_code)[0],),
            skip_internal=False,
        )

        if helper is not None and helper.context is not None and helper.context.version:
            metrics.incr("client-api.v%s.requests" % (helper.context.version,), skip_internal=False)
            metrics.incr(
                "client-api.v%s.responses.%s" % (helper.context.version, response.status_code),
                skip_internal=False,
            )
            metrics.incr(
                "client-api.v%s.responses.%sxx"
                % (helper.context.version, six.text_type(response.status_code)[0]),
                skip_internal=False,
            )

        return response

    def _dispatch(self, request, helper, project_config, origin=None, *args, **kwargs):
        request.user = AnonymousUser()

        project = project_config.project
        config = project_config.config
        allowed = config.get("allowedDomains")

        if origin is not None:
            if not is_valid_origin(origin, allowed=allowed):
                track_outcome(
                    project_config.organization_id,
                    project_config.project_id,
                    None,
                    Outcome.INVALID,
                    FilterStatKeys.CORS,
                )
                raise APIForbidden("Invalid origin: %s" % (origin,))

        auth = self._parse_header(request, project_config)

        key = helper.project_key_from_auth(auth)

        # Legacy API was /api/store/ and the project ID was only available elsewhere
        if six.text_type(key.project_id) != six.text_type(project_config.project_id):
            raise APIError("Two different projects were specified")

        helper.context.bind_auth(auth)

        response = super(APIView, self).dispatch(
            request=request,
            project=project,
            auth=auth,
            helper=helper,
            key=key,
            project_config=project_config,
            **kwargs
        )
        return response

    # XXX: backported from Django 1.5
    def _allowed_methods(self):
        return [m.upper() for m in self.http_method_names if hasattr(self, m)]

    def options(self, request, *args, **kwargs):
        """
        Serves requests for OPTIONS

        NOTE: This function is not called since it is shortcut by the @allow_cors_options descriptor.
            It is nevertheless used to construct the allowed http methods and it should not be removed.
        """
        raise NotImplementedError(
            "Options request should have been handled by @allow_cors_options.\n"
            "If dispatch was overridden either decorate it with @allow_cors_options or provide "
            "a valid implementation for options."
        )


class StoreView(APIView):
    """
    The primary endpoint for storing new events.

    This will validate the client's authentication and data, and if
    successful pass on the payload to the internal database handler.

    Authentication works in three flavors:

    1. Explicit signed requests

       These are implemented using the documented signed request protocol, and
       require an authentication header which is signed using with the project
       member's secret key.

    2. CORS Secured Requests

       Generally used for communications with client-side platforms (such as
       JavaScript in the browser), they require a standard header, excluding
       the signature and timestamp requirements, and must be listed in the
       origins for the given project (or the global origins).

    3. Implicit trusted requests

       Used by the Sentry core, they are only available from same-domain requests
       and do not require any authentication information. They only require that
       the user be authenticated, and a project_id be sent in the GET variables.

    """

    type_name = "store"

    def post(self, request, **kwargs):
        try:
            data = request.body
        except Exception as e:
            logger.exception(e)
            # We were unable to read the body.
            # This would happen if a request were submitted
            # as a multipart form for example, where reading
            # body yields an Exception. There's also not a more
            # sane exception to catch here. This will ultimately
            # bubble up as an APIError.
            data = None

        event_id = self.process(request, data=data, **kwargs)
        return HttpResponse(json.dumps({"id": event_id}), content_type="application/json")

    def get(self, request, **kwargs):
        data = request.GET.get("sentry_data", "")
        event_id = self.process(request, data=data, **kwargs)

        # Return a simple 1x1 gif for browser so they don't throw a warning
        response = HttpResponse(PIXEL, "image/gif")
        response["X-Sentry-ID"] = event_id
        return response

    def pre_normalize(self, data, helper):
        """Mutate the given EventManager. Hook for subtypes of StoreView (CSP)"""
        pass

    def process(
        self, request, project, key, auth, helper, data, project_config, attachments=None, **kwargs
    ):
        disable_transaction_events()
        metrics.incr("events.total", skip_internal=False)

        project_id = project_config.project_id
        organization_id = project_config.organization_id

        if not data:
            track_outcome(organization_id, project_id, key.id, Outcome.INVALID, "no_data")
            raise APIError("No JSON data was found")

        remote_addr = request.META["REMOTE_ADDR"]

        event_manager = EventManager(
            data,
            project=project,
            key=key,
            auth=auth,
            client_ip=remote_addr,
            user_agent=helper.context.agent,
            version=auth.version,
            content_encoding=request.META.get("HTTP_CONTENT_ENCODING", ""),
            project_config=project_config,
        )
        del data

        self.pre_normalize(event_manager, helper)

        try:
            event_manager.normalize()
        except ProcessingErrorInvalidTransaction as e:
            track_outcome(
                organization_id,
                project_id,
                key.id,
                Outcome.INVALID,
                "invalid_transaction",
                category=DataCategory.TRANSACTION,
            )
            raise APIError(six.text_type(e).split("\n", 1)[0])

        data = event_manager.get_data()
        dict_data = dict(data)
        data_size = len(json.dumps(dict_data))

        if data_size > 10000000:
            metrics.timing("events.size.rejected", data_size)
            track_outcome(
                organization_id,
                project_id,
                key.id,
                Outcome.INVALID,
                "too_large",
                event_id=dict_data.get("event_id"),
                category=DataCategory.from_event_type(dict_data.get("type")),
            )
            raise APIForbidden("Event size exceeded 10MB after normalization.")

        metrics.timing("events.size.data.post_storeendpoint", data_size)

        return process_event(
            event_manager, project, key, remote_addr, helper, attachments, project_config
        )


class EventAttachmentStoreView(StoreView):
    def post(self, request, project, event_id, project_config, **kwargs):
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            raise APIForbidden("Event attachments are not enabled for this organization.")

        project_id = project_config.project_id

        if len(request.FILES) == 0:
            return HttpResponse(status=400)

        for name, uploaded_file in six.iteritems(request.FILES):
            file = File.objects.create(
                name=uploaded_file.name,
                type="event.attachment",
                headers={"Content-Type": uploaded_file.content_type},
            )
            file.putfile(uploaded_file)

            EventAttachment.objects.create(
                project_id=project_id, event_id=event_id, name=uploaded_file.name, file=file
            )

        return HttpResponse(status=201)


class MinidumpView(StoreView):
    auth_helper_cls = MinidumpAuthHelper
    dump_types = ("application/octet-stream", "application/x-dmp")
    content_types = ("multipart/form-data",) + dump_types

    def _dispatch(
        self, request, helper, project_config, origin=None, config_flags=None, *args, **kwargs
    ):

        # TODO(ja): Refactor shared code with CspReportView. Especially, look at
        # the sentry_key override and test it.

        # A minidump submission as implemented by Breakpad and Crashpad or any
        # other library following the Mozilla Soccorro protocol is a POST request
        # without Origin or Referer headers. Therefore, we cannot validate the
        # origin of the request, but we *can* validate the "prod" key in future.
        if request.method != "POST":
            track_outcome(0, 0, None, Outcome.INVALID, "disallowed_method")
            return HttpResponseNotAllowed(["POST"])

        content_type = request.META.get("CONTENT_TYPE")
        # In case of multipart/form-data, the Content-Type header also includes
        # a boundary. Therefore, we cannot check for an exact match.
        if content_type is None or not content_type.startswith(self.content_types):
            track_outcome(0, 0, None, Outcome.INVALID, "content_type")
            raise APIError("Invalid Content-Type")

        request.user = AnonymousUser()

        project_id = project_config.project_id
        project = project_config.project

        # This is yanking the auth from the querystring since it's not
        # in the POST body. This means we expect a `sentry_key` and
        # `sentry_version` to be set in querystring
        auth = self.auth_helper_cls.auth_from_request(request)

        key = helper.project_key_from_auth(auth)
        if key.project_id != project_id:
            track_outcome(
                project_config.organization_id,
                project_id,
                None,
                Outcome.INVALID,
                "multi_project_id",
            )
            raise APIError("Two different projects were specified")

        helper.context.bind_auth(auth)

        return super(APIView, self).dispatch(
            request=request,
            project=project,
            auth=auth,
            helper=helper,
            key=key,
            project_config=project_config,
            **kwargs
        )

    def post(self, request, project, project_config, **kwargs):
        # Minidump request payloads do not have the same structure as usual
        # events from other SDKs. The minidump can either be transmitted as
        # request body, or as `upload_file_minidump` in a multipart formdata
        # request. Optionally, an event payload can be sent in the `sentry` form
        # field, either as JSON or as nested form data.

        request_files = request.FILES or {}
        content_type = request.META.get("CONTENT_TYPE")

        # Track these submissions statically as ERROR. Relay infers properly.
        data_category = DataCategory.ERROR

        if content_type in self.dump_types:
            minidump = io.BytesIO(request.body)
            minidump_name = "Minidump"
            data = {}
        else:
            minidump = request_files.get("upload_file_minidump")
            minidump_name = minidump and minidump.name or None

            if any(key.startswith("sentry[") for key in request.POST):
                # First, try to parse the nested form syntax `sentry[key][key]`
                # This is required for the Breakpad client library, which only
                # supports string values of up to 64 characters.
                extra = parser.parse(request.POST.urlencode())
                data = extra.pop("sentry", {})
            else:
                # Custom clients can submit longer payloads and should JSON
                # encode event data into the optional `sentry` field.
                extra = request.POST.dict()
                json_data = extra.pop("sentry", None)
                try:
                    data = json.loads(json_data) if json_data else {}
                except ValueError:
                    data = {}

            if not isinstance(data, dict):
                data = {}

            # Merge additional form fields from the request with `extra` data
            # from the event payload and set defaults for processing. This is
            # sent by clients like Breakpad or Crashpad.
            extra.update(data.get("extra") or ())
            data["extra"] = extra

        if not minidump:
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                None,
                Outcome.INVALID,
                "missing_minidump_upload",
                category=data_category,
            )
            raise APIError("Missing minidump upload")

        # Breakpad on linux sometimes stores the entire HTTP request body as
        # dump file instead of just the minidump. The Electron SDK then for
        # example uploads a multipart formdata body inside the minidump file.
        # It needs to be re-parsed, to extract the actual minidump before
        # continuing.
        minidump.seek(0)
        if minidump.read(2) == b"--":
            # The remaining bytes of the first line are the form boundary. We
            # have already read two bytes, the remainder is the form boundary
            # (excluding the initial '--').
            boundary = minidump.readline().rstrip()
            minidump.seek(0)

            # Next, we have to fake a HTTP request by specifying the form
            # boundary and the content length, or otherwise Django will not try
            # to parse our form body. Also, we need to supply new upload
            # handlers since they cannot be reused from the current request.
            meta = {
                "CONTENT_TYPE": b"multipart/form-data; boundary=%s" % boundary,
                "CONTENT_LENGTH": minidump.size,
            }
            handlers = [
                uploadhandler.load_handler(handler, request)
                for handler in settings.FILE_UPLOAD_HANDLERS
            ]

            _, inner_files = MultiPartParser(meta, minidump, handlers).parse()
            try:
                minidump = inner_files["upload_file_minidump"]
                minidump_name = minidump.name
            except KeyError:
                track_outcome(
                    project_config.organization_id,
                    project_config.project_id,
                    None,
                    Outcome.INVALID,
                    "missing_minidump_upload",
                    category=data_category,
                )
                raise APIError("Missing minidump upload")

        minidump.seek(0)
        if minidump.read(4) != "MDMP":
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                None,
                Outcome.INVALID,
                "invalid_minidump",
                category=data_category,
            )
            raise APIError("Uploaded file was not a minidump")

        # Always store the minidump in attachments so we can access it during
        # processing, regardless of the event-attachments feature. This is
        # required to process the minidump with debug information.
        attachments = []

        # The minidump attachment is special. It has its own attachment type to
        # distinguish it from regular attachments for processing. Also, it might
        # not be part of `request_files` if it has been uploaded as raw request
        # body instead of a multipart formdata request.
        minidump.seek(0)
        attachments.append(
            CachedAttachment(
                name=minidump_name,
                content_type="application/octet-stream",
                data=minidump.read(),
                type=MINIDUMP_ATTACHMENT_TYPE,
            )
        )

        # Append all other files as generic attachments.
        # RaduW 4 Jun 2019 always sent attachments for minidump (does not use
        # event-attachments feature)
        for name, file in six.iteritems(request_files):
            if name == "upload_file_minidump":
                continue

            # Known attachment: msgpack event
            if name == "__sentry-event":
                merge_attached_event(file, data)
                continue
            if name in ("__sentry-breadcrumb1", "__sentry-breadcrumb2"):
                merge_attached_breadcrumbs(file, data)
                continue

            # Add any other file as attachment
            attachments.append(CachedAttachment.from_upload(file))

        # Assign our own UUID so we can track this minidump. We cannot trust
        # the uploaded filename, and if reading the minidump fails there is
        # no way we can ever retrieve the original UUID from the minidump.
        event_id = data.get("event_id") or uuid.uuid4().hex
        data["event_id"] = event_id

        # Write a minimal event payload that is required to kick off native
        # event processing. It is also used as fallback if processing of the
        # minidump fails.
        # NB: This occurs after merging attachments to overwrite potentially
        # contradicting payloads transmitted in __sentry_event.
        write_minidump_placeholder(data)

        event_id = self.process(
            request,
            attachments=attachments,
            data=data,
            project=project,
            project_config=project_config,
            **kwargs
        )

        # Return the formatted UUID of the generated event. This is
        # expected by the Electron http uploader on Linux and doesn't
        # break the default Breakpad client library.
        return HttpResponse(six.text_type(uuid.UUID(event_id)), content_type="text/plain")


# Endpoint used by the Unreal Engine 4 (UE4) Crash Reporter.
class UnrealView(StoreView):
    content_types = ("application/octet-stream",)
    required_attachments = ("minidump", "applecrashreport")

    def _dispatch(
        self,
        request,
        helper,
        project_config,
        sentry_key,
        origin=None,
        config_flags=None,
        *args,
        **kwargs
    ):
        if request.method != "POST":
            track_outcome(0, 0, None, Outcome.INVALID, "disallowed_method")
            return HttpResponseNotAllowed(["POST"])

        content_type = request.META.get("CONTENT_TYPE")
        if content_type is None or not content_type.startswith(self.content_types):
            track_outcome(0, 0, None, Outcome.INVALID, "content_type")
            raise APIError("Invalid Content-Type")

        request.user = AnonymousUser()

        project = project_config.project
        project_id = project_config.project_id

        auth = Auth(public_key=sentry_key, is_public=False)
        auth.client = "sentry.unreal_engine"

        key = helper.project_key_from_auth(auth)
        if key.project_id != project_id:
            track_outcome(
                project_config.organization_id,
                project_id,
                None,
                Outcome.INVALID,
                "multi_project_id",
            )
            raise APIError("Two different projects were specified")

        helper.context.bind_auth(auth)
        return super(APIView, self).dispatch(
            request=request,
            project=project,
            auth=auth,
            helper=helper,
            key=key,
            project_config=project_config,
            **kwargs
        )

    def post(self, request, project, project_config, **kwargs):
        # Track these submissions statically as ERROR. Relay infers properly.
        data_category = DataCategory.ERROR

        attachments_enabled = features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        )

        attachments = []
        event = {"event_id": uuid.uuid4().hex, "environment": request.GET.get("AppEnvironment")}

        user_id = request.GET.get("UserID")
        if user_id:
            merge_unreal_user(event, user_id)

        try:
            unreal = Unreal4Crash.from_bytes(request.body)
        except (ProcessMinidumpError, Unreal4Error) as e:
            minidumps_logger.exception(e)
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                None,
                Outcome.INVALID,
                "process_unreal",
                category=data_category,
            )
            raise APIError(six.text_type(e).split("\n", 1)[0])

        try:
            unreal_context = unreal.get_context()
        except Unreal4Error as e:
            # we'll continue without the context data
            unreal_context = None
            minidumps_logger.exception(e)
        else:
            if unreal_context is not None:
                merge_unreal_context_event(unreal_context, event, project)

        try:
            unreal_logs = unreal.get_logs()
        except Unreal4Error as e:
            # we'll continue without the breadcrumbs
            minidumps_logger.exception(e)
        else:
            if unreal_logs is not None:
                merge_unreal_logs_event(unreal_logs, event)

        is_minidump = False
        is_applecrashreport = False

        for file in unreal.files():
            # Known attachment: msgpack event
            if file.name == "__sentry-event":
                merge_attached_event(file.open_stream(), event)
                continue
            if file.name in ("__sentry-breadcrumb1", "__sentry-breadcrumb2"):
                merge_attached_breadcrumbs(file.open_stream(), event)
                continue

            if file.type == "minidump":
                is_minidump = True
            if file.type == "applecrashreport":
                is_applecrashreport = True

            # Always store attachments that can be processed, regardless of the
            # event-attachments feature.
            if file.type in self.required_attachments or attachments_enabled:
                attachments.append(
                    CachedAttachment(
                        name=file.name,
                        data=file.open_stream().read(),
                        type=unreal_attachment_type(file),
                    )
                )

        if is_minidump:
            write_minidump_placeholder(event)
        elif is_applecrashreport:
            write_applecrashreport_placeholder(event)

        event_id = self.process(
            request,
            attachments=attachments,
            data=event,
            project=project,
            project_config=project_config,
            **kwargs
        )

        # The return here is only useful for consistency
        # because the UE4 crash reporter doesn't care about it.
        return HttpResponse(six.text_type(uuid.UUID(event_id)), content_type="text/plain")


class StoreSchemaView(BaseView):
    def get(self, request, **kwargs):
        return HttpResponse(json.dumps(schemas.EVENT_SCHEMA), content_type="application/json")


class ClientConfigView(BaseView):
    def get(self, request):
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


class SecurityReportView(StoreView):
    auth_helper_cls = SecurityAuthHelper
    content_types = (
        "application/csp-report",
        "application/json",
        "application/expect-ct-report",
        "application/expect-ct-report+json",
        "application/expect-staple-report",
    )

    def _dispatch(
        self, request, helper, project_config, origin=None, config_flags=None, *args, **kwargs
    ):
        # A CSP report is sent as a POST request with no Origin or Referer
        # header. What we're left with is a 'document-uri' key which is
        # inside of the JSON body of the request. This 'document-uri' value
        # should be treated as an origin check since it refers to the page
        # that triggered the report. The Content-Type is supposed to be
        # `application/csp-report`, but FireFox sends it as `application/json`.
        if request.method != "POST":
            track_outcome(0, 0, None, Outcome.INVALID, "disallowed_method")
            return HttpResponseNotAllowed(["POST"])

        if request.META.get("CONTENT_TYPE") not in self.content_types:
            track_outcome(0, 0, None, Outcome.INVALID, "content_type")
            raise APIError("Invalid Content-Type")

        request.user = AnonymousUser()

        project = project_config.project
        project_id = project_config.project_id

        # This is yanking the auth from the querystring since it's not
        # in the POST body. This means we expect a `sentry_key` and
        # `sentry_version` to be set in querystring
        auth = self.auth_helper_cls.auth_from_request(request)

        key = helper.project_key_from_auth(auth)
        if key.project_id != project_id:
            track_outcome(
                project.organization_id, project.id, None, Outcome.INVALID, "multi_project_id"
            )
            raise APIError("Two different projects were specified")

        helper.context.bind_auth(auth)

        return super(APIView, self).dispatch(
            request=request,
            project=project,
            auth=auth,
            helper=helper,
            key=key,
            project_config=project_config,
            **kwargs
        )

    def post(self, request, project, helper, key, project_config, **kwargs):
        # This endpoint only accepts security reports.
        data_category = DataCategory.SECURITY

        json_body = safely_load_json_string(request.body)
        report_type = self.security_report_type(json_body)
        if report_type is None:
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                key.id,
                Outcome.INVALID,
                "security_report_type",
                category=data_category,
            )
            raise APIError("Unrecognized security report type")
        interface = get_interface(report_type)

        try:
            instance = interface.from_raw(json_body)
        except jsonschema.ValidationError as e:
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                key.id,
                Outcome.INVALID,
                "security_report",
                category=data_category,
            )
            raise APIError("Invalid security report: %s" % str(e).splitlines()[0])

        # Do origin check based on the `document-uri` key as explained in `_dispatch`.
        origin = instance.get_origin()
        if not is_valid_origin(origin, project):
            track_outcome(
                project_config.organization_id,
                project_config.project_id,
                key.id,
                Outcome.INVALID,
                FilterStatKeys.CORS,
                category=data_category,
            )
            raise APIForbidden("Invalid origin")

        data = {
            "interface": interface.path,
            "report": instance,
            "release": request.GET.get("sentry_release"),
            "environment": request.GET.get("sentry_environment"),
        }

        self.process(
            request,
            project=project,
            helper=helper,
            data=data,
            key=key,
            project_config=project_config,
            **kwargs
        )

        return HttpResponse(content_type="application/javascript", status=201)

    def security_report_type(self, body):
        report_type_for_key = {
            "csp-report": "csp",
            "expect-ct-report": "expectct",
            "expect-staple-report": "expectstaple",
            "known-pins": "hpkp",
        }
        if isinstance(body, dict):
            for k in report_type_for_key:
                if k in body:
                    return report_type_for_key[k]
        return None

    def pre_normalize(self, data, helper):
        data.process_csp_report()


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain")


@cache_control(max_age=60)
def crossdomain_xml(request, project_id):
    if not project_id.isdigit():
        return HttpResponse(status=404)

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return HttpResponse(status=404)

    origin_list = get_origins(project)
    response = render_to_response("sentry/crossdomain.xml", {"origin_list": origin_list})
    response["Content-Type"] = "application/xml"

    return response
