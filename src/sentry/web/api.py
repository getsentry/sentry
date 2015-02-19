"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import six

from datetime import timedelta
from django.contrib import messages
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.db import connections
from django.db.models import Sum, Q
from django.http import (
    HttpResponse, HttpResponseBadRequest,
    HttpResponseForbidden, HttpResponseRedirect,
)
from django.utils import timezone
from django.utils.http import urlquote
from django.utils.translation import ugettext as _
from django.views.decorators.cache import never_cache, cache_control
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View as BaseView
from functools import wraps
from raven.contrib.django.models import client as Raven

from sentry import app
from sentry.api.base import LINK_HEADER
from sentry.app import tsdb
from sentry.constants import MEMBER_USER, EVENTS_PER_PAGE
from sentry.coreapi import (
    project_from_auth_vars, decode_and_decompress_data,
    safely_load_json_string, validate_data, insert_data_to_database, APIError,
    APIForbidden, APIRateLimited, extract_auth_vars, ensure_has_ip,
    decompress_deflate, decompress_gzip, ensure_does_not_have_ip)
from sentry.exceptions import InvalidData, InvalidOrigin, InvalidRequest
from sentry.event_manager import EventManager
from sentry.models import (
    Group, GroupBookmark, GroupStatus, GroupTagValue, Project, TagValue,
    Activity, User
)
from sentry.signals import event_received
from sentry.plugins import plugins
from sentry.quotas.base import RateLimit
from sentry.utils import json
from sentry.utils.data_scrubber import SensitiveDataFilter
from sentry.utils.db import get_db_engine
from sentry.utils.javascript import to_json
from sentry.utils.http import is_valid_origin, get_origins, is_same_domain
from sentry.utils.safe import safe_execute
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response

error_logger = logging.getLogger('sentry.errors')
logger = logging.getLogger('sentry.api')

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = 'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='.decode('base64')

PROTOCOL_VERSIONS = frozenset(('2.0', '3', '4', '5', '6'))


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


class Auth(object):
    def __init__(self, auth_vars, is_public=False):
        self.client = auth_vars.get('sentry_client')
        self.version = int(float(auth_vars.get('sentry_version')))
        self.secret_key = auth_vars.get('sentry_secret')
        self.public_key = auth_vars.get('sentry_key')
        self.is_public = is_public


