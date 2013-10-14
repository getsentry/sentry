"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains views for the "Events" section of Sentry.

TODO: Move all events.py views into here, and rename this file to events.

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division

import datetime
import logging
import re

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from sentry.constants import (
    SORT_OPTIONS, SEARCH_SORT_OPTIONS, SORT_CLAUSES,
    MYSQL_SORT_CLAUSES, SQLITE_SORT_CLAUSES, MEMBER_USER,
    SCORE_CLAUSES, MYSQL_SCORE_CLAUSES, SQLITE_SCORE_CLAUSES,
    ORACLE_SORT_CLAUSES, ORACLE_SCORE_CLAUSES,
    MSSQL_SORT_CLAUSES, MSSQL_SCORE_CLAUSES, DEFAULT_SORT_OPTION,
    SEARCH_DEFAULT_SORT_OPTION, MAX_JSON_RESULTS)
from sentry.db.models import create_or_update
from sentry.filters import get_filters
from sentry.models import (
    Project, Group, Event, SearchDocument, Activity, EventMapping, TagKey,
    GroupSeen)
from sentry.permissions import can_admin_group, can_create_projects
from sentry.plugins import plugins
from sentry.utils import json
from sentry.utils.dates import parse_date
from sentry.utils.db import has_trending, get_db_engine
from sentry.web.decorators import has_access, has_group_access, login_required
from sentry.web.helpers import render_to_response, group_is_public

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
event_re = re.compile(r'^(?P<event_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)


def _get_group_list(request, project):
    filters = []
    for cls in get_filters(Group, project):
        try:
            filters.append(cls(request, project))
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error initializing filter %r: %s', cls, e)

    event_list = Group.objects
    if request.user.is_authenticated() and request.GET.get('bookmarks'):
        event_list = event_list.filter(
            bookmark_set__project=project,
            bookmark_set__user=request.user,
        )
    else:
        event_list = event_list.filter(project=project)

    for filter_ in filters:
        try:
            if not filter_.is_set():
                continue
            event_list = filter_.get_query_set(event_list)
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error processing filter %r: %s', cls, e)

    date_from = request.GET.get('df')
    time_from = request.GET.get('tf')
    date_to = request.GET.get('dt')
    time_to = request.GET.get('tt')
    date_type = request.GET.get('date_type')

    today = timezone.now()

    # date format is Y-m-d
    if any(x is not None for x in [date_from, time_from, date_to, time_to]):
        date_from, date_to = parse_date(date_from, time_from), parse_date(date_to, time_to)
    else:
        date_from = today - datetime.timedelta(days=5)
        date_to = None

    if date_type == 'first_seen':
        if date_from:
            event_list = event_list.filter(first_seen__gte=date_from)
        elif date_to:
            event_list = event_list.filter(first_seen__lte=date_to)
    else:
        if date_from and date_to:
            event_list = event_list.filter(
                groupcountbyminute__date__gte=date_from,
                groupcountbyminute__date__lte=date_to,
            )
        elif date_from:
            event_list = event_list.filter(last_seen__gte=date_from)
        elif date_to:
            event_list = event_list.filter(last_seen__lte=date_to)

    sort = request.GET.get('sort') or request.session.get('streamsort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    # Save last sort in session
    if sort != request.session.get('streamsort'):
        request.session['streamsort'] = sort

    if sort.startswith('accel_') and not has_trending():
        sort = DEFAULT_SORT_OPTION

    engine = get_db_engine('default')
    if engine.startswith('sqlite'):
        score_clause = SQLITE_SORT_CLAUSES.get(sort)
        filter_clause = SQLITE_SCORE_CLAUSES.get(sort)
    elif engine.startswith('mysql'):
        score_clause = MYSQL_SORT_CLAUSES.get(sort)
        filter_clause = MYSQL_SCORE_CLAUSES.get(sort)
    elif engine.startswith('oracle'):
        score_clause = ORACLE_SORT_CLAUSES.get(sort)
        filter_clause = ORACLE_SCORE_CLAUSES.get(sort)
    elif engine in ('django_pytds', 'sqlserver_ado', 'sql_server.pyodbc'):
        score_clause = MSSQL_SORT_CLAUSES.get(sort)
        filter_clause = MSSQL_SCORE_CLAUSES.get(sort)
    else:
        score_clause = SORT_CLAUSES.get(sort)
        filter_clause = SCORE_CLAUSES.get(sort)

    # IMPORTANT: All filters must already be applied once we reach this point

    if sort == 'tottime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif sort == 'avgtime':
        event_list = event_list.filter(time_spent_count__gt=0)
    elif sort.startswith('accel_'):
        event_list = Group.objects.get_accelerated(
            [project.id], event_list, minutes=int(sort.split('_', 1)[1]))

    if score_clause:
        event_list = event_list.extra(
            select={'sort_value': score_clause},
        )
        # HACK: don't sort by the same column twice
        if sort == 'date':
            event_list = event_list.order_by('-last_seen')
        else:
            event_list = event_list.order_by('-sort_value', '-last_seen')
        cursor = request.GET.get('cursor', request.GET.get('c'))
        if cursor:
            event_list = event_list.extra(
                where=['%s > %%s' % filter_clause],
                params=[float(cursor)],
            )

    return {
        'filters': filters,
        'event_list': event_list,
        'date_from': date_from,
        'date_to': date_to,
        'today': today,
        'sort': sort,
        'date_type': date_type
    }


def render_with_group_context(group, template, context, request=None,
                              event=None, is_public=False):
    context.update({
        'team': group.project.team,
        'project': group.project,
        'group': group,
        'can_admin_event': can_admin_group(request.user, group),
    })

    if event:
        if event.id:
            base_qs = group.event_set.exclude(id=event.id)
            try:
                next_event = base_qs.filter(datetime__gte=event.datetime).order_by('datetime')[0:1].get()
            except Event.DoesNotExist:
                next_event = None

            try:
                prev_event = base_qs.filter(datetime__lte=event.datetime).order_by('-datetime')[0:1].get()
            except Event.DoesNotExist:
                prev_event = None
        else:
            next_event = None
            prev_event = None

        if not is_public:
            extra_data = event.data.get('extra', {})
            if not isinstance(extra_data, dict):
                extra_data = {}

            context.update({
                'tags': event.get_tags(),
                'json_data': extra_data,
            })

        context.update({
            'event': event,
            'version_data': event.data.get('modules', None),
            'next_event': next_event,
            'prev_event': prev_event,
        })

    return render_to_response(template, context, request)


@login_required
def redirect_to_group(request, project_id, group_id):
    group = get_object_or_404(Group, id=group_id)

    return HttpResponseRedirect(reverse('sentry-group', kwargs={
        'project_id': group.project.slug,
        'team_slug': group.team.slug,
        'group_id': group.id,
    }))


@login_required
@has_access
def dashboard(request, team):
    project_list = list(Project.objects.filter(team=team))

    if not project_list and can_create_projects(request.user, team=team):
        return HttpResponseRedirect(reverse('sentry-new-project', args=[team.slug]))

    for project in project_list:
        project.team = team

    return render_to_response('sentry/dashboard.html', {
        'team': team,
        'project_list': project_list,
    }, request)


@login_required
@has_access
def wall_display(request, team):
    project_list = list(Project.objects.filter(team=team))

    for project in project_list:
        project.team = team

    return render_to_response('sentry/wall.html', {
        'team': team,
        'project_list': project_list,
    }, request)


@login_required
@has_access
def search(request, team, project):
    query = request.GET.get('q', '').strip()

    if not query:
        return HttpResponseRedirect(reverse('sentry-stream', args=[team.slug, project.slug]))

    sort = request.GET.get('sort')
    if sort not in SEARCH_SORT_OPTIONS:
        sort = SEARCH_DEFAULT_SORT_OPTION
    sort_label = SEARCH_SORT_OPTIONS[sort]

    result = event_re.match(query)
    if result:
        # Forward to aggregate if it exists
        # event_id = result.group(1)
        checksum = result.group(2)
        try:
            group = Group.objects.filter(project=project, checksum=checksum)[0]
        except IndexError:
            return render_to_response('sentry/invalid_message_id.html', {
                'team': team,
                'project': project,
            }, request)
        else:
            return HttpResponseRedirect(reverse('sentry-group', kwargs={
                'project_id': group.project.slug,
                'team_slug': group.team.slug,
                'group_id': group.id,
            }))
    elif uuid_re.match(query):
        # Forward to event if it exists
        try:
            group_id = EventMapping.objects.get(
                project=project, event_id=query
            ).group_id
        except EventMapping.DoesNotExist:
            try:
                event = Event.objects.get(project=project, event_id=query)
            except Event.DoesNotExist:
                return render_to_response('sentry/invalid_message_id.html', {
                    'team': team,
                    'project': project,
                }, request)
            else:
                return HttpResponseRedirect(reverse('sentry-group-event', kwargs={
                    'project_id': project.slug,
                    'team_slug': team.slug,
                    'group_id': event.group.id,
                    'event_id': event.id,
                }))
        else:
            return HttpResponseRedirect(reverse('sentry-group', kwargs={
                'project_id': project.slug,
                'team_slug': team.slug,
                'group_id': group_id,
            }))
    elif not settings.SENTRY_USE_SEARCH:
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
        'team': project.team,
        'project': project,
        'event_list': event_list,
        'query': query,
        'sort': sort,
        'sort_label': sort_label,
    }, request)


