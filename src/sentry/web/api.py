from __future__ import absolute_import, print_function

import base64
import logging
import six
import traceback

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotAllowed
from django.utils.encoding import force_bytes
from django.views.decorators.cache import never_cache, cache_control
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View as BaseView
from functools import wraps
from raven.contrib.django.models import client as Raven

from sentry import app
from sentry.coreapi import (
    APIError, APIForbidden, APIRateLimited, ClientApiHelper, CspApiHelper,
    LazyData
)
from sentry.models import Project, OrganizationOption, Organization
from sentry.signals import (
    event_accepted, event_dropped, event_filtered, event_received
)
from sentry.quotas.base import RateLimit
from sentry.utils import json, metrics
from sentry.utils.data_scrubber import SensitiveDataFilter
from sentry.utils.http import (
    is_valid_origin, get_origins, is_same_domain,
)
from sentry.utils.safe import safe_execute
from sentry.web.helpers import render_to_response

logger = logging.getLogger('sentry')

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = base64.b64decode('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=')

PROTOCOL_VERSIONS = frozenset(('2.0', '3', '4', '5', '6', '7'))


def api(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        data = func(request, *args, **kwargs)
        if request.is_ajax():
            response = HttpResponse(data)
            response['Content-Type'] = 'application/json'
        else:
            ref = request.META.get('HTTP_REFERER')
            if ref is None or not is_same_domain(ref, request.build_absolute_uri()):
                ref = reverse('sentry')
            return HttpResponseRedirect(ref)
        return response
    return wrapped


class APIView(BaseView):
    helper_cls = ClientApiHelper

    def _get_project_from_id(self, project_id):
        if not project_id:
            return
        if not project_id.isdigit():
            raise APIError('Invalid project_id: %r' % project_id)
        try:
            return Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            raise APIError('Invalid project_id: %r' % project_id)

    def _parse_header(self, request, helper, project):
        auth = helper.auth_from_request(request)

        if auth.version not in PROTOCOL_VERSIONS:
            raise APIError('Client using unsupported server protocol version (%r)' % six.text_type(auth.version or ''))

        if not auth.client:
            raise APIError("Client did not send 'client' identifier")

        return auth

    @csrf_exempt
    @never_cache
    def dispatch(self, request, project_id=None, *args, **kwargs):
        helper = self.helper_cls(
            agent=request.META.get('HTTP_USER_AGENT'),
            project_id=project_id,
            ip_address=request.META['REMOTE_ADDR'],
        )
        origin = None

        try:
            origin = helper.origin_from_request(request)

            response = self._dispatch(request, helper, project_id=project_id,
                                      origin=origin,
                                      *args, **kwargs)
        except APIError as e:
            context = {
                'error': force_bytes(e.msg, errors='replace'),
            }
            if e.name:
                context['error_name'] = e.name

            response = HttpResponse(json.dumps(context),
                                    content_type='application/json',
                                    status=e.http_status)
            # Set X-Sentry-Error as in many cases it is easier to inspect the headers
            response['X-Sentry-Error'] = context['error']

            if isinstance(e, APIRateLimited) and e.retry_after is not None:
                response['Retry-After'] = six.text_type(e.retry_after)

        except Exception as e:
            # TODO(dcramer): test failures are not outputting the log message
            # here
            if settings.DEBUG:
                content = traceback.format_exc()
            else:
                content = ''
            logger.exception(e)
            response = HttpResponse(content,
                                    content_type='text/plain',
                                    status=500)

        # TODO(dcramer): it'd be nice if we had an incr_multi method so
        # tsdb could optimize this
        metrics.incr('client-api.all-versions.requests')
        metrics.incr('client-api.all-versions.responses.%s' % (
            response.status_code,
        ))
        metrics.incr('client-api.all-versions.responses.%sxx' % (
            six.text_type(response.status_code)[0],
        ))

        if helper.context.version:
            metrics.incr('client-api.v%s.requests' % (
                helper.context.version,
            ))
            metrics.incr('client-api.v%s.responses.%s' % (
                helper.context.version, response.status_code
            ))
            metrics.incr('client-api.v%s.responses.%sxx' % (
                helper.context.version, six.text_type(response.status_code)[0]
            ))

        if response.status_code != 200 and origin:
            # We allow all origins on errors
            response['Access-Control-Allow-Origin'] = '*'

        if origin:
            response['Access-Control-Allow-Headers'] = \
                'X-Sentry-Auth, X-Requested-With, Origin, Accept, ' \
                'Content-Type, Authentication'
            response['Access-Control-Allow-Methods'] = \
                ', '.join(self._allowed_methods())

        return response

    def _dispatch(self, request, helper, project_id=None, origin=None,
                  *args, **kwargs):
        request.user = AnonymousUser()

        project = self._get_project_from_id(project_id)
        if project:
            helper.context.bind_project(project)
            Raven.tags_context(helper.context.get_tags_context())

        if origin is not None:
            # This check is specific for clients who need CORS support
            if not project:
                raise APIError('Client must be upgraded for CORS support')
            if not is_valid_origin(origin, project):
                raise APIForbidden('Invalid origin: %s' % (origin,))

        # XXX: It seems that the OPTIONS call does not always include custom headers
        if request.method == 'OPTIONS':
            response = self.options(request, project)
        else:
            auth = self._parse_header(request, helper, project)

            project_id = helper.project_id_from_auth(auth)

            # Legacy API was /api/store/ and the project ID was only available elsewhere
            if not project:
                project = Project.objects.get_from_cache(id=project_id)
                helper.context.bind_project(project)
            elif project_id != project.id:
                raise APIError('Two different projects were specified')

            helper.context.bind_auth(auth)
            Raven.tags_context(helper.context.get_tags_context())

            # Explicitly bind Organization so we don't implicitly query it later
            # this just allows us to comfortably assure that `project.organization` is safe.
            # This also allows us to pull the object from cache, instead of being
            # implicitly fetched from database.
            project.organization = Organization.objects.get_from_cache(id=project.organization_id)

            if auth.version != '2.0':
                if not auth.secret_key:
                    # If we're missing a secret_key, check if we are allowed
                    # to do a CORS request.

                    # If we're missing an Origin/Referrer header entirely,
                    # we only want to support this on GET requests. By allowing
                    # un-authenticated CORS checks for POST, we basially
                    # are obsoleting our need for a secret key entirely.
                    if origin is None and request.method != 'GET':
                        raise APIForbidden('Missing required attribute in authentication header: sentry_secret')

                    if not is_valid_origin(origin, project):
                        raise APIForbidden('Missing required Origin or Referer header')

            response = super(APIView, self).dispatch(
                request=request,
                project=project,
                auth=auth,
                helper=helper,
                **kwargs
            )

        if origin:
            response['Access-Control-Allow-Origin'] = origin

        return response

    # XXX: backported from Django 1.5
    def _allowed_methods(self):
        return [m.upper() for m in self.http_method_names if hasattr(self, m)]

    def options(self, request, *args, **kwargs):
        response = HttpResponse()
        response['Allow'] = ', '.join(self._allowed_methods())
        response['Content-Length'] = '0'
        return response


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

        response_or_event_id = self.process(request, data=data, **kwargs)
        if isinstance(response_or_event_id, HttpResponse):
            return response_or_event_id
        return HttpResponse(json.dumps({
            'id': response_or_event_id,
        }), content_type='application/json')

    def get(self, request, **kwargs):
        data = request.GET.get('sentry_data', '')
        response_or_event_id = self.process(request, data=data, **kwargs)

        # Return a simple 1x1 gif for browser so they don't throw a warning
        response = HttpResponse(PIXEL, 'image/gif')
        if not isinstance(response_or_event_id, HttpResponse):
            response['X-Sentry-ID'] = response_or_event_id
        return response

    def process(self, request, project, auth, helper, data, **kwargs):
        metrics.incr('events.total')

        if not data:
            raise APIError('No JSON data was found')

        remote_addr = request.META['REMOTE_ADDR']

        data = LazyData(
            data=data,
            content_encoding=request.META.get('HTTP_CONTENT_ENCODING', ''),
            helper=helper,
            project=project,
            auth=auth,
            client_ip=remote_addr,
        )

        event_received.send_robust(
            ip=remote_addr,
            project=project,
            sender=type(self),
        )

        if helper.should_filter(project, data, ip_address=remote_addr):
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.project_total_blacklisted, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
                (app.tsdb.models.organization_total_blacklisted, project.organization_id),
            ])
            metrics.incr('events.blacklisted')
            event_filtered.send_robust(
                ip=remote_addr,
                project=project,
                sender=type(self),
            )
            raise APIForbidden('Event dropped due to filter')

        # TODO: improve this API (e.g. make RateLimit act on __ne__)
        rate_limit = safe_execute(app.quotas.is_rate_limited, project=project,
                                  _with_transaction=False)
        if isinstance(rate_limit, bool):
            rate_limit = RateLimit(is_limited=rate_limit, retry_after=None)

        # XXX(dcramer): when the rate limiter fails we drop events to ensure
        # it cannot cascade
        if rate_limit is None or rate_limit.is_limited:
            if rate_limit is None:
                helper.log.debug('Dropped event due to error with rate limiter')
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.project_total_rejected, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
                (app.tsdb.models.organization_total_rejected, project.organization_id),
            ])
            metrics.incr('events.dropped')
            event_dropped.send_robust(
                ip=remote_addr,
                project=project,
                sender=type(self),
            )
            if rate_limit is not None:
                raise APIRateLimited(rate_limit.retry_after)
        else:
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
            ])

        org_options = OrganizationOption.objects.get_all_values(project.organization_id)

        if org_options.get('sentry:require_scrub_ip_address', False):
            scrub_ip_address = True
        else:
            scrub_ip_address = project.get_option('sentry:scrub_ip_address', False)

        event_id = data['event_id']

        # TODO(dcramer): ideally we'd only validate this if the event_id was
        # supplied by the user
        cache_key = 'ev:%s:%s' % (project.id, event_id,)

        if cache.get(cache_key) is not None:
            raise APIForbidden('An event with the same ID already exists (%s)' % (event_id,))

        if org_options.get('sentry:require_scrub_data', False):
            scrub_data = True
        else:
            scrub_data = project.get_option('sentry:scrub_data', True)

        if scrub_data:
            # We filter data immediately before it ever gets into the queue
            sensitive_fields_key = 'sentry:sensitive_fields'
            sensitive_fields = (
                org_options.get(sensitive_fields_key, []) +
                project.get_option(sensitive_fields_key, [])
            )

            exclude_fields_key = 'sentry:safe_fields'
            exclude_fields = (
                org_options.get(exclude_fields_key, []) +
                project.get_option(exclude_fields_key, [])
            )

            if org_options.get('sentry:require_scrub_defaults', False):
                scrub_defaults = True
            else:
                scrub_defaults = project.get_option('sentry:scrub_defaults', True)

            inst = SensitiveDataFilter(
                fields=sensitive_fields,
                include_defaults=scrub_defaults,
                exclude_fields=exclude_fields,
            )
            inst.apply(data)

        if scrub_ip_address:
            # We filter data immediately before it ever gets into the queue
            helper.ensure_does_not_have_ip(data)

        # mutates data (strips a lot of context if not queued)
        helper.insert_data_to_database(data)

        cache.set(cache_key, '', 60 * 5)

        helper.log.debug('New event received (%s)', event_id)

        event_accepted.send_robust(
            ip=remote_addr,
            data=data,
            project=project,
            sender=type(self),
        )

        return event_id