class APIView(BaseView):
    def _get_project_from_id(self, project_id):
        if project_id:
            if project_id.isdigit():
                lookup_kwargs = {'id': int(project_id)}
            else:
                lookup_kwargs = {'slug': project_id}

            try:
                return Project.objects.get_from_cache(**lookup_kwargs)
            except Project.DoesNotExist:
                raise APIError('Invalid project_id: %r' % project_id)
        return None

    def _parse_header(self, request, project):
        try:
            auth_vars = extract_auth_vars(request)
        except (IndexError, ValueError):
            raise APIError('Invalid auth header')

        if not auth_vars:
            raise APIError('Client/server version mismatch: Unsupported client')

        server_version = auth_vars.get('sentry_version', '1.0')
        client = auth_vars.get('sentry_client', request.META.get('HTTP_USER_AGENT'))

        Raven.tags_context({'client': client})
        Raven.tags_context({'protocol': server_version})

        if server_version not in PROTOCOL_VERSIONS:
            raise APIError('Client/server version mismatch: Unsupported protocol version (%s)' % server_version)

        if not client:
            raise APIError('Client request error: Missing client version identifier')

        return auth_vars

    @csrf_exempt
    @never_cache
    def dispatch(self, request, project_id=None, *args, **kwargs):
        try:
            origin = self.get_request_origin(request)

            response = self._dispatch(request, project_id=project_id, *args, **kwargs)
        except InvalidRequest as e:
            response = HttpResponseBadRequest(str(e), content_type='text/plain')
        except Exception:
            response = HttpResponse(status=500)

        if response.status_code != 200:
            # Set X-Sentry-Error as in many cases it is easier to inspect the headers
            response['X-Sentry-Error'] = response.content[:200]  # safety net on content length

            if response.status_code == 500:
                log = logger.error
                exc_info = True
            else:
                log = logger.info
                exc_info = None

            log('status=%s project_id=%s user_id=%s ip=%s agent=%s %s', response.status_code, project_id,
                request.user.is_authenticated() and request.user.id or None,
                request.META['REMOTE_ADDR'], request.META.get('HTTP_USER_AGENT'),
                response['X-Sentry-Error'], extra={
                    'request': request,
                }, exc_info=exc_info)

            if origin:
                # We allow all origins on errors
                response['Access-Control-Allow-Origin'] = '*'

        if origin:
            response['Access-Control-Allow-Headers'] = 'X-Sentry-Auth, X-Requested-With, Origin, Accept, Content-Type, ' \
                'Authentication'
            response['Access-Control-Allow-Methods'] = ', '.join(self._allowed_methods())

        return response

    def get_request_origin(self, request):
        """
        Returns either the Origin or Referer value from the request headers.
        """
        return request.META.get('HTTP_ORIGIN', request.META.get('HTTP_REFERER'))

    def _dispatch(self, request, project_id=None, *args, **kwargs):
        request.user = AnonymousUser()

        try:
            project = self._get_project_from_id(project_id)
        except APIError as e:
            raise InvalidRequest(str(e))

        if project:
            Raven.tags_context({'project': project.id})

        origin = self.get_request_origin(request)
        if origin is not None:
            # This check is specific for clients who need CORS support
            if not project:
                raise InvalidRequest('Your client must be upgraded for CORS support.')
            if not is_valid_origin(origin, project):
                raise InvalidOrigin(origin)

        # XXX: It seems that the OPTIONS call does not always include custom headers
        if request.method == 'OPTIONS':
            response = self.options(request, project)
        else:
            try:
                auth_vars = self._parse_header(request, project)
            except APIError as e:
                raise InvalidRequest(str(e))

            try:
                project_, user = project_from_auth_vars(auth_vars)
            except APIError as error:
                return HttpResponse(six.text_type(error.msg), status=error.http_status)
            else:
                if user:
                    request.user = user

            # Legacy API was /api/store/ and the project ID was only available elsewhere
            if not project:
                if not project_:
                    raise InvalidRequest('Unable to identify project')
                project = project_
            elif project_ != project:
                raise InvalidRequest('Project ID mismatch')
            else:
                Raven.tags_context({'project': project.id})

            auth = Auth(auth_vars, is_public=bool(origin))

            if auth.version >= 3:
                if request.method == 'GET':
                    # GET only requires an Origin/Referer check
                    # If an Origin isn't passed, it's possible that the project allows no origin,
                    # so we need to explicitly check for that here. If Origin is not None,
                    # it can be safely assumed that it was checked previously and it's ok.
                    if origin is None and not is_valid_origin(origin, project):
                        # Special case an error message for a None origin when None wasn't allowed
                        raise InvalidRequest('Missing required Origin or Referer header')
                else:
                    # Version 3 enforces secret key for server side requests
                    if not auth.secret_key:
                        raise InvalidRequest('Missing required attribute in authentication header: sentry_secret')

            try:
                response = super(APIView, self).dispatch(request, project=project, auth=auth, **kwargs)

            except APIError as error:
                response = HttpResponse(six.text_type(error.msg), content_type='text/plain', status=error.http_status)
                if isinstance(error, APIRateLimited) and error.retry_after is not None:
                    response['Retry-After'] = str(error.retry_after)

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
    def post(self, request, project, auth, **kwargs):
        data = request.body
        response_or_event_id = self.process(request, project, auth, data, **kwargs)
        if isinstance(response_or_event_id, HttpResponse):
            return response_or_event_id
        return HttpResponse(json.dumps({
            'id': response_or_event_id,
        }), content_type='application/json')

    def get(self, request, project, auth, **kwargs):
        data = request.GET.get('sentry_data', '')
        response_or_event_id = self.process(request, project, auth, data, **kwargs)

        # Return a simple 1x1 gif for browser so they don't throw a warning
        response = HttpResponse(PIXEL, 'image/gif')
        if not isinstance(response_or_event_id, HttpResponse):
            response['X-Sentry-ID'] = response_or_event_id
        return response

    def process(self, request, project, auth, data, **kwargs):
        event_received.send_robust(ip=request.META['REMOTE_ADDR'], sender=type(self))

        # TODO: improve this API (e.g. make RateLimit act on __ne__)
        rate_limit = safe_execute(app.quotas.is_rate_limited, project=project,
                                  _with_transaction=False)
        if isinstance(rate_limit, bool):
            rate_limit = RateLimit(is_limited=rate_limit, retry_after=None)

        if rate_limit is not None and rate_limit.is_limited:
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.project_total_rejected, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
                (app.tsdb.models.organization_total_rejected, project.organization_id),
            ])
            raise APIRateLimited(rate_limit.retry_after)
        else:
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
            ])

        result = plugins.first('has_perm', request.user, 'create_event', project,
                               version=1)
        if result is False:
            raise APIForbidden('Creation of this event was blocked')

        content_encoding = request.META.get('HTTP_CONTENT_ENCODING', '')

        if content_encoding == 'gzip':
            data = decompress_gzip(data)
        elif content_encoding == 'deflate':
            data = decompress_deflate(data)
        elif not data.startswith('{'):
            data = decode_and_decompress_data(data)
        data = safely_load_json_string(data)

        try:
            # mutates data
            validate_data(project, data, auth.client)
        except InvalidData as e:
            raise APIError(u'Invalid data: %s (%s)' % (six.text_type(e), type(e)))

        # mutates data
        manager = EventManager(data, version=auth.version)
        data = manager.normalize()

        scrub_ip_address = project.get_option('sentry:scrub_ip_address', False)

        # insert IP address if not available
        if auth.is_public and not scrub_ip_address:
            ensure_has_ip(data, request.META['REMOTE_ADDR'])

        event_id = data['event_id']

        # TODO(dcramer): ideally we'd only validate this if the event_id was
        # supplied by the user
        cache_key = 'ev:%s:%s' % (project.id, event_id,)

        if cache.get(cache_key) is not None:
            logger.warning('Discarded recent duplicate event from project %s/%s (id=%s)', project.organization.slug, project.slug, event_id)
            raise InvalidRequest('An event with the same ID already exists.')

        if project.get_option('sentry:scrub_data', True):
            # We filter data immediately before it ever gets into the queue
            inst = SensitiveDataFilter(project.get_option('sentry:sensitive_fields', []))
            inst.apply(data)

        if scrub_ip_address:
            # We filter data immediately before it ever gets into the queue
            ensure_does_not_have_ip(data)

        # mutates data (strips a lot of context if not queued)
        insert_data_to_database(data)

        cache.set(cache_key, '', 60 * 5)

        logger.debug('New event from project %s/%s (id=%s)', project.organization.slug, project.slug, event_id)

        return event_id


