"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import logging
import re

from django.core.urlresolvers import reverse
from django.http import HttpResponse, \
  HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.filters import Filter
from sentry.models import Group, Event, View, SearchDocument
from sentry.plugins import plugins
from sentry.utils import json, has_trending, get_db_engine
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response

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
SORT_CLAUSES = {
    'date': 'EXTRACT(EPOCH FROM last_seen)',
    'new': 'EXTRACT(EPOCH FROM first_seen)',
    'freq': 'times_seen',
    'tottime': 'time_spent_total',
    'avgtime': '(time_spent_total / time_spent_count)',
}
SQLITE_SORT_CLAUSES = SORT_CLAUSES.copy()
SQLITE_SORT_CLAUSES.update({
    'date': 'last_seen',
    'new': 'first_seen',
})
SEARCH_SORT_OPTIONS = (
    'score',
    'date',
    'new',
)


def _get_rendered_interfaces(event):
    interface_list = []
    for interface in event.interfaces.itervalues():
        try:
            html = interface.to_html(event)
        except:
            logger = logging.getLogger('sentry.interfaces')
            logger.exception('Error rendering interface %r', interface.__class__)
        if not html:
            continue
        interface_list.append(mark_safe(html))
    return interface_list


def _get_sort_label(sort):
    if sort.startswith('accel_'):
        n = sort.split('accel_', 1)[-1]
        return _('Trending: %(minutes)d minutes' % {'minutes': int(n)})

    return {
        'date': _('Last Seen'),
        'new': _('First Seen'),
        'freq': _('Frequency'),
        'tottime': _('Total Time Spent'),
        'avgtime': _('Average Time Spent'),
        'priority': _('Priority'),
        'score': _('Score'),
    }[sort]


def _get_group_list(request, project, view=None):
    filters = []
    for cls in Filter.objects.filter(Group):
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
        sort = settings.DEFAULT_SORT_OPTION

    sqlite = get_db_engine('default').startswith('sqlite')
    if sqlite:
        sort_clause = SQLITE_SORT_CLAUSES.get(sort)
    else:
        sort_clause = SORT_CLAUSES.get(sort)

    if sort == 'tottime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif sort == 'avgtime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif has_trending() and sort and sort.startswith('accel_'):
        event_list = Group.objects.get_accelerated(event_list, minutes=int(sort.split('_', 1)[1]))

    if sort_clause:
        event_list = event_list.extra(
            select={'sort_value': sort_clause},
        ).order_by('-sort_value', '-last_seen')
        cursor = request.GET.get('cursor')
        if cursor:
            event_list = event_list.extra(
                where=['%s > %%s' % sort_clause],
                params=[cursor],
            )

    return filters, event_list


@login_required
@has_access
def search(request, project):
    query = request.GET.get('q')

    if not query:
        return HttpResponseRedirect(reverse('sentry', args=[project.pk]))

    sort = request.GET.get('sort')
    if sort not in SEARCH_SORT_OPTIONS:
        sort = settings.SEARCH_DEFAULT_SORT_OPTION
    sort_label = _get_sort_label(sort)

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
            message = Event.objects.get(project=project, event_id=query)
        except Event.DoesNotExist:
            return render_to_response('sentry/invalid_message_id.html', {
                'project': project,
            }, request)
        else:
            return HttpResponseRedirect(message.get_absolute_url())
    elif not settings.USE_SEARCH:
        event_list = Group.objects.none()
        # return render_to_response('sentry/invalid_message_id.html', {
        #         'project': project,
        #     }, request)
    else:
        documents = list(SearchDocument.objects.search(project, query, sort_by=sort))
        groups = Group.objects.in_bulk([d.group_id for d in documents])

        event_list = []
        for doc in documents:
            try:
                event_list.append(groups[doc.group_id])
            except KeyError:
                continue

    return render_to_response('sentry/search.html', {
        'project': project,
        'event_list': event_list,
        'query': query,
        'sort': sort,
        'sort_label': sort_label,
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
        sort = settings.DEFAULT_SORT_OPTION
    sort_label = _get_sort_label(sort)

    today = datetime.datetime.utcnow()

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
        'PAGE': 'dashboard',
    }, request)


@login_required
@has_access
def group_json(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponse(status_code=404)

    # It's possible that a message would not be created under certain
    # circumstances (such as a post_save signal failing)
    event = group.get_latest_event() or Event()

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

    # It's possible that a message would not be created under certain
    # circumstances (such as a post_save signal failing)
    event = group.get_latest_event() or Event(group=group)

    return render_to_response('sentry/groups/details.html', {
        'project': project,
        'page': 'details',
        'group': group,
        'event': event,
        'interface_list': _get_rendered_interfaces(event),
        'json_data': event.data.get('extra', {}),
        'version_data': event.data.get('modules', None),
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
        'interface_list': _get_rendered_interfaces(event),
        'json_data': event.data.get('extra', {}),
        'version_data': event.data.get('modules', None),
    }, request)


@login_required
@has_access
def group_plugin_action(request, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-plugin-action', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'slug': slug}))

    try:
        plugin = plugins.get(slug)
    except KeyError:

        raise Http404('Plugin not found')
    response = plugin.get_view_response(request, group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={'project_id': group.project_id}))