class CspReportView(StoreView):
    helper_cls = CspApiHelper
    content_types = ('application/csp-report', 'application/json')

    def _dispatch(self, request, helper, project_id=None, origin=None,
                  *args, **kwargs):
        # A CSP report is sent as a POST request with no Origin or Referer
        # header. What we're left with is a 'document-uri' key which is
        # inside of the JSON body of the request. This 'document-uri' value
        # should be treated as an origin check since it refers to the page
        # that triggered the report. The Content-Type is supposed to be
        # `application/csp-report`, but FireFox sends it as `application/json`.
        if request.method != 'POST':
            return HttpResponseNotAllowed(['POST'])

        if request.META.get('CONTENT_TYPE') not in self.content_types:
            raise APIError('Invalid Content-Type')

        request.user = AnonymousUser()

        project = self._get_project_from_id(project_id)
        helper.context.bind_project(project)
        Raven.tags_context(helper.context.get_tags_context())

        # This is yanking the auth from the querystring since it's not
        # in the POST body. This means we expect a `sentry_key` and
        # `sentry_version` to be set in querystring
        auth = helper.auth_from_request(request)

        project_id = helper.project_id_from_auth(auth)
        if project_id != project.id:
            raise APIError('Two different projects were specified')

        helper.context.bind_auth(auth)
        Raven.tags_context(helper.context.get_tags_context())

        return super(APIView, self).dispatch(
            request=request,
            project=project,
            auth=auth,
            helper=helper,
            **kwargs
        )

    def post(self, request, project, auth, helper, **kwargs):
        data = helper.safely_load_json_string(request.body)

        # Do origin check based on the `document-uri` key as explained
        # in `_dispatch`.
        try:
            report = data['csp-report']
        except KeyError:
            raise APIError('Missing csp-report')

        origin = report.get('document-uri')

        # No idea, but this is garbage
        if origin == 'about:blank':
            raise APIForbidden('Invalid document-uri')

        if not is_valid_origin(origin, project):
            raise APIForbidden('Invalid document-uri')

        # Attach on collected meta data. This data obviously isn't a part
        # of the spec, but we need to append to the report sentry specific things.
        report['_meta'] = {
            'release': request.GET.get('sentry_release'),
        }

        response_or_event_id = self.process(
            request,
            project=project,
            auth=auth,
            helper=helper,
            data=report,
            **kwargs
        )
        if isinstance(response_or_event_id, HttpResponse):
            return response_or_event_id
        return HttpResponse(status=201)


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type='text/plain')


@cache_control(max_age=3600, public=True)
def crossdomain_xml_index(request):
    response = render_to_response('sentry/crossdomain_index.xml')
    response['Content-Type'] = 'application/xml'
    return response


@cache_control(max_age=60)
def crossdomain_xml(request, project_id):
    if not project_id.isdigit():
        return HttpResponse(status=404)

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return HttpResponse(status=404)

    origin_list = get_origins(project)
    response = render_to_response('sentry/crossdomain.xml', {
        'origin_list': origin_list
    })
    response['Content-Type'] = 'application/xml'

    return response