@csrf_exempt
@has_access
@never_cache
def poll(request, organization, project):
    offset = 0
    limit = EVENTS_PER_PAGE

    group_result = _get_group_list(
        request=request,
        project=project,
    )

    event_list = group_result['event_list']
    event_list = list(event_list[offset:limit])

    data = to_json(event_list, request)

    links = [
        ('previous', str(group_result['prev_cursor'])),
        ('next', str(group_result['next_cursor'])),
    ]

    querystring = u'&'.join(
        u'{0}={1}'.format(urlquote(k), urlquote(v))
        for k, v in request.GET.iteritems()
        if k != 'cursor'
    )
    base_url = request.build_absolute_uri(request.path)
    if querystring:
        base_url = '{0}?{1}'.format(base_url, querystring)
    else:
        base_url = base_url + '?'

    link_values = []
    for name, cursor in links:
        link_values.append(LINK_HEADER.format(
            uri=base_url,
            cursor=cursor,
            name=name,
            has_results='true' if bool(cursor) else 'false',
        ))

    headers = {}
    if link_values:
        headers['Link'] = ', '.join(link_values)

    response = HttpResponse(data)
    response['Content-Type'] = 'application/json'
    if link_values:
        response['Link'] = ', '.join(link_values)
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def resolve(request, organization, project):
    gid = request.REQUEST.get('gid')
    if not gid:
        return HttpResponseForbidden()

    try:
        group = Group.objects.get(pk=gid)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    now = timezone.now()

    happened = Group.objects.filter(
        pk=group.pk,
    ).exclude(status=GroupStatus.RESOLVED).update(
        status=GroupStatus.RESOLVED,
        resolved_at=now,
    )
    group.status = GroupStatus.RESOLVED
    group.resolved_at = now

    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_RESOLVED,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def make_group_public(request, organization, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(is_public=True)

    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_PUBLIC,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def make_group_private(request, organization, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(is_public=False)

    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_PRIVATE,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def resolve_group(request, organization, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(
        status=GroupStatus.RESOLVED,
        resolved_at=timezone.now(),
    )
    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_RESOLVED,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def mute_group(request, organization, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(
        status=GroupStatus.MUTED,
        resolved_at=timezone.now(),
    )
    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_MUTED,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def unresolve_group(request, organization, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(
        status=GroupStatus.UNRESOLVED,
        active_at=timezone.now(),
    )
    if happened:
        Activity.objects.create(
            project=project,
            group=group,
            type=Activity.SET_UNRESOLVED,
            user=request.user,
        )

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def remove_group(request, organization, project, group_id):
    from sentry.tasks.deletion import delete_group

    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    delete_group.delay(object_id=group.id)

    if request.is_ajax():
        response = HttpResponse('{}')
        response['Content-Type'] = 'application/json'
    else:
        messages.add_message(request, messages.SUCCESS,
            _('Deletion has been queued and should occur shortly.'))
        response = HttpResponseRedirect(reverse('sentry-stream', args=[organization.slug, project.slug]))
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def get_group_tags(request, organization, project, group_id, tag_name):
    # XXX(dcramer): Consider this API deprecated as soon as it was implemented
    cutoff = timezone.now() - timedelta(days=7)

    engine = get_db_engine('default')
    if 'postgres' in engine:
        # This doesnt guarantee percentage is accurate, but it does ensure
        # that the query has a maximum cost
        cursor = connections['default'].cursor()
        cursor.execute("""
            SELECT SUM(t)
            FROM (
                SELECT times_seen as t
                FROM sentry_messagefiltervalue
                WHERE group_id = %s
                AND key = %s
                AND last_seen > NOW() - INTERVAL '7 days'
                LIMIT 10000
            ) as a
        """, [group_id, tag_name])
        total = cursor.fetchone()[0] or 0
    else:
        total = GroupTagValue.objects.filter(
            group=group_id,
            key=tag_name,
            last_seen__gte=cutoff,
        ).aggregate(t=Sum('times_seen'))['t'] or 0

    unique_tags = GroupTagValue.objects.filter(
        group=group_id,
        key=tag_name,
        last_seen__gte=cutoff,
    ).values_list('value', 'times_seen').order_by('-times_seen')[:10]

    # fetch TagValue instances so we can get proper labels
    tag_values = dict(
        (t.value, t)
        for t in TagValue.objects.filter(
            key=tag_name,
            project_id=project.id,
            value__in=[u[0] for u in unique_tags],
        )
    )

    values = []
    for tag, times_seen in unique_tags:
        try:
            tag_value = tag_values[tag]
        except KeyError:
            label = tag
        else:
            label = tag_value.get_label()

        values.append({
            'value': tag,
            'count': times_seen,
            'label': label,
        })

    return json.dumps({
        'name': tag_name,
        'values': values,
        'total': total,
    })


@csrf_exempt
@has_access
@never_cache
@api
def bookmark(request, organization, project):
    gid = request.REQUEST.get('gid')
    if not gid:
        return HttpResponseForbidden()

    if not request.user.is_authenticated():
        return HttpResponseForbidden()

    try:
        group = Group.objects.get(pk=gid)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    gb, created = GroupBookmark.objects.get_or_create(
        project=group.project,
        user=request.user,
        group=group,
    )
    if not created:
        gb.delete()

    return to_json(group, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def clear(request, organization, project):
    queryset = Group.objects.filter(
        project=project,
        status=GroupStatus.UNRESOLVED,
    )
    rows_affected = queryset.update(status=GroupStatus.RESOLVED)
    if rows_affected > 1000:
        logger.warning(
            'Large resolve on %s of %s rows', project.slug, rows_affected)

    if rows_affected:
        Activity.objects.create(
            project=project,
            type=Activity.SET_RESOLVED,
            user=request.user,
        )

    data = []
    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@never_cache
@csrf_exempt
@has_access
def get_group_trends(request, organization, team):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    project_list = Project.objects.get_for_user(team=team, user=request.user)

    project_dict = dict((p.id, p) for p in project_list)

    base_qs = Group.objects.filter(
        project__in=project_list,
        status=0,
    )

    cutoff = timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = list(base_qs.filter(
        status=GroupStatus.UNRESOLVED,
        last_seen__gte=cutoff_dt
    ).extra(select={'sort_value': 'score'}).order_by('-score')[:limit])

    for group in group_list:
        group._project_cache = project_dict.get(group.project_id)

    data = to_json(group_list, request)

    response = HttpResponse(data)
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def get_new_groups(request, organization, team):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    project_list = Project.objects.get_for_user(team=team, user=request.user)

    project_dict = dict((p.id, p) for p in project_list)

    cutoff = timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = list(Group.objects.filter(
        project__in=project_dict.keys(),
        status=GroupStatus.UNRESOLVED,
        active_at__gte=cutoff_dt,
    ).extra(select={'sort_value': 'score'}).order_by('-score', '-first_seen')[:limit])

    for group in group_list:
        group._project_cache = project_dict.get(group.project_id)

    data = to_json(group_list, request)

    response = HttpResponse(data)
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def get_resolved_groups(request, organization, team):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    project_list = Project.objects.get_for_user(team=team, user=request.user)

    project_dict = dict((p.id, p) for p in project_list)

    cutoff = timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = list(Group.objects.filter(
        project__in=project_list,
        status=GroupStatus.RESOLVED,
        resolved_at__gte=cutoff_dt,
    ).order_by('-score')[:limit])

    for group in group_list:
        group._project_cache = project_dict.get(group.project_id)

    data = to_json(group_list, request)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def get_stats(request, organization, team):
    minutes = int(request.REQUEST.get('minutes', 15))

    project_list = Project.objects.get_for_user(team=team, user=request.user)

    cutoff = timedelta(minutes=minutes)

    end = timezone.now()
    start = end - cutoff

    # TODO(dcramer): this is used in an unreleased feature. reimplement it using
    # new API and tsdb
    results = tsdb.get_range(
        model=tsdb.models.project,
        keys=[p.id for p in project_list],
        start=start,
        end=end,
    )
    num_events = 0
    for project, points in results.iteritems():
        num_events += sum(p[1] for p in points)

    # XXX: This is too slow if large amounts of groups are resolved
    # TODO(dcramer); move this into tsdb
    num_resolved = Group.objects.filter(
        project__in=project_list,
        status=GroupStatus.RESOLVED,
        resolved_at__gte=start,
    ).aggregate(t=Sum('times_seen'))['t'] or 0

    data = {
        'events': num_events,
        'resolved': num_resolved,
    }

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def search_tags(request, organization, project):
    limit = min(100, int(request.GET.get('limit', 10)))
    name = request.GET['name']
    query = request.GET['query']

    results = list(TagValue.objects.filter(
        project=project,
        key=name,
        value__icontains=query,
    ).values_list('value', flat=True).order_by('value')[:limit])

    response = HttpResponse(json.dumps({
        'results': results,
        'query': query,
    }))
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def search_users(request, organization):
    limit = min(100, int(request.GET.get('limit', 10)))
    query = request.GET['query']

    results = list(User.objects.filter(
        Q(email__istartswith=query) | Q(first_name__istartswith=query) | Q(username__istartswith=query),
    ).filter(
        sentry_orgmember_set__organization=organization,
    ).distinct().order_by('first_name', 'email').values('id', 'username', 'first_name', 'email')[:limit])

    response = HttpResponse(json.dumps({
        'results': results,
        'query': query,
    }))
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def search_projects(request, organization):
    limit = min(100, int(request.GET.get('limit', 10)))
    query = request.GET['query']

    results = list(Project.objects.filter(
        Q(name__istartswith=query) | Q(slug__istartswith=query),
        organization=organization,
    ).distinct().order_by('name', 'slug').values('id', 'name', 'slug')[:limit])

    response = HttpResponse(json.dumps({
        'results': results,
        'query': query,
    }))
    response['Content-Type'] = 'application/json'

    return response


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
    if origin_list == '*':
        origin_list = [origin_list]

    response = render_to_response('sentry/crossdomain.xml', {
        'origin_list': origin_list
    })
    response['Content-Type'] = 'application/xml'

    return response
