"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from crispy_forms.helper import FormHelper
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import TeamMember, ProjectKey, Team, FilterKey
from sentry.permissions import can_create_projects, can_remove_project, can_create_teams
from sentry.plugins import plugins
from sentry.plugins.helpers import set_option, get_option
from sentry.web.decorators import login_required, has_access
from sentry.web.forms.projects import NewProjectForm, NewProjectAdminForm,\
  ProjectTagsForm, EditProjectForm, RemoveProjectForm, EditProjectAdminForm
from sentry.web.forms.teams import NewTeamForm, SelectTeamForm
from sentry.web.helpers import render_to_response, get_project_list, \
  plugin_config


@login_required
def project_list(request):
    project_list = get_project_list(request.user, hidden=True).values()
    team_list = dict((t.id, t) for t in Team.objects.filter(pk__in=[p.team_id for p in project_list]))
    if request.user.is_authenticated():
        memberships = dict((tm.team_id, tm) for tm in TeamMember.objects.filter(user=request.user, team__in=team_list))
        keys = dict((p.project_id, p) for p in ProjectKey.objects.filter(user=request.user, project__in=project_list))
    else:
        memberships = {}
        keys = {}

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
    from django.contrib.auth.models import User

    if not can_create_projects(request.user):
        return HttpResponseRedirect(reverse('sentry'))

    allow_create_teams = can_create_teams(request.user)
    team_list = Team.objects.get_for_user(request.user)

    if request.user.has_perm('sentry.can_add_project') and User.objects.all()[0:2] == 2:
        project_form_cls = NewProjectAdminForm
        project_initial = {
            'owner': request.user.username,
        }
    else:
        project_form_cls = NewProjectForm
        project_initial = {}

    if len(team_list) > 0:
        select_team_form = SelectTeamForm(team_list, request.POST or None, prefix='st')
    elif not allow_create_teams:
        return render_to_response('sentry/projects/cannot_create_teams.html', {}, request)
    else:
        select_team_form = None

    if allow_create_teams:
        new_team_form = NewTeamForm(request.POST or None, prefix='nt')
    else:
        new_team_form = None

    project_form = project_form_cls(request.POST or None, initial=project_initial, prefix='prj')

    is_new_team = new_team_form and new_team_form.is_valid()
    if is_new_team or not select_team_form:
        team_form = new_team_form
    else:
        team_form = select_team_form

    if project_form.is_valid() and team_form.is_valid():
        project = project_form.save(commit=False)
        if not project.owner:
            project.owner = request.user
        if is_new_team:
            team = new_team_form.save(commit=False)
            team.owner = project.owner
            team.save()
        else:
            team = select_team_form.cleaned_data['team']
        project.team = team
        project.save()
        return HttpResponseRedirect(reverse('sentry-project-client-help', args=[project.slug]))

    return render_to_response('sentry/projects/new.html', {
        'project_form': project_form,
        'select_team_form': select_team_form,
        'new_team_form': new_team_form,
    }, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, project):
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


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_project(request, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    # XXX: We probably shouldnt allow changing the team unless they're the project owner
    team_list = Team.objects.get_for_user(project.owner or request.user, MEMBER_OWNER)

    if request.user.has_perm('sentry.can_change_project'):
        form_cls = EditProjectAdminForm
    else:
        form_cls = EditProjectForm

    form = form_cls(request, team_list, request.POST or None, instance=project, initial={
        'origins': '\n'.join(get_option('sentry:origins', project) or []),
        'owner': project.owner,
    })

    if form.is_valid():
        project = form.save()
        set_option('sentry:origins', form.cleaned_data.get('origins') or [], project)
        return HttpResponseRedirect(request.path + '?success=1')

    if not project.team:
        member_list = []
    else:
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


@has_access(MEMBER_USER)
def client_help(request, project):
    try:
        key = ProjectKey.objects.get(user=request.user, project=project)
    except ProjectKey.DoesNotExist:
        key = None  # superuser

    context = {
        'can_remove_project': can_remove_project(request.user, project),
        'page': 'client_help',
        'project': project,
        'key': key,
    }
    if key:
        context.update({
            'dsn': key.get_dsn(),
            'dsn_public': key.get_dsn(public=True),
        })
    return render_to_response('sentry/projects/client_help.html', context, request)


@has_access(MEMBER_OWNER)
def manage_project_tags(request, project):
    tag_list = FilterKey.objects.all_keys(project)
    if tag_list:
        form = ProjectTagsForm(project, tag_list, request.POST or None)
    else:
        form = None

    helper = FormHelper()
    helper.form_tag = False

    if form and form.is_valid():
        form.save()
        return HttpResponseRedirect(reverse('sentry-manage-project-tags', args=[project.slug]) + '?success=1')

    context = {
        'tag_list': tag_list,
        'page': 'tags',
        'project': project,
        'form': form,
        'helper': helper,
    }
    return render_to_response('sentry/projects/manage_tags.html', context, request)


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


@has_access(MEMBER_OWNER)
@csrf_protect
def configure_project_plugin(request, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.slug]))

    if not plugin.is_enabled(project):
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    form = plugin.project_conf_form
    if form is None:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.slug]))

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


@has_access(MEMBER_OWNER)
@csrf_protect
def reset_project_plugin(request, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    if not plugin.is_enabled(project):
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.reset_options(project=project)

    return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))


@has_access(MEMBER_OWNER)
@csrf_protect
def enable_project_plugin(request, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    if plugin.is_enabled(project) or not plugin.can_enable_for_projects():
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.set_option('enabled', True, project)

    return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))


@has_access(MEMBER_OWNER)
@csrf_protect
def disable_project_plugin(request, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    if not plugin.is_enabled(project) or not plugin.can_enable_for_projects():
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.slug, slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.set_option('enabled', False, project)

    return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.slug]))
