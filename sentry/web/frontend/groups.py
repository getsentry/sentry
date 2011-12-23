"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import re

from django.core.urlresolvers import reverse
from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_exempt

from sentry.conf import settings
from sentry.models import Group, Event
from sentry.plugins import GroupActionProvider
from sentry.templatetags.sentry_helpers import with_priority
from sentry.utils import get_filters, json
from sentry.web.decorators import can_manage, login_required
from sentry.web.helpers import render_to_response, get_search_query_set, \
    get_project_list

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
event_re = re.compile(r'^(?P<event_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)


@login_required
@csrf_exempt
def ajax_handler(request):
    # TODO: remove this awful idea of an API
    op = request.REQUEST.get('op')

    def notification(request):
        return render_to_response('sentry/partial/_notification.html', request.GET)

    def poll(request):
        filters = []
        for filter_ in get_filters():
            filters.append(filter_(request))

        projects = get_project_list(request.user, 'read_message')

        offset = 0
        limit = settings.MESSAGES_PER_PAGE

        event_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

        for filter_ in filters:
            if not filter_.is_set():
                continue
            event_list = filter_.get_query_set(event_list)

        sort = request.GET.get('sort')
        if sort == 'date':
            event_list = event_list.order_by('-last_seen')
        elif sort == 'new':
            event_list = event_list.order_by('-first_seen')
        elif sort == 'freq':
            event_list = event_list.order_by('-times_seen')
        elif sort and sort.startswith('accel_'):
            event_list = Group.objects.get_accelerated(event_list, minutes=int(sort.split('_', 1)[1]))
        else:
            sort = 'priority'
            event_list = event_list.order_by('-score', '-last_seen')

        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {
                    'group': m,
                    'priority': p,
                    'request': request,
                }).strip(),
                'title': m.message_top(),
                'message': m.error(),
                'level': m.get_level_display(),
                'logger': m.logger,
                'count': m.times_seen,
                'priority': p,
            }) for m, p in with_priority(event_list[offset:limit])]

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    def resolve(request):
        gid = request.REQUEST.get('gid')
        if not gid:
            return HttpResponseForbidden()
        try:
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        if group.project and group.project.pk not in get_project_list(request.user, 'change_message_status'):
            return HttpResponseForbidden()

        Group.objects.filter(pk=group.pk).update(status=1)
        group.status = 1

        if not request.is_ajax():
            return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

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

    def clear(request):
        projects = get_project_list(request.user, 'change_message_status')

        event_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

        event_list.update(status=1)

        if not request.is_ajax():
            return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

        data = []
        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    def chart(request):
        gid = request.REQUEST.get('gid')
        if not gid:
            return HttpResponseForbidden()

        try:
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        if group.project and group.project.pk not in get_project_list(request.user, 'read_message'):
            return HttpResponseForbidden()

        data = Group.objects.get_chart_data(group)

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    if op in ['notification', 'poll', 'resolve', 'clear', 'chart']:
        return locals()[op](request)
    else:
        return HttpResponseBadRequest()


@login_required
@can_manage('read_message')
def search(request, project):
    query = request.GET.get('q')
    has_search = bool(settings.SEARCH_ENGINE)

    if query:
        result = event_re.match(query)
        if result:
            # Forward to message if it exists
            # event_id = result.group(1)
            checksum = result.group(2)
            event_list = Group.objects.filter(checksum=checksum)
            top_matches = event_list[:2]
            if len(top_matches) == 0:
                if not has_search:
                    return render_to_response('sentry/invalid_message_id.html')
                else:
                    event_list = get_search_query_set(query)
            elif len(top_matches) == 1:
                return HttpResponseRedirect(top_matches[0].get_absolute_url())
        elif uuid_re.match(query):
            # Forward to message if it exists
            try:
                message = Event.objects.get(event_id=query)
            except Event.DoesNotExist:
                if not has_search:
                    return render_to_response('sentry/invalid_message_id.html')
                else:
                    event_list = get_search_query_set(query)
            else:
                return HttpResponseRedirect(message.get_absolute_url())
        elif not has_search:
            return render_to_response('sentry/invalid_message_id.html')
        else:
            event_list = get_search_query_set(query)
    else:
        event_list = Group.objects.none()

    sort = request.GET.get('sort')
    if sort == 'date':
        event_list = event_list.order_by('-last_seen')
    elif sort == 'new':
        event_list = event_list.order_by('-first_seen')
    else:
        sort = 'relevance'

    return render_to_response('sentry/search.html', {
        'project': project,
        'event_list': event_list,
        'query': query,
        'sort': sort,
        'request': request,
    })


