"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import traceback

from datetime import timedelta
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.db import connections
from django.db.models import Sum, Q
from django.http import (
    HttpResponse, HttpResponseForbidden, HttpResponseRedirect,
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
    APIError, APIForbidden, APIRateLimited, ClientApiHelper
)
from sentry.event_manager import EventManager
from sentry.models import (
    Group, GroupBookmark, GroupStatus, GroupTagValue, Project, TagValue,
    Activity, User
)
from sentry.signals import event_received
from sentry.plugins import plugins
from sentry.quotas.base import RateLimit
from sentry.utils import json, metrics
from sentry.utils.data_scrubber import SensitiveDataFilter
from sentry.utils.db import get_db_engine
from sentry.utils.javascript import to_json
from sentry.utils.http import (
    absolute_uri, is_valid_origin, get_origins, is_same_domain
)
from sentry.utils.safe import safe_execute
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response

logger = logging.getLogger('sentry')

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = 'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='.decode('base64')

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
            raise APIError('Client using unsupported server protocol version (%r)' % str(auth.version or ''))

        if not auth.client:
            raise APIError("Client did not send 'client' identifier")

        return auth

    @csrf_exempt
    @never_cache
    def dispatch(self, request, project_id=None, *args, **kwargs):
        helper = ClientApiHelper(
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
                'error': unicode(e.msg).encode('utf-8'),
            }
            if e.name:
                context['error_name'] = e.name

            response = HttpResponse(json.dumps(context),
                                    content_type='application/json',
                                    status=e.http_status)
            # Set X-Sentry-Error as in many cases it is easier to inspect the headers
            response['X-Sentry-Error'] = context['error']

            if isinstance(e, APIRateLimited) and e.retry_after is not None:
                response['Retry-After'] = str(e.retry_after)

        except Exception:
            if settings.DEBUG or True:
                content = traceback.format_exc()
            else:
                content = ''
            traceback.print_exc()
            response = HttpResponse(content,
                                    content_type='text/plain',
                                    status=500)

        if helper.context.version:
            metrics.incr('client-api.v%s.requests' % (
                helper.context.version,
            ))
            metrics.incr('client-api.v%s.responses.%s' % (
                helper.context.version, response.status_code
            ))
            metrics.incr('client-api.v%s.responses.%sxx' % (
                helper.context.version, str(response.status_code)[0]
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

            project_ = helper.project_from_auth(auth)

            # Legacy API was /api/store/ and the project ID was only available elsewhere
            if not project:
                if not project_:
                    raise APIError('Unable to identify project')
                project = project_
            elif project_ != project:
                raise APIError('Two different project were specified')

            helper.context.bind_auth(auth)
            Raven.tags_context(helper.context.get_tags_context())

            if float(auth.version) >= 3:
                if request.method == 'GET':
                    # GET only requires an Origin/Referer check
                    # If an Origin isn't passed, it's possible that the project allows no origin,
                    # so we need to explicitly check for that here. If Origin is not None,
                    # it can be safely assumed that it was checked previously and it's ok.
                    if origin is None and not is_valid_origin(origin, project):
                        # Special case an error message for a None origin when None wasn't allowed
                        raise APIForbidden('Missing required Origin or Referer header')
                else:
                    # Version 3 enforces secret key for server side requests
                    if not auth.secret_key:
                        raise APIForbidden('Missing required attribute in authentication header: sentry_secret')

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
        data = request.body
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
        metrics.incr('events.total', 1)

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
            metrics.incr('events.dropped', 1)
            raise APIRateLimited(rate_limit.retry_after)
        else:
            app.tsdb.incr_multi([
                (app.tsdb.models.project_total_received, project.id),
                (app.tsdb.models.organization_total_received, project.organization_id),
            ])

        # TODO(dcramer): remove create_event perm hooks
        result = plugins.first('has_perm', request.user, 'create_event', project,
                               version=1)
        if result is False:
            metrics.incr('events.dropped', 1)
            raise APIForbidden('Creation of this event was blocked due to a plugin')

        content_encoding = request.META.get('HTTP_CONTENT_ENCODING', '')

        if content_encoding == 'gzip':
            data = helper.decompress_gzip(data)
        elif content_encoding == 'deflate':
            data = helper.decompress_deflate(data)
        elif not data.startswith('{'):
            data = helper.decode_and_decompress_data(data)
        data = helper.safely_load_json_string(data)

        # mutates data
        helper.validate_data(project, data)

        # mutates data
        manager = EventManager(data, version=auth.version)
        data = manager.normalize()

        scrub_ip_address = project.get_option('sentry:scrub_ip_address', False)

        # insert IP address if not available
        if auth.is_public and not scrub_ip_address:
            helper.ensure_has_ip(data, request.META['REMOTE_ADDR'])

        event_id = data['event_id']

        # TODO(dcramer): ideally we'd only validate this if the event_id was
        # supplied by the user
        cache_key = 'ev:%s:%s' % (project.id, event_id,)

        if cache.get(cache_key) is not None:
            raise APIForbidden('An event with the same ID already exists (%s)' % (event_id,))

        if project.get_option('sentry:scrub_data', True):
            # We filter data immediately before it ever gets into the queue
            inst = SensitiveDataFilter(project.get_option('sentry:sensitive_fields', None))
            inst.apply(data)

        if scrub_ip_address:
            # We filter data immediately before it ever gets into the queue
            helper.ensure_does_not_have_ip(data)

        # mutates data (strips a lot of context if not queued)
        helper.insert_data_to_database(data)

        cache.set(cache_key, '', 60 * 5)

        helper.log.debug('New event received (%s)', event_id)

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
    base_url = absolute_uri(request.path)
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
    if rows_affected > 10000:
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
