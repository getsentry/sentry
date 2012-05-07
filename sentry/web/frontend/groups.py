"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import logging
import re

from django.core.urlresolvers import reverse
from django.http import HttpResponse, \
  HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404
from django.utils.safestring import mark_safe

from sentry.conf import settings
from sentry.constants import SORT_OPTIONS, SEARCH_SORT_OPTIONS, \
  SORT_CLAUSES, MYSQL_SORT_CLAUSES, SQLITE_SORT_CLAUSES
from sentry.filters import get_filters
from sentry.models import Group, Event, View, SearchDocument
from sentry.plugins import plugins
from sentry.utils import json
from sentry.utils.dates import parse_date
from sentry.utils.db import has_trending, get_db_engine
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
event_re = re.compile(r'^(?P<event_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)


def _get_rendered_interfaces(event):
    interface_list = []
    for interface in event.interfaces.itervalues():
        try:
            html = interface.to_html(event)
        except:
            logger = logging.getLogger('sentry.interfaces')
            logger.exception('Error rendering interface %r', interface.__class__)
            continue
        if not html:
            continue
        interface_list.append(mark_safe(html))
    return interface_list


def _get_group_list(request, project, view=None):
    filters = []
    for cls in get_filters(Group, project):
        try:
            filters.append(cls(request, project))
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error initializing filter %r: %s', cls, e)

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
        try:
            if not filter_.is_set():
                continue
            event_list = filter_.get_query_set(event_list)
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error processing filter %r: %s', cls, e)

    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = settings.DEFAULT_SORT_OPTION

    if sort.startswith('accel_') and not has_trending():
        sort = settings.DEFAULT_SORT_OPTION

    engine = get_db_engine('default')
    if engine.startswith('sqlite'):
        sort_clause = SQLITE_SORT_CLAUSES.get(sort)
    elif engine.startswith('mysql'):
        sort_clause = MYSQL_SORT_CLAUSES.get(sort)
    else:
        sort_clause = SORT_CLAUSES.get(sort)

    if sort == 'tottime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif sort == 'avgtime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif sort.startswith('accel_'):
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
        return HttpResponseRedirect(reverse('sentry', args=[project.slug]))

    sort = request.GET.get('sort')
    if sort not in SEARCH_SORT_OPTIONS:
        sort = settings.SEARCH_DEFAULT_SORT_OPTION
    sort_label = SEARCH_SORT_OPTIONS[sort]

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
            view = View.objects.get_from_cache(pk=view_id)
        except View.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry', args=[project.slug]))
    else:
        view = None

    filters, event_list = _get_group_list(
        request=request,
        project=project,
        view=view,
    )

    date_from = request.GET.get('df')
    time_from = request.GET.get('tf')
    date_to = request.GET.get('dt')
    time_to = request.GET.get('tt')

    today = datetime.datetime.utcnow()

    # date format is Y-m-d
    if any(x is not None for x in [date_from, time_from, date_to, time_to]):
        date_from, date_to = parse_date(date_from, time_from), parse_date(date_to, time_to)
    else:
        date_from = today - datetime.timedelta(days=3)
        date_to = None

    if date_from:
        event_list = event_list.filter(event_set__datetime__gte=date_from)
    if date_to:
        event_list = event_list.filter(event_set__datetime__lte=date_to)

    # XXX: this is duplicate in _get_group_list
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = settings.DEFAULT_SORT_OPTION
    sort_label = SORT_OPTIONS[sort]

    has_realtime = page == 1

    return render_to_response('sentry/groups/group_list.html', {
        'project': project,
        'from_date': date_from,
        'to_date': date_to,
        'has_realtime': has_realtime,
        'event_list': event_list,
        'today': today,
        'sort': sort,
        'sort_label': sort_label,
        'filters': filters,
        'view': view,
        'SORT_OPTIONS': SORT_OPTIONS,
        'HAS_TRENDING': has_trending(),
        'PAGE': 'dashboard',
    }, request)


@login_required
@has_access
def group(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group', kwargs={'group_id': group.pk, 'project_id': group.project.slug}))

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
        return HttpResponseRedirect(reverse('sentry-group-events', kwargs={'group_id': group.pk, 'project_id': group.project.slug}))

    event_list = group.event_set.all().order_by('-datetime')

    return render_to_response('sentry/groups/event_list.html', {
        'project': project,
        'group': group,
        'event_list': event_list,
        'page': 'event_list',
    }, request)


@login_required
@has_access
def group_event_list_json(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponse(status=404)

    limit = request.GET.get('limit', settings.MAX_JSON_RESULTS)
    try:
        limit = int(limit)
    except ValueError:
        return HttpResponse('non numeric limit', status=400, mimetype='text/plain')
    if limit > settings.MAX_JSON_RESULTS:
        return HttpResponse("too many objects requested", mimetype='text/plain', status=400)

    events = group.event_set.order_by('-id')[:limit]

    return HttpResponse(json.dumps(list(event.as_dict() for event in events)), mimetype='application/json')


@login_required
@has_access
def group_event_details(request, project, group_id, event_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-event', kwargs={'group_id': group.pk, 'project_id': group.project.slug, 'event_id': event_id}))

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
def group_event_details_json(request, project, group_id, event_id_or_latest):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponse(status=404)

    if event_id_or_latest == 'latest':
        # It's possible that a message would not be created under certain
        # circumstances (such as a post_save signal failing)
        event = group.get_latest_event() or Event()
    else:
        event = get_object_or_404(group.event_set, pk=event_id_or_latest)

    return HttpResponse(json.dumps(event.as_dict()), mimetype='application/json')


@login_required
@has_access
def group_plugin_action(request, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-plugin-action', kwargs={'group_id': group.pk, 'project_id': group.project.slug, 'slug': slug}))

    try:
        plugin = plugins.get(slug)
    except KeyError:

        raise Http404('Plugin not found')
    response = plugin.get_view_response(request, group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={'project_id': group.project.slug}))
