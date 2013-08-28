"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import logging
from functools import wraps

from django.contrib import messages
from django.contrib.auth.models import AnonymousUser
from django.core.urlresolvers import reverse
from django.db.models import Sum, Q
from django.http import HttpResponse, HttpResponseForbidden, HttpResponseRedirect
from django.utils import timezone
from django.utils.translation import ugettext as _
from django.views.decorators.cache import never_cache, cache_control
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.vary import vary_on_cookie
from django.views.generic.base import View as BaseView

from sentry import app
from sentry.constants import (
    MEMBER_USER, STATUS_MUTED, STATUS_UNRESOLVED, STATUS_RESOLVED,
    EVENTS_PER_PAGE)
from sentry.coreapi import (
    project_from_auth_vars, decode_and_decompress_data,
    safely_load_json_string, validate_data, insert_data_to_database, APIError,
    APIForbidden, APIRateLimited, extract_auth_vars, ensure_has_ip)
from sentry.exceptions import InvalidData
from sentry.models import (
    Group, GroupBookmark, Project, ProjectCountByMinute, TagValue, Activity,
    User)
from sentry.plugins import plugins
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.utils.db import has_trending
from sentry.utils.javascript import to_json
from sentry.utils.http import is_valid_origin, get_origins, is_same_domain
from sentry.utils.safe import safe_execute
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response

error_logger = logging.getLogger('sentry.errors.api.http')
logger = logging.getLogger('sentry.api.http')

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = 'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='.decode('base64')


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

        if server_version not in ('2.0', '3', '4'):
            raise APIError('Client/server version mismatch: Unsupported protocol version (%s)' % server_version)

        if not client:
            raise APIError('Client request error: Missing client version identifier')

        return auth_vars

    @csrf_exempt
    def dispatch(self, request, project_id=None, *args, **kwargs):
        try:
            origin = self.get_request_origin(request)

            response = self._dispatch(request, project_id=project_id, *args, **kwargs)
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
        except APIError, e:
            return HttpResponse(str(e), content_type='text/plain', status=400)

        origin = self.get_request_origin(request)
        if origin is not None:
            if not project:
                return HttpResponse('Your client must be upgraded for CORS support.')
            elif not is_valid_origin(origin, project):
                return HttpResponse('Invalid origin: %r' % origin, content_type='text/plain', status=400)

        # XXX: It seems that the OPTIONS call does not always include custom headers
        if request.method == 'OPTIONS':
            response = self.options(request, project)
        else:
            try:
                auth_vars = self._parse_header(request, project)
            except APIError, e:
                return HttpResponse(str(e), content_type='text/plain', status=400)

            try:
                project_, user = project_from_auth_vars(auth_vars)
            except APIError, error:
                return HttpResponse(unicode(error.msg), status=error.http_status)
            else:
                if user:
                    request.user = user

            # Legacy API was /api/store/ and the project ID was only available elsewhere
            if not project:
                if not project_:
                    return HttpResponse('Unable to identify project', content_type='text/plain', status=400)
                project = project_
            elif project_ != project:
                return HttpResponse('Project ID mismatch', content_type='text/plain', status=400)

            auth = Auth(auth_vars, is_public=bool(origin))

            if auth.version >= 3:
                # Version 3 enforces secret key for server side requests
                if origin is None and not auth.secret_key:
                    return HttpResponse('Missing required attribute in authentication header: sentry_secret', status=400)

            try:
                response = super(APIView, self).dispatch(request, project=project, auth=auth, **kwargs)

            except APIError, error:
                response = HttpResponse(unicode(error.msg), content_type='text/plain', status=error.http_status)

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
    @never_cache
    def post(self, request, project, auth, **kwargs):
        data = request.raw_post_data
        response_or_event_id = self.process(request, project, auth, data, **kwargs)
        if isinstance(response_or_event_id, HttpResponse):
            return response_or_event_id
        return HttpResponse(json.dumps({
            'id': response_or_event_id,
        }), content_type='application/json')

    @never_cache
    def get(self, request, project, auth, **kwargs):
        data = request.GET.get('sentry_data', '')
        self.process(request, project, auth, data, **kwargs)
        # We should return a simple 1x1 gif for browser so they don't throw a warning
        return HttpResponse(PIXEL, 'image/gif')

    def process(self, request, project, auth, data, **kwargs):
        if safe_execute(app.quotas.is_rate_limited, project=project):
            raise APIRateLimited
        for plugin in plugins.all():
            if safe_execute(plugin.is_rate_limited, project=project):
                raise APIRateLimited

        result = plugins.first('has_perm', request.user, 'create_event', project)
        if result is False:
            raise APIForbidden('Creation of this event was blocked')

        if not data.startswith('{'):
            data = decode_and_decompress_data(data)
        data = safely_load_json_string(data)

        try:
            # mutates data
            validate_data(project, data, auth.client)
        except InvalidData, e:
            raise APIError(u'Invalid data: %s (%s)' % (unicode(e), type(e)))

        # mutates data
        Group.objects.normalize_event_data(data)

        # insert IP address if not available
        if auth.is_public:
            ensure_has_ip(data, request.META['REMOTE_ADDR'])

        event_id = data['event_id']

        # mutates data (strips a lot of context if not queued)
        insert_data_to_database(data)

        logger.debug('New event from project %s/%s (id=%s)', project.team.slug, project.slug, event_id)

        return event_id


