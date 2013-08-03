"""
sentry.web.frontend.teams
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext as _

from sentry.constants import MEMBER_USER, MEMBER_OWNER
from sentry.models import PendingTeamMember, TeamMember, AccessGroup, User
from sentry.permissions import (can_add_team_member, can_remove_team, can_create_projects,
    can_create_teams, can_edit_team_member, can_remove_team_member,
    Permissions)
from sentry.plugins import plugins
from sentry.utils.samples import create_sample_event
from sentry.web.decorators import login_required, has_access
from sentry.web.forms.teams import (NewTeamForm, NewTeamAdminForm,
    EditTeamForm, EditTeamAdminForm, EditTeamMemberForm, NewTeamMemberForm,
    InviteTeamMemberForm, RemoveTeamForm, AcceptInviteForm, NewAccessGroupForm,
    EditAccessGroupForm, NewAccessGroupMemberForm, NewAccessGroupProjectForm,
    RemoveAccessGroupForm)
from sentry.web.helpers import render_to_response
from sentry.web.frontend.generic import missing_perm


def render_with_team_context(team, template, context, request=None):
    context.update({
        'team': team,
        'SECTION': 'team',
    })

    return render_to_response(template, context, request)


@login_required
@csrf_protect
def create_new_team(request):
    if not can_create_teams(request.user):
        return missing_perm(request, Permissions.ADD_TEAM)

    if request.user.has_perm('sentry.can_add_team'):
        form_cls = NewTeamAdminForm
        initial = {
            'owner': request.user.username,
        }
    else:
        form_cls = NewTeamForm
        initial = {}

    form = form_cls(request.POST or None, initial=initial)
    if form.is_valid():
        team = form.save(commit=False)
        if not team.owner_id:
            team.owner = request.user
        team.save()
        return HttpResponseRedirect(reverse('sentry-new-project', args=[team.slug]))

    context = csrf(request)
    context.update({
        'form': form,
    })

    return render_to_response('sentry/teams/new.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_team(request, team):
    result = plugins.first('has_perm', request.user, 'edit_team', team)
    if result is False and not request.user.has_perm('sentry.can_change_team'):
        return HttpResponseRedirect(reverse('sentry'))

    can_admin_team = request.user == team.owner or request.user.has_perm('sentry.can_add_team')

    if can_admin_team:
        form_cls = EditTeamAdminForm
    else:
        form_cls = EditTeamForm

    form = form_cls(request.POST or None, initial={
        'owner': team.owner,
    }, instance=team)

    # XXX: form.is_valid() changes the foreignkey
    original_owner = team.owner
    if form.is_valid():

        team = form.save()
        if team.owner != original_owner:
            # Update access for new membership if it's changed
            # (e.g. member used to be USER, but is now OWNER)
            team.member_set.filter(user=team.owner).update(type=MEMBER_OWNER)

        messages.add_message(request, messages.SUCCESS,
            _('Changes to your team were saved.'))

        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    context = csrf(request)
    context.update({
        'can_remove_team': can_remove_team(request.user, team),
        'page': 'details',
        'form': form,
        'SUBSECTION': 'settings',
    })

    return render_with_team_context(team, 'sentry/teams/manage.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_team(request, team):
    if not can_remove_team(request.user, team):
        return HttpResponseRedirect(reverse('sentry'))

    if request.method == 'POST':
        form = RemoveTeamForm(request.POST)
    else:
        form = RemoveTeamForm()

    if form.is_valid():
        team.delete()
        messages.add_message(
            request, messages.SUCCESS,
            _(u'The team %r was permanently deleted.') % (team.name.encode('utf-8'),))
        return HttpResponseRedirect(reverse('sentry'))

    context = csrf(request)
    context.update({
        'page': 'settings',
        'form': form,
        'SUBSECTION': 'settings',
    })

    return render_with_team_context(team, 'sentry/teams/remove.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_team_projects(request, team):
    result = plugins.first('has_perm', request.user, 'edit_team', team)
    if result is False and not request.user.has_perm('sentry.can_change_team'):
        return HttpResponseRedirect(reverse('sentry'))

    project_list = list(team.project_set.all())
    project_list.sort(key=lambda o: o.slug)
    for project in project_list:
        project.team = team

    context = csrf(request)
    context.update({
        'page': 'projects',
        'team': team,
        'project_list': project_list,
        'SUBSECTION': 'projects',
    })

    return render_with_team_context(team, 'sentry/teams/projects/index.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_team_members(request, team):
    result = plugins.first('has_perm', request.user, 'edit_team', team)
    if result is False and not request.user.has_perm('sentry.can_change_team'):
        return HttpResponseRedirect(reverse('sentry'))

    member_list = [(pm, pm.user) for pm in team.member_set.select_related('user').order_by('user__username')]
    pending_member_list = [(pm, pm.email) for pm in team.pending_member_set.all().order_by('email')]

    context = csrf(request)
    context.update({
        'page': 'members',
        'member_list': member_list,
        'pending_member_list': pending_member_list,
        'SUBSECTION': 'members',
    })

    return render_with_team_context(team, 'sentry/teams/members/index.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def new_team_member(request, team):
    if not can_add_team_member(request.user, team):
        return HttpResponseRedirect(reverse('sentry'))

    initial = {
        'type': MEMBER_USER,
    }

    invite_form = InviteTeamMemberForm(team, request.POST or None, initial=initial, prefix='invite')
    add_form = NewTeamMemberForm(team, request.POST or None, initial=initial, prefix='add')

    if add_form.is_valid():
        pm = add_form.save(commit=False)
        pm.team = team
        pm.save()

        messages.add_message(request, messages.SUCCESS,
            _('The team member was added.'))

        return HttpResponseRedirect(reverse('sentry-manage-team-members', args=[team.slug]))

    elif invite_form.is_valid():
        pm = invite_form.save(commit=False)
        pm.team = team
        pm.save()

        pm.send_invite_email()

        messages.add_message(request, messages.SUCCESS,
            _('An invitation email was sent to %s.') % (pm.email,))

        return HttpResponseRedirect(reverse('sentry-manage-team-members', args=[team.slug]))

    context = csrf(request)
    context.update({
        'page': 'members',
        'add_form': add_form,
        'invite_form': invite_form,
        'SUBSECTION': 'members',
    })

    return render_with_team_context(team, 'sentry/teams/members/new.html', context, request)


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
def edit_team_member(request, team, member_id):
    try:
        member = team.member_set.get(pk=member_id)
    except TeamMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

    if not can_edit_team_member(request.user, member):
        return HttpResponseRedirect(reverse('sentry'))

    form = EditTeamMemberForm(team, request.POST or None, instance=member)
    if form.is_valid():
        member = form.save(commit=True)

        messages.add_message(request, messages.SUCCESS,
            _('Changes to your team member were saved.'))

        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'page': 'members',
        'member': member,
        'form': form,
        'SUBSECTION': 'members',
    })

    return render_with_team_context(team, 'sentry/teams/members/edit.html', context, request)


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
    if result is False and not request.user.has_perm('sentry.can_remove_teammember'):
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
    if result is False and not request.user.has_perm('sentry.can_add_teammember'):
        return HttpResponseRedirect(reverse('sentry'))

    member.send_invite_email()

    messages.add_message(request, messages.SUCCESS,
        _('An email was sent to the pending team member.'))

    return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))


@csrf_protect
@has_access(MEMBER_OWNER)
def create_new_team_project(request, team):
    from sentry.web.forms.projects import NewProjectAdminForm, NewProjectForm

    if not can_create_projects(request.user, team):
        return missing_perm(request, Permissions.ADD_PROJECT, team=team)

    if request.user.has_perm('sentry.can_add_project'):
        form_cls = NewProjectAdminForm
        initial = {
            'owner': request.user.username,
        }
    else:
        form_cls = NewProjectForm
        initial = {}

    form = form_cls(request.POST or None, initial=initial)
    if form.is_valid():
        project = form.save(commit=False)
        project.team = team
        if not project.owner:
            project.owner = request.user
        project.save()

        create_sample_event(project)

        if project.platform not in (None, 'other'):
            return HttpResponseRedirect(reverse('sentry-docs-client', args=[project.team.slug, project.slug, project.platform]))
        return HttpResponseRedirect(reverse('sentry-get-started', args=[project.team.slug, project.slug]))

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'projects',
        'SUBSECTION': 'new_project',
    })

    return render_with_team_context(team, 'sentry/teams/projects/new.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_access_groups(request, team):
    context = csrf(request)
    context.update({
        'can_add_group': True,
        'group_list': AccessGroup.objects.filter(team=team),
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/list.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def new_access_group(request, team):
    initial = {
        'type': MEMBER_USER,
    }

    form = NewAccessGroupForm(request.POST or None, initial=initial)
    if form.is_valid():
        inst = form.save(commit=False)
        inst.team = team
        inst.managed = False
        inst.save()
        return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

    context = csrf(request)
    context.update({
        'form': form,
        'SUBSECTION': 'groups',
    })

    return render_with_team_context(team, 'sentry/teams/groups/new.html', context, request)


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