@login_required
@has_access
def group_list(request, team, project):
    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    response = _get_group_list(
        request=request,
        project=project,
    )

    # XXX: this is duplicate in _get_group_list
    sort_label = SORT_OPTIONS[response['sort']]

    has_realtime = page == 1

    return render_to_response('sentry/groups/group_list.html', {
        'team': project.team,
        'project': project,
        'from_date': response['date_from'],
        'to_date': response['date_to'],
        'date_type': response['date_type'],
        'has_realtime': has_realtime,
        'event_list': response['event_list'],
        'today': response['today'],
        'sort': response['sort'],
        'sort_label': sort_label,
        'filters': response['filters'],
        'SORT_OPTIONS': SORT_OPTIONS,
        'HAS_TRENDING': has_trending(),
    }, request)


@has_group_access(allow_public=True)
def group(request, team, project, group, event_id=None):
    # It's possible that a message would not be created under certain
    # circumstances (such as a post_save signal failing)
    activity_qs = Activity.objects.order_by('-datetime').select_related('user')
    if event_id:
        event = get_object_or_404(group.event_set, id=event_id)
        activity_qs = activity_qs.filter(
            Q(event=event) | Q(event__isnull=True),
        )
    else:
        event = group.get_latest_event() or Event()

    # bind params to group in case they get hit
    event.group = group
    event.project = project

    if project in Project.objects.get_for_user(
            request.user, team=team, superuser=False):
        # update that the user has seen this group
        create_or_update(
            GroupSeen,
            group=group,
            user=request.user,
            project=project,
            defaults={
                'last_seen': timezone.now(),
            }
        )

    # filter out dupe activity items
    activity_items = set()
    activity = []
    for item in activity_qs.filter(group=group)[:10]:
        sig = (item.event_id, item.type, item.ident, item.user_id)
        if sig not in activity_items:
            activity_items.add(sig)
            activity.append(item)

    # trim to latest 5
    activity = activity[:5]

    seen_by = sorted(filter(lambda ls: ls[0] != request.user and ls[0].email, [
        (gs.user, gs.last_seen)
        for gs in GroupSeen.objects.filter(
            group=group
        ).select_related('user')
    ]), key=lambda ls: ls[1], reverse=True)
    seen_by_extra = len(seen_by) - 5
    if seen_by_extra < 0:
        seen_by_extra = 0
    seen_by_faces = seen_by[:5]

    context = {
        'page': 'details',
        'activity': activity,
        'seen_by': seen_by,
        'seen_by_faces': seen_by_faces,
        'seen_by_extra': seen_by_extra,
    }

    is_public = group_is_public(group, request.user)

    if is_public:
        template = 'sentry/groups/public_details.html'
        context['PROJECT_LIST'] = [project]
    else:
        template = 'sentry/groups/details.html'

    return render_with_group_context(
        group, template, context, request,
        event=event, is_public=is_public)


