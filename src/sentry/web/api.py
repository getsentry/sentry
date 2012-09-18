"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import logging

from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseBadRequest, \
  HttpResponseForbidden, HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.decorators.vary import vary_on_cookie
from functools import wraps
from sentry.conf import settings
from sentry.constants import MEMBER_USER
from sentry.coreapi import project_from_auth_vars, project_from_id, \
  decode_and_decompress_data, safely_load_json_string, validate_data, \
  insert_data_to_database, APIError, APIUnauthorized, extract_auth_vars
from sentry.exceptions import InvalidData
from sentry.models import Group, GroupBookmark, Project, View
from sentry.templatetags.sentry_helpers import with_metadata
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.utils.db import has_trending
from sentry.utils.http import is_same_domain, is_valid_origin, apply_access_control_headers
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response, render_to_string, get_project_list

error_logger = logging.getLogger('sentry.errors.api.http')
logger = logging.getLogger('sentry.api.http')


def transform_groups(request, group_list, template='sentry/partial/_group.html'):
    return [
        {
            'id': m.pk,
            'html': render_to_string(template, {
                'group': m,
                'request': request,
                'metadata': d,
            }).strip(),
            'title': m.message_top(),
            'message': m.error(),
            'level': m.get_level_display(),
            'logger': m.logger,
            'count': m.times_seen,
            'is_public': m.is_public,
            'score': getattr(m, 'sort_value', None),
        }
        for m, d in with_metadata(group_list, request)
    ]


def api_method(func):
    @wraps(func)
    @csrf_exempt
    def wrapped(request, project_id=None, *args, **kwargs):
        if project_id:
            if project_id.isdigit():
                lookup_kwargs = {'id': int(project_id)}
            else:
                lookup_kwargs = {'slug': project_id}
            try:
                project = Project.objects.get_from_cache(**lookup_kwargs)
            except Project.DoesNotExist:
                return HttpResponse('Invalid project_id: %r' % project_id, status=400)
        else:
            project = None

        origin = request.META.get('HTTP_ORIGIN', None)
        if origin is not None and not is_valid_origin(origin, project):
            return HttpResponse('Invalid origin: %r' % origin, status=400)

        response = func(request, project, *args, **kwargs)
        response = apply_access_control_headers(response, origin)

        return response
    return wrapped


