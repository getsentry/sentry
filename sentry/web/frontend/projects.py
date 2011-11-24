from django.core.context_processors import csrf

from sentry.web.decorators import login_required, can_manage
from sentry.web.forms import EditProjectForm
from sentry.web.helpers import render_to_response, get_project_list

@login_required
def project_list(request):
    return render_to_response('sentry/projects/list.html', {
        'project_list': get_project_list(request.user).values(),
        'request': request,
    })

@login_required
@can_manage
def manage_project(request, project):
    form = EditProjectForm(request.POST or None, instance=project)
    if form.is_valid():
        project = form.save()

    context = csrf(request)
    context.update({
        'form': form,
        'project': project,
        'project_list': get_project_list(request.user).values(),
        'request': request,
    })

    return render_to_response('sentry/projects/manage.html', context)