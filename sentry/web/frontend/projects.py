from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.conf import settings
from sentry.models import MEMBER_USER, MEMBER_OWNER
from sentry.web.decorators import login_required, has_access
from sentry.web.forms import EditProjectForm, NewProjectForm, \
  EditProjectMemberForm, NewProjectMemberForm, RemoveProjectForm
from sentry.web.helpers import render_to_response, get_project_list, \
  plugin_config


@login_required
def project_list(request):
    return render_to_response('sentry/projects/list.html', {
        'project_list': get_project_list(request.user, hidden=True).values(),
    }, request)


@login_required
@csrf_protect
def new_project(request):
    if not (settings.ALLOW_PROJECT_CREATION or request.user.has_perm('sentry.add_project')):
        return HttpResponseRedirect(reverse('sentry'))

    form = NewProjectForm(request.POST or None)
    if form.is_valid():
        project = form.save(commit=False)
        project.owner = request.user
        project.save()

        project.member_set.create(
            user=project.owner,
            type=MEMBER_OWNER,
        )
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
    form = EditProjectForm(request.POST or None, instance=project)

    if form.is_valid():
        project = form.save()

        return HttpResponseRedirect(request.path + '?success=1')

    member_list = [(pm, pm.user) for pm in project.member_set.select_related('user')]

    context = csrf(request)
    context.update({
        'page': 'details',
        'form': form,
        'project': project,
        'member_list': member_list
    })

    return render_to_response('sentry/projects/manage.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def new_project_member(request, project):
    form = NewProjectMemberForm(project, request.POST or None, initial={
        'type': MEMBER_USER,
    })
    if form.is_valid():
        pm = form.save(commit=False)
        pm.project = project
        pm.save()

        return HttpResponseRedirect(reverse('sentry-edit-project-member', args=[project.pk, pm.id]))

    context = csrf(request)
    context.update({
        'project': project,
        'form': form,
    })

    return render_to_response('sentry/projects/members/new.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def edit_project_member(request, project, member_id):
    member = project.member_set.get(pk=member_id)

    form = EditProjectMemberForm(project, request.POST or None, instance=member)
    if form.is_valid():
        member = form.save(commit=True)

        return HttpResponseRedirect(request.path + '?success=1')

    context = csrf(request)
    context.update({
        'member': member,
        'project': project,
        'form': form,
    })

    return render_to_response('sentry/projects/members/edit.html', context, request)


@csrf_protect
@has_access(MEMBER_OWNER)
def remove_project_member(request, project, member_id):
    member = project.member_set.get(pk=member_id)
    if member.user == project.owner:
        return HttpResponseRedirect(reverse('sentry-project-list'))

    if request.POST:
        member.delete()

        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    context = csrf(request)
    context.update({
        'member': member,
        'project': project,
    })

    return render_to_response('sentry/projects/members/remove.html', context, request)


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def configure_project_plugin(request, project, slug):
    try:
        plugin = request.plugins[slug]
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

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
