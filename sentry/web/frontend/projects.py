"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.conf import settings
from sentry.models import ProjectMember, MEMBER_USER, MEMBER_OWNER, \
  PendingProjectMember
from sentry.permissions import can_create_projects
from sentry.plugins import plugins
from sentry.web.decorators import login_required, has_access
from sentry.web.forms import EditProjectForm, NewProjectForm, \
  EditProjectMemberForm, NewProjectMemberForm, RemoveProjectForm, \
  NewProjectAdminForm, InviteProjectMemberForm
from sentry.web.helpers import render_to_response, get_project_list, \
  plugin_config


def _can_add_project_member(user, project):
    result = plugins.first('has_perm', user, 'add_project_member', project)
    if result is False and not user.has_perm('sentry.can_add_projectmember'):
        return False
    return True


def _can_remove_project(user, project):
    result = plugins.first('has_perm', user, 'remove_project', project)
    if result is False and not user.has_perm('sentry.can_remove_project'):
        return False
    return True


@login_required
def project_list(request):
    project_list = get_project_list(request.user, hidden=True)
    memberships = list(ProjectMember.objects.filter(user=request.user, project__in=project_list))

    for member in memberships:
        project_id = member.project_id
        project_list[project_id].member_dsn = member.get_dsn()
        project_list[project_id].member_type = member.get_type_display()

    return render_to_response('sentry/projects/list.html', {
        'PROJECT_LIST': project_list.values(),
    }, request)


@login_required
@csrf_protect
def new_project(request):
    if not can_create_projects(request.user):
        return HttpResponseRedirect(reverse('sentry'))

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
        if not project.owner:
            project.owner = request.user
        project.save()
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    context = csrf(request)
    context.update({
        'form': form,
    })

    return render_to_response('sentry/projects/new.html', context, request)


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, project):
    if str(project.id) == str(settings.PROJECT):
        return HttpResponseRedirect(reverse('sentry-project-list'))

    if not _can_remove_project(request.user, project):
        return HttpResponseRedirect(reverse('sentry'))

    project_list = filter(lambda x: x != project, get_project_list(request.user).itervalues())

    form = RemoveProjectForm(project_list, request.POST or None)

    if form.is_valid():
        removal_type = form.cleaned_data['removal_type']
        if removal_type == '1':
            project.delete()
        elif removal_type == '2':
            new_project = form.cleaned_data['project']
            project.merge_to(new_project)
        elif removal_type == '3':
            project.update(status=1)
        else:
            raise ValueError(removal_type)

        return HttpResponseRedirect(reverse('sentry-project-list'))

    context = csrf(request)
    context.update({
        'form': form,
        'project': project,
    })

    return render_to_response('sentry/projects/remove.html', context, request)


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def manage_project(request, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    form = EditProjectForm(request, request.POST or None, instance=project)

    if form.is_valid():
        project = form.save()

        return HttpResponseRedirect(request.path + '?success=1')

    member_list = [(pm, pm.user) for pm in project.member_set.select_related('user')]
    pending_member_list = [(pm, pm.email) for pm in project.pending_member_set.all()]

    context = csrf(request)
    context.update({
        'can_add_member': _can_add_project_member(request.user, project),
        'can_remove_project': _can_remove_project(request.user, project),
        'page': 'details',
        'form': form,
        'project': project,
        'member_list': member_list,
        'pending_member_list': pending_member_list,
    })

    return render_to_response('sentry/projects/manage.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def new_project_member(request, project):
    can_add_member = _can_add_project_member(request.user, project)
    if not can_add_member:
        return HttpResponseRedirect(reverse('sentry'))

    initial = {
        'type': MEMBER_USER,
    }

    invite_form = InviteProjectMemberForm(project, request.POST or None, initial=initial, prefix='invite')
    add_form = NewProjectMemberForm(project, request.POST or None, initial=initial, prefix='add')

    if add_form.is_valid():
        pm = add_form.save(commit=False)
        pm.project = project
        pm.save()

        return HttpResponseRedirect(reverse('sentry-edit-project-member', args=[project.pk, pm.id]) + '?success=1')

    elif invite_form.is_valid():
        pm = invite_form.save(commit=False)
        pm.project = project
        pm.save()

        pm.send_invite_email()

        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]) + '?success=1')

    context = csrf(request)
    context.update({
        'project': project,
        'add_form': add_form,
        'invite_form': invite_form,
    })

    return render_to_response('sentry/projects/members/new.html', context, request)


