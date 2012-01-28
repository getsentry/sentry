"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest, \
  HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.conf import settings
from sentry.coreapi import project_from_auth_vars, project_from_api_key_and_id, \
  project_from_id, decode_and_decompress_data, safely_load_json_string, \
  validate_data, insert_data_to_database, APIError, APIUnauthorized, \
  extract_auth_vars
from sentry.models import Group, GroupBookmark, Project, View
from sentry.utils import json
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response, \
  get_project_list, render_to_string


@csrf_exempt
@require_http_methods(['POST'])
def store(request):
    try:
        auth_vars = extract_auth_vars(request)
        data = request.raw_post_data

        if auth_vars:
            server_version = auth_vars.get('sentry_version', '1.0')
        else:
            server_version = request.GET.get('version', '1.0')

        if server_version not in ('1.0', '2.0'):
            raise APIError('Client/server version mismatch. Unsupported version: %r' % server_version)

        if auth_vars:
            project = project_from_auth_vars(auth_vars, data)
        elif request.GET.get('api_key') and request.GET.get('project_id') and request.is_secure():
            # ssl requests dont have to have signature verification
            project = project_from_api_key_and_id(request.GET['api_key'], request.GET['project_id'])
        elif request.GET.get('project_id') and request.user.is_authenticated():
            # authenticated users are simply trusted to provide the right id
            project = project_from_id(request)
        else:
            raise APIUnauthorized()

        if not data.startswith('{'):
            data = decode_and_decompress_data(data)
        data = safely_load_json_string(data)

        validate_data(project, data)

        insert_data_to_database(data)
    except APIError, error:
        return HttpResponse(error.msg, status=error.http_status)
    return HttpResponse('')


@csrf_exempt
@has_access
def notification(request, project):
    return render_to_response('sentry/partial/_notification.html', request.GET)


@csrf_exempt
@has_access
def poll(request, project):
    from sentry.templatetags.sentry_helpers import as_bookmarks, handle_before_events

    offset = 0
    limit = settings.MESSAGES_PER_PAGE

    view_id = request.GET.get('view_id')
    if view_id:
        try:
            view = View.objects.get(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseBadRequest()
    else:
        view = None

    filters, event_list = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

    event_list = list(event_list[offset:limit])
    handle_before_events(request, event_list)

    data = [
        (m.pk, {
            'html': render_to_string('sentry/partial/_group.html', {
                'group': m,
                'request': request,
                'is_bookmarked': b,
            }).strip(),
            'title': m.message_top(),
            'message': m.error(),
            'level': m.get_level_display(),
            'logger': m.logger,
            'count': m.times_seen,
        }) for m, b in as_bookmarks(event_list, request.user)]

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access
def resolve(request, project):
    gid = request.REQUEST.get('gid')
    if not gid:
        return HttpResponseForbidden()
    try:
        group = Group.objects.get(pk=gid)
    except Group.DoesNotExist:
        return HttpResponseForbidden()

    if group.project and group.project.pk not in get_project_list(request.user):
        return HttpResponseForbidden()

    Group.objects.filter(pk=group.pk).update(status=1)
    group.status = 1

    data = [
        (m.pk, {
            'html': render_to_string('sentry/partial/_group.html', {
                'group': m,
                'request': request,
            }).strip(),
            'count': m.times_seen,
        }) for m in [group]]

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access
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

    if group.project and group.project.pk not in get_project_list(request.user):
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
@has_access
def clear(request, project):
    projects = get_project_list(request.user)

    event_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

    event_list.update(status=1)

    data = []
    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response


@csrf_exempt
@has_access
def chart(request, project):
    gid = request.REQUEST.get('gid')
    days = int(request.REQUEST.get('days', '90'))

    if gid:
        try:
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        if group.project and group.project.pk not in get_project_list(request.user):
            return HttpResponseForbidden()

        data = Group.objects.get_chart_data(group, max_days=days)
    else:
        data = Project.objects.get_chart_data(project, max_days=days)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response