@has_group_access
def group_tag_list(request, team, project, group):
    def percent(total, this):
        return int(this / total * 100)

    # O(N) db access
    tag_list = []
    for tag_key in TagKey.objects.filter(project=project, key__in=group.get_tags()):
        tag_list.append((tag_key, [
            (value, times_seen, percent(group.times_seen, times_seen))
            for (value, times_seen, first_seen, last_seen)
            in group.get_unique_tags(tag_key.key)[:5]
        ], group.get_unique_tags(tag_key.key).count()))

    return render_with_group_context(group, 'sentry/groups/tag_list.html', {
        'page': 'tag_list',
        'tag_list': tag_list,
    }, request)


@has_group_access
def group_tag_details(request, team, project, group, tag_name):
    return render_with_group_context(group, 'sentry/plugins/bases/tag/index.html', {
        'title': tag_name.replace('_', ' ').title(),
        'tag_name': tag_name,
        'unique_tags': group.get_unique_tags(tag_name),
        'page': 'tag_details',
    }, request)


@has_group_access
def group_event_list(request, team, project, group):
    event_list = group.event_set.all().order_by('-datetime')

    return render_with_group_context(group, 'sentry/groups/event_list.html', {
        'event_list': event_list,
        'page': 'event_list',
    }, request)


@has_access(MEMBER_USER)
def group_event_list_json(request, team, project, group_id):
    group = get_object_or_404(Group, id=group_id, project=project)

    limit = request.GET.get('limit', MAX_JSON_RESULTS)
    try:
        limit = int(limit)
    except ValueError:
        return HttpResponse('non numeric limit', status=400, mimetype='text/plain')
    if limit > MAX_JSON_RESULTS:
        return HttpResponse("too many objects requested", mimetype='text/plain', status=400)

    events = group.event_set.order_by('-id')[:limit]

    return HttpResponse(json.dumps([event.as_dict() for event in events]), mimetype='application/json')


@has_access(MEMBER_USER)
def group_event_details_json(request, team, project, group_id, event_id_or_latest):
    group = get_object_or_404(Group, pk=group_id, project=project)

    if event_id_or_latest == 'latest':
        # It's possible that a message would not be created under certain
        # circumstances (such as a post_save signal failing)
        event = group.get_latest_event() or Event()
    else:
        event = get_object_or_404(group.event_set, pk=event_id_or_latest)

    return HttpResponse(json.dumps(event.as_dict()), mimetype='application/json')


@login_required
@has_access(MEMBER_USER)
def group_plugin_action(request, team, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id, project=project)

    try:
        plugin = plugins.get(slug)
    except KeyError:
        raise Http404('Plugin not found')

    response = plugin.get_view_response(request, group)
    if response:
        return response

    redirect = request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={
        'team_slug': team.slug,
        'project_id': group.project.slug
    })
    return HttpResponseRedirect(redirect)