def accept_invite(request, member_id, token):
    try:
        pending_member = PendingProjectMember.objects.get(pk=member_id)
    except PendingProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry'))

    if pending_member.token != token:
        return HttpResponseRedirect(reverse('sentry'))

    project = pending_member.project

    if not request.user.is_authenticated():
        # Show login or register form
        context = {
            'project': project,
        }
        return render_to_response('sentry/projects/members/accept_invite.html', context, request)

    if project.member_set.filter(
            user=request.user,
            type=pending_member.type,
        ):
        project.member_set.create(
            user=request.user,
            type=pending_member.type,
        )

    pending_member.delete()

    return HttpResponseRedirect(reverse('sentry', args=[project.pk]))


@csrf_protect
@has_access(MEMBER_OWNER)
def edit_project_member(request, project, member_id):
    try:
        member = project.member_set.get(pk=member_id)
    except ProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'edit_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_change_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    form = EditProjectMemberForm(project, request.POST or None, instance=member)
    if form.is_valid():
        member = form.save(commit=True)

        return HttpResponseRedirect(request.path + '?success=1')

    context = csrf(request)
    context.update({
        'member': member,
        'project': project,
        'form': form,
        'dsn': member.get_dsn(),
    })

    return render_to_response('sentry/projects/members/edit.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_project_member(request, project, member_id):
    try:
        member = project.member_set.get(pk=member_id)
    except ProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    if member.user == project.owner:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'remove_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_remove_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    if request.POST:
        member.delete()

        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    context = csrf(request)
    context.update({
        'member': member,
        'project': project,
    })

    return render_to_response('sentry/projects/members/remove.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def suspend_project_member(request, project, member_id):
    try:
        member = project.member_set.get(pk=member_id)
    except ProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    if member.user == project.owner:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'suspend_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_change_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    member.update(is_active=False)

    return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]) + '?success=1')


@csrf_protect
@has_access(MEMBER_OWNER)
def restore_project_member(request, project, member_id):
    try:
        member = project.member_set.get(pk=member_id)
    except ProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    if member.user == project.owner:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'restore_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_change_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    member.update(is_active=True)

    return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]) + '?success=1')


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_pending_project_member(request, project, member_id):
    try:
        member = project.pending_member_set.get(pk=member_id)
    except PendingProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'remove_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_remove_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    member.delete()

    return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]) + '?success=1')


@csrf_protect
@has_access(MEMBER_OWNER)
def reinvite_pending_project_member(request, project, member_id):
    try:
        member = project.pending_member_set.get(pk=member_id)
    except PendingProjectMember.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'add_project_member', member)
    if result is False and not request.user.has_perm('sentry.can_add_projectmember'):
        return HttpResponseRedirect(reverse('sentry'))

    member.send_invite_email()

    return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]) + '?success=1')


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def configure_project_plugin(request, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    if not plugin.is_enabled(project):
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    form = plugin.project_conf_form
    if form is None:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    action, view = plugin_config(plugin, project, request)
    if action == 'redirect':
        return HttpResponseRedirect(request.path + '?success=1')

    context = csrf(request)
    context.update({
        'page': 'plugin',
        'title': plugin.get_title(),
        'view': view,
        'project': project,
        'plugin': plugin,
    })

    return render_to_response('sentry/projects/plugins/configure.html', context, request)


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def manage_plugins(request, project):
    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    if request.POST:
        enabled = set(request.POST.getlist('plugin'))
        for plugin in plugins.all():
            if plugin.can_enable_for_projects():
                plugin.set_option('enabled', plugin.slug in enabled, project)
        return HttpResponseRedirect(request.path + '?success=1')

    context = csrf(request)
    context.update({
        'page': 'plugins',
        'project': project,
    })

    return render_to_response('sentry/projects/plugins/list.html', context, request)