@login_required
@can_manage('read_message')
def group_list(request, project):
    filters = []
    for filter_ in get_filters(Group):
        filters.append(filter_(request))

    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    event_list = Group.objects.filter(project=project)

    # Filters only apply if we're not searching
    any_filter = False
    for filter_ in filters:
        if not filter_.is_set():
            continue
        any_filter = True
        event_list = filter_.get_query_set(event_list)

    sort = request.GET.get('sort')
    if sort == 'date':
        event_list = event_list.order_by('-last_seen')
    elif sort == 'new':
        event_list = event_list.order_by('-first_seen')
    elif sort == 'freq':
        event_list = event_list.order_by('-times_seen')
    elif sort and sort.startswith('accel_'):
        event_list = Group.objects.get_accelerated(event_list, minutes=int(sort.split('_', 1)[1]))
    else:
        sort = 'priority'
        event_list = event_list.order_by('-score', '-last_seen')

    today = datetime.datetime.now()

    has_realtime = page == 1

    return render_to_response('sentry/groups/group_list.html', {
        'project': project,
        'has_realtime': has_realtime,
        'event_list': event_list,
        'today': today,
        'sort': sort,
        'any_filter': any_filter,
        'request': request,
        'filters': filters,
    })


@login_required
@can_manage('read_message')
def group_json(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponse(status_code=404)

    try:
        event = group.get_latest_event()
    except IndexError:
        # It's possible that a message would not be created under certain circumstances
        # (such as a post_save signal failing)
        event = Event(group=group)

    return HttpResponse(json.dumps(event.data), mimetype='application/json')


@login_required
@can_manage('read_message')
def group(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group', kwargs={'group_id': group.pk, 'project_id': group.project_id}))

    try:
        event = group.get_latest_event()
    except IndexError:
        # It's possible that a message would not be created under certain circumstances
        # (such as a post_save signal failing)
        event = Event(group=group)

    return render_to_response('sentry/groups/details.html', {
        'project': project,
        'page': 'details',
        'group': group,
        'event': event,
        'interface_list': filter(None, [mark_safe(i.to_html(event) or '') for i in event.interfaces.itervalues()]),
        'json_data': event.data.get('extra', {}),
        'request': request,
    })


@login_required
@can_manage('read_message')
def group_event_list(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-events', kwargs={'group_id': group.pk, 'project_id': group.project_id}))

    event_list = group.event_set.all().order_by('-datetime')

    return render_to_response('sentry/groups/event_list.html', {
        'project': project,
        'group': group,
        'event_list': event_list,
        'page': 'event_list',
        'request': request
    })


@login_required
@can_manage('read_message')
def group_event_details(request, project, group_id, event_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-event', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'event_id': event_id}))

    event = get_object_or_404(group.event_set, pk=event_id)

    return render_to_response('sentry/groups/event.html', {
        'project': project,
        'page': 'event_list',
        'group': group,
        'event': event,
        'interface_list': filter(None, [mark_safe(i.to_html(event) or '') for i in event.interfaces.itervalues()]),
        'json_data': event.data.get('extra', {}),
        'request': request,
    })


@login_required
@can_manage('read_message')
def group_plugin_action(request, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-plugin-action', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'slug': slug}))

    try:
        cls = GroupActionProvider.plugins[slug]
    except KeyError:
        raise Http404('Plugin not found')
    response = cls(group.project_id, group_id)(request, project, group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={'project_id': group.project_id}))
