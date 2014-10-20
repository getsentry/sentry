"""
sentry.web.frontend.teams
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext as _

from sentry.constants import MEMBER_OWNER
from sentry.models import PendingTeamMember, TeamMember, AccessGroup, User
from sentry.permissions import can_remove_team_member
from sentry.plugins import plugins
from sentry.web.decorators import has_access
from sentry.web.forms.teams import (
    AcceptInviteForm, EditAccessGroupForm, NewAccessGroupMemberForm,
    NewAccessGroupProjectForm, RemoveAccessGroupForm
)
from sentry.web.helpers import render_to_response


def render_with_team_context(team, template, context, request=None):
    context.update({
        'team': team,
        'SECTION': 'team',
    })

    return render_to_response(template, context, request)


@csrf_protect
def accept_invite(request, member_id, token):
    try:
        pending_member = PendingTeamMember.objects.get(pk=member_id)
    except PendingTeamMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry'))

    if pending_member.token != token:
        return HttpResponseRedirect(reverse('sentry'))

    team = pending_member.team

    project_list = list(team.project_set.filter(status=0))
    for project in project_list:
        project.team = team

    context = {
        'team': team,
        'team_owner': team.get_owner_name(),
        'project_list': project_list,
    }

    if not request.user.is_authenticated():
        # Show login or register form
        request.session['_next'] = request.get_full_path()
        request.session['can_register'] = True

        return render_to_response('sentry/teams/members/accept_invite_unauthenticated.html', context, request)

    if request.method == 'POST':
        form = AcceptInviteForm(request.POST)
    else:
        form = AcceptInviteForm()

    if form.is_valid():
        team.member_set.get_or_create(
            user=request.user,
            defaults={
                'type': pending_member.type,
            }
        )

        request.session.pop('can_register', None)

        pending_member.delete()

        messages.add_message(request, messages.SUCCESS,
            _('You have been added to the %r team.') % (team.name.encode('utf-8'),))

        return HttpResponseRedirect(reverse('sentry', args=[team.slug]))

    context['form'] = form

    return render_to_response('sentry/teams/members/accept_invite.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_team_member(request, team, member_id):
    try:
        member = team.member_set.get(pk=member_id)
    except TeamMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    if member.user == team.owner:
        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    if not can_remove_team_member(request.user, member):
        return HttpResponseRedirect(reverse('sentry'))

    if request.POST:
        member.delete()

        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    context = csrf(request)
    context.update({
        'page': 'members',
        'member': member,
        'SUBSECTION': 'members',
    })

    return render_with_team_context(team, 'sentry/teams/members/remove.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_pending_team_member(request, team, member_id):
    try:
        member = team.pending_member_set.get(pk=member_id)
    except PendingTeamMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    result = plugins.first('has_perm', request.user, 'remove_team_member', member)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    member.delete()

    messages.add_message(request, messages.SUCCESS,
        _('The team member was removed.'))

    return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))


@csrf_protect
@has_access(MEMBER_OWNER)
def reinvite_pending_team_member(request, team, member_id):
    try:
        member = team.pending_member_set.get(pk=member_id)
    except PendingTeamMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    result = plugins.first('has_perm', request.user, 'add_team_member', member)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    member.send_invite_email()

    messages.add_message(request, messages.SUCCESS,
        _('An email was sent to the pending team member.'))

    return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))


@has_access(MEMBER_OWNER)
@csrf_protect
def access_group_details(request, team, group_id):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    form = EditAccessGroupForm(request.POST or None, instance=group)
    if form.is_valid():
        form.save()

    context = csrf(request)
    context.update({
        'group': group,
        'form': form,
        'group_list': AccessGroup.objects.filter(team=team),
        'page': 'details',
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/details.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_access_group(request, team, group_id):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    if request.method == 'POST':
        form = RemoveAccessGroupForm(request.POST)
    else:
        form = RemoveAccessGroupForm()

    if form.is_valid():
        group.delete()

        messages.add_message(request, messages.SUCCESS,
            _('%s was permanently removed.') % (group.name,))

        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    context = csrf(request)
    context.update({
        'form': form,
        'group': group,
        'page': 'details',
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/remove.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def access_group_members(request, team, group_id):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    form = NewAccessGroupMemberForm(request.POST or None)
    if form.is_valid():
        user = form.cleaned_data['user']
        group.members.add(user)

        messages.add_message(request, messages.SUCCESS,
            _('%s was added to this access group.') % (user.email,))

        return HttpResponseRedirect(reverse('sentry-access-group-members', args=[team.slug, group.id]))

    context = csrf(request)
    context.update({
        'group': group,
        'form': form,
        'member_list': group.members.all(),
        'group_list': AccessGroup.objects.filter(team=team),
        'page': 'members',
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/members.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_access_group_member(request, team, group_id, user_id):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-access-group-members', args=[team.slug, group.id]))

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-access-group-members', args=[team.slug, group.id]))

    group.members.remove(user)

    return HttpResponseRedirect(reverse('sentry-access-group-members', args=[team.slug, group.id]))


@has_access(MEMBER_OWNER)
@csrf_protect
def access_group_projects(request, team, group_id):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    form = NewAccessGroupProjectForm(group, request.POST or None)
    if form.is_valid():
        project = form.cleaned_data['project']
        group.projects.add(project)

        messages.add_message(request, messages.SUCCESS,
            _('%s was added to this access group.') % (project.name,))

        return HttpResponseRedirect(reverse('sentry-access-group-projects', args=[team.slug, group.id]))

    group_list = list(AccessGroup.objects.filter(team=team))
    for g_ in group_list:
        g_.team = team

    context = csrf(request)
    context.update({
        'group': group,
        'form': form,
        'project_list': group.projects.all(),
        'group_list': group_list,
        'page': 'projects',
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/projects.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
# XXX: has_access is automatically converting project for us
def remove_access_group_project(request, team, group_id, project):
    try:
        group = AccessGroup.objects.get(team=team, id=group_id)
    except AccessGroup.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-access-group-projects', args=[team.slug, group.id]))

    group.projects.remove(project)

    return HttpResponseRedirect(reverse('sentry-access-group-projects', args=[team.slug, group.id]))
