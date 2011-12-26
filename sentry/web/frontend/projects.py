from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.forms.models import modelformset_factory
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.models import ProjectMember
from sentry.web.decorators import login_required, can_manage, \
     permission_required
from sentry.web.forms import EditProjectForm, NewProjectForm, \
     ProjectMemberForm
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
    ProjectMemberFormset = modelformset_factory(
        model=ProjectMember,
        form=ProjectMemberForm,
        extra=1,
        can_delete=True,
    )

    pm_formset_kwargs = dict(
        prefix='pm:',
        queryset=project.member_set.exclude(user=project.owner),
    )

    form = EditProjectForm(request.POST or None, instance=project, prefix='p:')
    pm_formset = ProjectMemberFormset(
        data=request.POST or None,
        **pm_formset_kwargs
    )

    if all([f.is_valid() for f in [form, pm_formset]]):
        if form.is_valid():
            project = form.save()

        if pm_formset.is_valid():
            for instance in pm_formset.save(commit=False):
                instance.project = project
                instance.save()

        return HttpResponseRedirect(request.path + '?success=1')

    context = csrf(request)
    context.update({
        'form': form,
        'pm_formset': pm_formset,
        'project': project,
    })

    return render_to_response('sentry/projects/manage.html', context, request)
