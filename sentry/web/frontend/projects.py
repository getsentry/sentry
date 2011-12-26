from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponseForbidden
from django.views.decorators.csrf import csrf_protect

from sentry.models import PERMISSIONS_DICT
from sentry.web.decorators import login_required, can_manage, \
     permission_required
from sentry.web.forms import EditProjectForm, NewProjectForm, \
     EditProjectMemberForm, NewProjectMemberForm
from sentry.web.helpers import render_to_response


@login_required
def project_list(request):
    return render_to_response('sentry/projects/list.html', {
        'can_create_projects': request.user.has_perm('sentry.add_project'),
    }, request)


@permission_required('sentry.add_project')
@csrf_protect
def new_project(request):
    form = NewProjectForm(request.POST or None)
    if form.is_valid():
        project = form.save(commit=False)
        project.owner = request.user
        project.save()

        project.member_set.create(
            user=project.owner,
            is_superuser=True,
        )
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    context = csrf(request)
    context.update({
        'form': form,
    })

    return render_to_response('sentry/projects/new.html', context, request)


@login_required
@can_manage
@csrf_protect
def manage_project(request, project):
    form = EditProjectForm(request.POST or None, instance=project)

    if form.is_valid():
        project = form.save()

        return HttpResponseRedirect(request.path + '?success=1')

    member_list = [
        (pm, pm.user, [(k, PERMISSIONS_DICT[k]) for k, v in pm.permissions if v])
        for pm in project.member_set.select_related('user')
    ]

    context = csrf(request)
    context.update({
        'form': form,
        'project': project,
        'member_list': member_list
    })

    return render_to_response('sentry/projects/manage.html', context, request)


@csrf_protect
@can_manage('add_member')
def new_project_member(request, project):
    form = NewProjectMemberForm(project, request.POST or None)
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
@can_manage('change_member')
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
@can_manage('delete_member')
def remove_project_member(request, project, member_id):
    member = project.member_set.get(pk=member_id)
    if member.user == project.owner:
        return HttpResponseForbidden()

    if request.POST:
        member.delete()

        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.pk]))

    context = csrf(request)
    context.update({
        'member': member,
        'project': project,
    })

    return render_to_response('sentry/projects/members/remove.html', context, request)