@require_http_methods(['POST', 'OPTIONS'])
@never_cache
@api_method
def store(request, project=None):
    """
    The primary endpoint for storing new events.

    This will validate the client's authentication and data, and if
    successfull pass on the payload to the internal database handler.

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
    logger.debug('Inbound %r request from %r (%s)', request.method, request.META['REMOTE_ADDR'],
        request.META.get('HTTP_USER_AGENT'))
    client = '<unknown client>'

    response = HttpResponse()

    if request.method == 'POST':
        try:
            auth_vars = extract_auth_vars(request)
            data = request.raw_post_data

            if auth_vars:
                server_version = auth_vars.get('sentry_version', '1.0')
                client = auth_vars.get('sentry_client', request.META.get('HTTP_USER_AGENT'))
            else:
                server_version = request.GET.get('version', '1.0')
                client = request.META.get('HTTP_USER_AGENT', request.GET.get('client'))

            if server_version not in ('1.0', '2.0'):
                raise APIError('Client/server version mismatch: Unsupported version: %r' % server_version)

            if server_version != '1.0' and not client:
                raise APIError('Client request error: Missing client version identifier.')

            referrer = request.META.get('HTTP_REFERER')

            if auth_vars:
                # We only require a signature if a referrer was not set
                # (this is restricted via the CORS headers)
                project_ = project_from_auth_vars(auth_vars, data,
                    require_signature=False)

                if not project:
                    project = project_
                elif project_ != project:
                    raise APIError('Project ID mismatch')

            elif request.user.is_authenticated() and is_same_domain(request.build_absolute_uri(), referrer):
                # authenticated users are simply trusted to provide the right id
                project_ = project_from_id(request)

                if not project:
                    project = project_
                elif project_ != project:
                    raise APIError('Project ID mismatch')

            else:
                raise APIUnauthorized()

            if not data.startswith('{'):
                data = decode_and_decompress_data(data)
            data = safely_load_json_string(data)

            try:
                validate_data(project, data, client)
            except InvalidData, e:
                raise APIError(u'Invalid data: %s' % unicode(e))

            insert_data_to_database(data)
        except APIError, error:
            logger.error('Client %r raised API error: %s', client, error, extra={
                'request': request,
            }, exc_info=True)
            response = HttpResponse(unicode(error.msg), status=error.http_status)
        else:
            logger.info('New event from client %r (id=%s)', client, data['event_id'])

    return response


@csrf_exempt
@has_access
@never_cache
def notification(request, project):
    return render_to_response('sentry/partial/_notification.html', request.GET)


@csrf_exempt
@has_access
@never_cache
def poll(request, project):
    from sentry.templatetags.sentry_plugins import handle_before_events

    offset = 0
    limit = settings.MESSAGES_PER_PAGE

    view_id = request.GET.get('view_id')
    if view_id:
        try:
            view = View.objects.get_from_cache(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseBadRequest()
    else:
        view = None

    response = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

    event_list = response['event_list']
    event_list = list(event_list[offset:limit])
    handle_before_events(request, event_list)

    data = transform_groups(request, event_list)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def resolve(request, project):
    gid = request.REQUEST.get('gid')
    if not gid:
        return HttpResponseForbidden()
    try:
        group = Group.objects.get(pk=gid)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    now = timezone.now()

    Group.objects.filter(pk=group.pk).update(
        status=1,
        resolved_at=now,
    )
    group.status = 1
    group.resolved_at = now

    data = transform_groups(request, [group])

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def make_group_public(request, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    group.update(is_public=True)

    data = transform_groups(request, [group])

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def make_group_private(request, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    group.update(is_public=False)

    data = transform_groups(request, [group])

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def remove_group(request, project, group_id):
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    group.delete()

    if request.is_ajax():
        response = HttpResponse('{}')
        response['Content-Type'] = 'application/json'
    else:
        response = HttpResponseRedirect(reverse('sentry', args=[project.slug]))
    return response


@csrf_exempt
@has_access
@never_cache
def bookmark(request, project):
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

    response = HttpResponse(json.dumps({'bookmarked': created}))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access(MEMBER_USER)
@never_cache
def clear(request, project):
    view_id = request.GET.get('view_id')
    if view_id:
        try:
            view = View.objects.get_from_cache(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseBadRequest()
    else:
        view = None

    response = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

    event_list = response['event_list']
    event_list.update(status=1)

    data = []
    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@vary_on_cookie
@csrf_exempt
@has_access
def chart(request, project=None):
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
    else:
        cache_key = 'api.chart:user=%s,days=%s' % (request.user.id, days)

        data = cache.get(cache_key)
        if data is None:
            project_list = get_project_list(request.user).values()
            data = Project.objects.get_chart_data_for_group(project_list, max_days=days)
            cache.set(cache_key, data, 300)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@never_cache
@csrf_exempt
@has_access
def get_group_trends(request, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    if project:
        project_dict = {project.pk: project}
    else:
        project_dict = get_project_list(request.user)

    base_qs = Group.objects.filter(
        project__in=project_dict.keys(),
        status=0,
    ).order_by('-score')

    if has_trending():
        group_list = list(Group.objects.get_accelerated(base_qs, minutes=(
            minutes
        ))[:limit])
    else:
        cutoff = datetime.timedelta(minutes=minutes)
        cutoff_dt = timezone.now() - cutoff

        group_list = list(base_qs.filter(
            last_seen__gte=cutoff_dt
        )[:limit])

    for group in group_list:
        group._project_cache = project_dict.get(group.project_id)

    data = transform_groups(request, group_list, template='sentry/partial/_group_small.html')

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'

    return response


@never_cache
@csrf_exempt
@has_access
def get_new_groups(request, project=None):
    minutes = int(request.REQUEST.get('minutes', 15))
    limit = min(100, int(request.REQUEST.get('limit', 10)))

    if project:
        project_list = [project]
    else:
        project_list = get_project_list(request.user).values()

    cutoff = datetime.timedelta(minutes=minutes)
    cutoff_dt = timezone.now() - cutoff

    group_list = Group.objects.filter(
        project__in=project_list,
        status=0,
        active_at__gte=cutoff_dt,
    ).select_related('project').order_by('-score')[:limit]

    data = transform_groups(request, group_list, template='sentry/partial/_group_small.html')

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'

    return response
