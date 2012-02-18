"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import logging

from django.http import HttpResponse, HttpResponseBadRequest, \
  HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.conf import settings
from sentry.coreapi import project_from_auth_vars, project_from_api_key_and_id, \
  project_from_id, decode_and_decompress_data, safely_load_json_string, \
  validate_data, insert_data_to_database, APIError, APIUnauthorized, \
  extract_auth_vars, InvalidTimestamp
from sentry.models import Group, GroupBookmark, Project, View, ProjectDomain
from sentry.utils import json
from sentry.utils.http import is_same_domain, apply_access_control_headers
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.helpers import render_to_response, render_to_string

error_logger = logging.getLogger('sentry.errors.api.http')
logger = logging.getLogger('sentry.api.http')


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def store(request):
    """
    The primary endpoint for storing new events.

    This will validate the client's authentication and data, and if
    successfull pass on the payload to the internal database handler.

    Authentication works in three flavors:

    1. Explicit signed requests

       These are implemented using the documented signed request protocol, and
       require an authentication header which is signed using with the project
       member's secret key.

    2. Explicit trusted requests

       Generally used for communications with client-side platforms (such as
       JavaScript in the browser), they require the GET variables public_key
       and project_id, as well as an HTTP_REFERER to be set from a trusted
       domain.

    3. Implicit trusted requests

       Used by the Sentry core, they are only available from same-domain requests
       and do not require any authentication information. They only require that
       the user be authenticated, and a project_id be sent in the GET variables.

    """
    logger.debug('Inbound %r request from %r', request.method, request.META['REMOTE_ADDR'])
    client = '<unknown client>'
    try:
        if request.method == 'POST':
            auth_vars = extract_auth_vars(request)
            data = request.raw_post_data

            if auth_vars:
                server_version = auth_vars.get('sentry_version', '1.0')
                client = auth_vars.get('sentry_client')
            else:
                server_version = request.GET.get('version', '1.0')
                client = request.META.get('HTTP_USER_AGENT', request.GET.get('client'))

            if server_version not in ('1.0', '2.0'):
                raise APIError('Client/server version mismatch: Unsupported version: %r' % server_version)

            if server_version != '1.0' and not client:
                raise APIError('Client request error: Missing client version identifier.')

            referrer = request.META.get('HTTP_REFERER')

            if auth_vars:
                project = project_from_auth_vars(auth_vars, data)
            elif request.GET.get('api_key') and request.GET.get('project_id'):
                # public requests only need referrer validation for CSRF
                project = project_from_api_key_and_id(request.GET['api_key'], request.GET['project_id'])
                if not ProjectDomain.test(project, referrer):
                    raise APIUnauthorized()
            elif request.GET.get('project_id') and request.user.is_authenticated() and \
                 is_same_domain(request.build_absolute_uri(), referrer):
                # authenticated users are simply trusted to provide the right id
                project = project_from_id(request)
            else:
                raise APIUnauthorized()

            if not data.startswith('{'):
                data = decode_and_decompress_data(data)
            data = safely_load_json_string(data)

            try:
                validate_data(project, data)
            except InvalidTimestamp:
                # Log the error, remove the timestamp, and revalidate
                error_logger.error('Client %r passed an invalid value for timestamp %r' % (
                    data['timestamp'],
                    client or '<unknown client>',
                ))
                del data['timestamp']
                validate_data(project, data)

            insert_data_to_database(data)
    except APIError, error:
        logging.error('Client %r raised API error: %s' % (client, error), exc_info=True)
        response = HttpResponse(unicode(error.msg), status=error.http_status)
    else:
        logging.info('New event from client %r (id=%%s)' % client, data['event_id'])
        response = HttpResponse('')
    return apply_access_control_headers(response)


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
        {
            'id': m.pk,
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
            'score': getattr(m, 'sort_value', None),
        } for m, b in as_bookmarks(event_list, request.user)]

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
    view_id = request.GET.get('view_id')
    if view_id:
        try:
            view = View.objects.get(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseBadRequest()
    else:
        view = None

    _, event_list = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

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

        data = Group.objects.get_chart_data(group, max_days=days)
    else:
        data = Project.objects.get_chart_data(project, max_days=days)

    response = HttpResponse(json.dumps(data))
    response['Content-Type'] = 'application/json'
    return response
