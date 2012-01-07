"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

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
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

from sentry.conf import settings
from sentry.filters import Filter
from sentry.models import Group, Event, Project, View
from sentry.utils import json, has_trending
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response, \
    get_project_list

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
event_re = re.compile(r'^(?P<event_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)


SORT_OPTIONS = (
    'priority',
    'date',
    'new',
    'freq',
    'tottime',
    'avgtime',
    'accel_15',
    'accel_60',
)
DEFAULT_SORT_OPTION = 'priority'


def _get_sort_label(sort):
    if sort.startswith('accel_'):
        n = sort.split('accel_', 1)[-1]
        return _('Trending: %d minutes', n)

    return {
        'date': _('Last Seen'),
        'new': _('First Seen'),
        'freq': _('Frequency'),
        'tottime': _('Total Time Spent'),
        'avgtime': _('Average Time Spent'),
        'priority': _('Priority'),
    }[sort]


def _get_group_list(request, project, view=None):
    filters = []
    for cls in Filter.handlers.filter(Group):
        filters.append(cls(request))

    event_list = Group.objects
    if request.GET.get('bookmarks'):
        event_list = event_list.filter(
            bookmark_set__project=project,
            bookmark_set__user=request.user,
        )
    else:
        event_list = event_list.filter(project=project)

    if view:
        event_list = event_list.filter(views=view)

    for filter_ in filters:
        if not filter_.is_set():
            continue
        event_list = filter_.get_query_set(event_list)

    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    if sort == 'date':
        event_list = event_list.order_by('-last_seen')
    elif sort == 'new':
        event_list = event_list.order_by('-first_seen')
    elif sort == 'freq':
        event_list = event_list.order_by('-times_seen')
    elif sort == 'tottime':
        event_list = event_list.filter(time_spent_count__gt=0)\
                                .order_by('-time_spent_total')
    elif sort == 'avgtime':
        event_list = event_list.filter(time_spent_count__gt=0)\
                               .extra(select={'avg_time_spent': 'time_spent_total / time_spent_count'})\
                               .order_by('-avg_time_spent')
    elif has_trending() and sort and sort.startswith('accel_'):
        event_list = Group.objects.get_accelerated(event_list, minutes=int(sort.split('_', 1)[1]))
    elif sort == 'priority':
        sort = 'priority'
        event_list = event_list.order_by('-score', '-last_seen')
    else:
        raise NotImplementedError('Sort not implemented: %r' % sort)

    return filters, event_list


@login_required
@csrf_exempt
@has_access
def ajax_handler(request, project):
    # TODO: remove this awful idea of an API
    op = request.REQUEST.get('op')

    def notification(request, project):
        return render_to_response('sentry/partial/_notification.html', request.GET)

    def poll(request, project):
        offset = 0
        limit = settings.MESSAGES_PER_PAGE

        view_id = request.GET.get('view_id')
        if view_id:
            try:
                view = View.objects.get(pk=view_id)
            except View.DoesNotExist:
                return HttpResponseRedirect(reverse('sentry', args=[project.pk]))
        else:
            view = None

        filters, event_list = _get_group_list(
            request=request,
            project=project,
            view=view,
        )

        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {
                    'group': m,
                    'request': request,
                }).strip(),
                'title': m.message_top(),
                'message': m.error(),
                'level': m.get_level_display(),
                'logger': m.logger,
                'count': m.times_seen,
            }) for m in event_list[offset:limit]]

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

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

    def clear(request, project):
        projects = get_project_list(request.user)

        event_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

        event_list.update(status=1)

        if not request.is_ajax():
            return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

        data = []
        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

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

    if op in ['notification', 'poll', 'resolve', 'clear', 'chart']:
        return locals()[op](request, project)
    else:
        return HttpResponseBadRequest()


@login_required
@has_access
def search(request, project):
    query = request.GET.get('q')

    if query:
        result = event_re.match(query)
        if result:
            # Forward to message if it exists
            # event_id = result.group(1)
            checksum = result.group(2)
            event_list = Group.objects.filter(checksum=checksum)
            top_matches = event_list[:2]
            if len(top_matches) == 0:
                return render_to_response('sentry/invalid_message_id.html', {
                    'project': project,
                }, request)
            elif len(top_matches) == 1:
                return HttpResponseRedirect(top_matches[0].get_absolute_url())
        elif uuid_re.match(query):
            # Forward to message if it exists
            try:
                message = Event.objects.get(event_id=query)
            except Event.DoesNotExist:
                return render_to_response('sentry/invalid_message_id.html', {
                    'project': project,
                }, request)
            else:
                return HttpResponseRedirect(message.get_absolute_url())
        else:
            return render_to_response('sentry/invalid_message_id.html', {
                    'project': project,
                }, request)
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
    }, request)


@login_required
@has_access
def group_list(request, project, view_id=None):
    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    if view_id:
        try:
            view = View.objects.get(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry', args=[project.pk]))
    else:
        view = None

    filters, event_list = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

    # XXX: this is duplicate in _get_group_list
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION
    sort_label = _get_sort_label(sort)

    today = datetime.datetime.now()

    has_realtime = page == 1

    return render_to_response('sentry/groups/group_list.html', {
        'project': project,
        'has_realtime': has_realtime,
        'event_list': event_list,
        'today': today,
        'sort': sort,
        'sort_label': sort_label,
        'filters': filters,
        'view': view,
        'HAS_TRENDING': has_trending(),
    }, request)


@login_required
@has_access
def group_json(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponse(status_code=404)

    try:
        event = group.get_latest_event()
    except IndexError:
        # It's possible that a message would not be created under certain circumstances
        # (such as a post_save signal failing)
        event = Event()

    # We use a SortedDict to keep elements ordered for the JSON serializer
    data = SortedDict()
    data['id'] = event.event_id
    data['checksum'] = event.checksum
    data['project'] = event.project_id
    data['logger'] = event.logger
    data['level'] = event.get_level_display()
    data['culprit'] = event.culprit
    for k, v in sorted(event.data.iteritems()):
        data[k] = v

    return HttpResponse(json.dumps(data), mimetype='application/json')


@login_required
@has_access
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
    }, request)


@login_required
@has_access
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
    }, request)


@login_required
@has_access
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
    }, request)


@login_required
@has_access
def group_plugin_action(request, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-plugin-action', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'slug': slug}))

    plugin = None
    for inst in request.plugins:
        if inst.slug == slug:
            plugin = inst
            break
    if not plugin:
        raise Http404('Plugin not found')
    response = inst(group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={'project_id': group.project_id}))
