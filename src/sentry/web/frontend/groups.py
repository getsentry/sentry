"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains views for the "Events" section of Sentry.

TODO: Move all events.py views into here, and rename this file to events.

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, division

from django.core.urlresolvers import reverse
from django.http import (
    Http404, HttpResponse, HttpResponsePermanentRedirect, HttpResponseRedirect
)
from django.shortcuts import get_object_or_404
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.constants import MEMBER_USER
from sentry.db.models import create_or_update
from sentry.models import (
    Project, Group, GroupMeta, Event, Activity, TagKey, GroupSeen
)
from sentry.permissions import (
    can_admin_group, can_remove_group, can_create_projects
)
from sentry.plugins import plugins
from sentry.utils import json
from sentry.web.decorators import has_access, has_group_access, login_required
from sentry.web.forms import NewNoteForm
from sentry.web.helpers import render_to_response, group_is_public


def render_with_group_context(group, template, context, request=None,
                              event=None, is_public=False):
    context.update({
        'team': group.project.team,
        'organization': group.project.organization,
        'project': group.project,
        'group': group,
        'selectedGroup': serialize(group, request.user),
        'can_admin_event': can_admin_group(request.user, group),
        'can_remove_event': can_remove_group(request.user, group),
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
        'organization_slug': group.project.organization.slug,
        'group_id': group.id,
    }))


@login_required
@has_access
def dashboard(request, organization, team):
    project_list = list(Project.objects.filter(team=team))

    if not project_list and can_create_projects(request.user, team=team):
        url = reverse('sentry-create-project', args=[team.organization.slug])
        return HttpResponseRedirect(url + '?team=' + team.slug)

    for project in project_list:
        project.team = team

    return render_to_response('sentry/dashboard.html', {
        'organization': team.organization,
        'team': team,
        'project_list': project_list,
    }, request)


@login_required
@has_access
def wall_display(request, organization, team):
    project_list = list(Project.objects.filter(team=team))

    for project in project_list:
        project.team = team

    return render_to_response('sentry/wall.html', {
        'team': team,
        'organization': team.organization,
        'project_list': project_list,
    }, request)


def group(request, organization_slug, project_id, group_id, event_id=None):
    # TODO(dcramer): remove in 7.1 release
    # Handle redirects from team_slug/project_slug to org_slug/project_slug
    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        raise Http404

    if group.project.slug != project_id:
        raise Http404

    if group.organization.slug == organization_slug:
        return group_details(
            request=request,
            organization_slug=organization_slug,
            project_id=project_id,
            group_id=group_id,
            event_id=event_id,
        )

    if group.team.slug == organization_slug:
        if event_id:
            url = reverse(
                'sentry-group-event',
                args=[group.organization.slug, project_id, group_id, event_id],
            )
        else:
            url = reverse(
                'sentry-group',
                args=[group.organization.slug, project_id, group_id],
            )
        return HttpResponsePermanentRedirect(url)

    raise Http404


@has_group_access(allow_public=True)
def group_details(request, organization, project, group, event_id=None):
    # It's possible that a message would not be created under certain
    # circumstances (such as a post_save signal failing)
    if event_id:
        event = get_object_or_404(group.event_set, id=event_id)
    else:
        event = group.get_latest_event() or Event()

    Event.objects.bind_nodes([event], 'data')
    GroupMeta.objects.populate_cache([group])

    # bind params to group in case they get hit
    event.group = group
    event.project = project

    if request.POST.get('o') == 'note' and request.user.is_authenticated():
        add_note_form = NewNoteForm(request.POST)
        if add_note_form.is_valid():
            add_note_form.save(event, request.user)
            return HttpResponseRedirect(request.path)
    else:
        add_note_form = NewNoteForm()

    if request.user.is_authenticated() and project.has_access(request.user):
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

    activity_qs = Activity.objects.filter(
        group=group,
    ).order_by('-datetime').select_related('user')

    # filter out dupe activity items
    activity_items = set()
    activity = []
    for item in activity_qs[:20]:
        sig = (item.event_id, item.type, item.ident, item.user_id)
        # TODO: we could just generate a signature (hash(text)) for notes
        # so there's no special casing
        if item.type == Activity.NOTE:
            activity.append(item)
        elif sig not in activity_items:
            activity_items.add(sig)
            activity.append(item)

    activity.append(Activity(
        project=project, group=group, type=Activity.FIRST_SEEN,
        datetime=group.first_seen))

    # trim to latest 5
    activity = activity[:7]

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
        'add_note_form': add_note_form,
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
def group_tag_list(request, organization, project, group):
    def percent(total, this):
        return int(this / total * 100)

    GroupMeta.objects.populate_cache([group])

    queryset = TagKey.objects.filter(
        project=project,
        key__in=[t['key'] for t in group.get_tags()],
    )

    # O(N) db access
    tag_list = []
    for tag_key in queryset:
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
def group_tag_details(request, organization, project, group, tag_name):
    GroupMeta.objects.populate_cache([group])

    sort = request.GET.get('sort')
    if sort == 'date':
        order_by = '-last_seen'
    elif sort == 'new':
        order_by = '-first_seen'
    else:
        order_by = '-times_seen'

    return render_with_group_context(group, 'sentry/plugins/bases/tag/index.html', {
        'title': tag_name.replace('_', ' ').title(),
        'tag_name': tag_name,
        'unique_tags': group.get_unique_tags(tag_name, order_by=order_by),
        'page': 'tag_details',
    }, request)


@has_group_access
def group_event_list(request, organization, project, group):
    # TODO: we need the event data to bind after we limit
    event_list = group.event_set.all().order_by('-datetime')[:100]

    for event in event_list:
        event.project = project
        event.group = group

    GroupMeta.objects.populate_cache([group])
    Event.objects.bind_nodes(event_list, 'data')

    return render_with_group_context(group, 'sentry/groups/event_list.html', {
        'event_list': event_list,
        'page': 'event_list',
    }, request)


@has_access(MEMBER_USER)
def group_event_details_json(request, organization, project, group_id, event_id_or_latest):
    group = get_object_or_404(Group, pk=group_id, project=project)

    if event_id_or_latest == 'latest':
        # It's possible that a message would not be created under certain
        # circumstances (such as a post_save signal failing)
        event = group.get_latest_event() or Event(group=group)
    else:
        event = get_object_or_404(group.event_set, pk=event_id_or_latest)

    Event.objects.bind_nodes([event], 'data')
    GroupMeta.objects.populate_cache([group])

    return HttpResponse(json.dumps(event.as_dict()), mimetype='application/json')


@login_required
@has_access(MEMBER_USER)
def group_plugin_action(request, organization, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id, project=project)

    try:
        plugin = plugins.get(slug)
    except KeyError:
        raise Http404('Plugin not found')

    GroupMeta.objects.populate_cache([group])

    response = plugin.get_view_response(request, group)
    if response:
        return response

    redirect = request.META.get('HTTP_REFERER') or reverse('sentry-stream', kwargs={
        'organization_slug': organization.slug,
        'project_id': group.project.slug
    })
    return HttpResponseRedirect(redirect)
