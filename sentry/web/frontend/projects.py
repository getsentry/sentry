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
from sentry.models import TeamMember, MEMBER_OWNER, \
  ProjectKey, Team
from sentry.permissions import can_create_projects, can_remove_project
from sentry.plugins import plugins
from sentry.web.decorators import login_required, has_access
from sentry.web.forms import EditProjectForm, RemoveProjectForm
from sentry.web.helpers import render_to_response, get_project_list, \
  plugin_config, get_team_list


@login_required
def project_list(request):
    project_list = get_project_list(request.user, hidden=True).values()
    team_list = dict((t.id, t) for t in Team.objects.filter(pk__in=[p.team_id for p in project_list]))
    memberships = dict((tm.team_id, tm) for tm in TeamMember.objects.filter(user=request.user, team__in=team_list))
    keys = dict((p.project_id, p) for p in ProjectKey.objects.filter(user=request.user, project__in=project_list))

    for project in project_list:
        key = keys.get(project.id)
        if key:
            project.member_dsn = key.get_dsn()

        member = memberships.get(project.team_id)
        if member:
            project.member_type = member.get_type_display()

    return render_to_response('sentry/projects/list.html', {
        'PROJECT_LIST': project_list,
    }, request)


@login_required
def new_project(request):
    if not can_create_projects(request.user):
        return HttpResponseRedirect(reverse('sentry'))

    return render_to_response('sentry/projects/new.html', {}, request)


@login_required
@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, project):
    if str(project.id) == str(settings.PROJECT):
        return HttpResponseRedirect(reverse('sentry-project-list'))

    if not can_remove_project(request.user, project):
        return HttpResponseRedirect(reverse('sentry'))

    project_list = filter(lambda x: x != project, get_project_list(request.user).itervalues())

    form = RemoveProjectForm(request.user, project_list, request.POST or None)

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

    team_list = get_team_list(request.user)

    form = EditProjectForm(request, team_list, request.POST or None, instance=project)

    if form.is_valid():
        project = form.save()

        return HttpResponseRedirect(request.path + '?success=1')

    member_list = [(tm, tm.user) for tm in project.team.member_set.select_related('user')]

    context = csrf(request)
    context.update({
        'can_remove_project': can_remove_project(request.user, project),
        'page': 'details',
        'form': form,
        'project': project,
        'member_list': member_list,
        'TEAM_LIST': team_list.values(),
    })

    return render_to_response('sentry/projects/manage.html', context, request)


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