@csrf_exempt
@has_access
@never_cache
@api
def poll(request, team, project):
    offset = 0
    limit = EVENTS_PER_PAGE

    response = _get_group_list(
        request=request,
        project=project,
    )

    event_list = response['event_list']
    event_list = list(event_list[offset:limit])

    return to_json(event_list, request)


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
@api
def resolve(request, team, project):
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
    ).exclude(status=STATUS_RESOLVED).update(
        status=STATUS_RESOLVED,
        resolved_at=now,
    )
    group.status = STATUS_RESOLVED
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
def make_group_public(request, team, project, group_id):
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
def make_group_private(request, team, project, group_id):
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
def resolve_group(request, team, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(status=STATUS_RESOLVED)
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
def mute_group(request, team, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(status=STATUS_MUTED)
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
def unresolve_group(request, team, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    happened = group.update(status=STATUS_UNRESOLVED)
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
def remove_group(request, team, project, group_id):
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
        response = HttpResponseRedirect(reverse('sentry-stream', args=[team.slug, project.slug]))
    return response


@csrf_exempt
@has_access
@never_cache
@api
def bookmark(request, team, project):
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
def clear(request, team, project):
    response = _get_group_list(
        request=request,
        project=project,
    )

    # TODO: should we record some kind of global event in Activity?
    event_list = response['event_list']
    happened = event_list.update(status=STATUS_RESOLVED)

    if happened:
        Activity.objects.create(
            project=project,
            type=Activity.SET_RESOLVED,
            user=request.user,
        )

    data = []
    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@vary_on_cookie
@csrf_exempt
@has_access
def chart(request, team=None, project=None):
    gid = request.REQUEST.get('gid')
    days = int(request.REQUEST.get('days', '90'))
    if gid:
        try:
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        data = Group.objects.get_chart_data(group, max_days=days)
    elif project:
        data = Project.objects.get_chart_data(project, max_days=days)
    elif team:
        cache_key = 'api.chart:team=%s,days=%s' % (team.id, days)

        data = cache.get(cache_key)
        if data is None:
            project_list = list(Project.objects.filter(team=team))
            data = Project.objects.get_chart_data_for_group(project_list, max_days=days)
            cache.set(cache_key, data, 300)
    else:
        cache_key = 'api.chart:user=%s,days=%s' % (request.user.id, days)

        data = cache.get(cache_key)
        if data is None:
            project_list = Project.objects.get_for_user(request.user)
            data = Project.objects.get_chart_data_for_group(project_list, max_days=days)
            cache.set(cache_key, data, 300)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@never_cache
@csrf_exempt
@has_access
def get_group_trends(request, team=None, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    if not team and project:
        project_list = [project]
    else:
        project_list = Project.objects.get_for_user(request.user, team=team)

    project_dict = dict((p.id, p) for p in project_list)

    base_qs = Group.objects.filter(
        project__in=project_list,
        status=0,
    )

    if has_trending():
        group_list = list(Group.objects.get_accelerated(project_dict, base_qs, minutes=(
            minutes
        ))[:limit])
    else:
        cutoff = datetime.timedelta(minutes=minutes)
        cutoff_dt = timezone.now() - cutoff

        group_list = list(base_qs.filter(
            status=STATUS_UNRESOLVED,
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
def get_new_groups(request, team=None, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    if not team and project:
        project_list = [project]
    else:
        project_list = Project.objects.get_for_user(request.user, team=team)

    project_dict = dict((p.id, p) for p in project_list)

    cutoff = datetime.timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = list(Group.objects.filter(
        project__in=project_dict.keys(),
        status=STATUS_UNRESOLVED,
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
def get_resolved_groups(request, team=None, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    if not team and project:
        project_list = [project]
    else:
        project_list = Project.objects.get_for_user(request.user, team=team)

    project_dict = dict((p.id, p) for p in project_list)

    cutoff = datetime.timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = list(Group.objects.filter(
        project__in=project_list,
        status=STATUS_RESOLVED,
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
def get_stats(request, team=None, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))

    if not team and project:
        project_list = [project]
    else:
        project_list = Project.objects.get_for_user(request.user, team=team)

    cutoff = datetime.timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    num_events = ProjectCountByMinute.objects.filter(
        project__in=project_list,
        date__gte=cutoff_dt,
    ).aggregate(t=Sum('times_seen'))['t'] or 0

    # XXX: This is too slow if large amounts of groups are resolved
    num_resolved = Group.objects.filter(
        project__in=project_list,
        status=STATUS_RESOLVED,
        resolved_at__gte=cutoff_dt,
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
def search_tags(request, team, project):
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
def search_users(request, team):
    limit = min(100, int(request.GET.get('limit', 10)))
    query = request.GET['query']

    results = list(User.objects.filter(
        Q(email__istartswith=query) | Q(first_name__istartswith=query) | Q(username__istartswith=query),
    ).filter(
        Q(team_memberships=team) | Q(accessgroup__team=team),
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
def search_projects(request, team):
    limit = min(100, int(request.GET.get('limit', 10)))
    query = request.GET['query']

    results = list(Project.objects.filter(
        Q(name__istartswith=query) | Q(slug__istartswith=query),
    ).filter(team=team).distinct().order_by('name', 'slug').values('id', 'name', 'slug')[:limit])

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
    if project_id.isdigit():
        lookup = {'id': project_id}
    else:
        lookup = {'slug': project_id}
    try:
        project = Project.objects.get_from_cache(**lookup)
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
