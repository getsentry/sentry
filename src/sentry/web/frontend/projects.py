"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from django.utils.translation import ugettext_lazy as _

from sentry import app
from sentry.constants import (
    MEMBER_OWNER, STATUS_HIDDEN, DEFAULT_ALERT_PROJECT_THRESHOLD)
from sentry.models import Project, ProjectKey, Team, TagKey
from sentry.permissions import (
    can_remove_project, can_add_project_key, can_remove_project_key)
from sentry.plugins import plugins
from sentry.web.decorators import login_required, has_access
from sentry.web.forms.projects import (
    ProjectTagsForm, RemoveProjectForm, EditProjectForm,
    NotificationTagValuesForm, AlertSettingsForm, ProjectQuotasForm)
from sentry.web.helpers import render_to_response, plugin_config


@login_required
@has_access
def get_started(request, team, project):
    return render_to_response('sentry/get_started.html', {
        'project': project,
        'team': project.team,
    }, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, team, project):
    if not can_remove_project(request.user, project):
        return HttpResponseRedirect(reverse('sentry'))

    project_list = filter(lambda x: x != project, Project.objects.get_for_user(request.user))

    form = RemoveProjectForm(request.user, project_list, request.POST or None)

    if form.is_valid():
        removal_type = form.cleaned_data['removal_type']
        if removal_type == '1':
            from sentry.tasks.deletion import delete_project

            delete_project.delay(object_id=project.id)
            project.update(status=STATUS_HIDDEN)

            messages.add_message(request, messages.SUCCESS,
                _('Deletion has been queued and should occur shortly.'))
        elif removal_type == '2':
            new_project = form.cleaned_data['project']
            project.merge_to(new_project)
        elif removal_type == '3':
            project.update(status=STATUS_HIDDEN)
        else:
            raise ValueError(removal_type)

        return HttpResponseRedirect(reverse('sentry-manage-team-projects', args=[project.team.slug]))

    context = csrf(request)
    context.update({
        'team': team,
        'form': form,
        'project': project,
    })

    return render_to_response('sentry/projects/remove.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_project(request, team, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    team_list = Team.objects.get_for_user(project.owner or request.user, MEMBER_OWNER)

    form = EditProjectForm(request, team_list, request.POST or None, instance=project, initial={
        'origins': '\n'.join(project.get_option('sentry:origins', None) or []),
        'owner': project.owner,
        'resolve_age': int(project.get_option('sentry:resolve_age', 0)),
    })

    if form.is_valid():
        project = form.save()
        project.update_option('sentry:origins', form.cleaned_data.get('origins') or [])
        project.update_option('sentry:resolve_age', form.cleaned_data.get('resolve_age'))
        messages.add_message(
            request, messages.SUCCESS,
            _('Changes to your project were saved.'))

        return HttpResponseRedirect(reverse('sentry-manage-project', args=[team.slug, project.slug]))

    context = csrf(request)
    context.update({
        'team': team,
        'can_remove_project': can_remove_project(request.user, project),
        'page': 'details',
        'form': form,
        'project': project,
    })

    return render_to_response('sentry/projects/manage.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_project_keys(request, team, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    key_list = list(ProjectKey.objects.filter(
        project=project,
    ).select_related('user', 'user_added').order_by('-id'))

    for key in key_list:
        key.project = project
        key.can_remove = can_remove_project_key(request.user, key),

    context = csrf(request)
    context.update({
        'team': team,
        'page': 'keys',
        'project': project,
        'key_list': key_list,
        'can_add_key': can_add_project_key(request.user, project),
    })

    return render_to_response('sentry/projects/keys.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def new_project_key(request, team, project):
    if not can_add_project_key(request.user, project):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    ProjectKey.objects.create(
        project=project,
        user_added=request.user,
    )

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))


@require_http_methods(['POST'])
@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project_key(request, team, project, key_id):
    try:
        key = ProjectKey.objects.get(id=key_id)
    except ProjectKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    if not can_remove_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    key.delete()
    messages.add_message(
        request, messages.SUCCESS,
        _('The API key (%s) was revoked.') % (key.public_key,))

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))


@has_access(MEMBER_OWNER)
def manage_project_tags(request, team, project):
    tag_list = filter(
        lambda x: not x.startswith('sentry:'),
        TagKey.objects.all_keys(project))

    if tag_list:
        form = ProjectTagsForm(project, tag_list, request.POST or None)
    else:
        form = None

    if form and form.is_valid():
        form.save()

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-manage-project-tags', args=[project.team.slug, project.slug]))

    context = {
        'team': team,
        'tag_list': tag_list,
        'page': 'tags',
        'project': project,
        'form': form,
    }
    return render_to_response('sentry/projects/manage_tags.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def notification_settings(request, team, project):
    initial = project.get_option('notifcation:tags', {})

    tag_forms = []
    for tag in TagKey.objects.all_keys(project):
        tag_forms.append(NotificationTagValuesForm(
            project=project,
            tag=tag,
            data=request.POST or None,
            prefix='tag-%s' % (tag,),
            initial={
                'values': ', '.join(initial.get(tag, [])),
            },
        ))

    threshold, min_events = project.get_option(
        'alert:threshold', DEFAULT_ALERT_PROJECT_THRESHOLD)

    alert_form = AlertSettingsForm(
        data=request.POST or None,
        prefix='alert',
        initial={
            'pct_threshold': threshold,
            'min_events': min_events,
        }
    )

    if request.method == 'POST' and all(f.is_valid() for f in tag_forms) and alert_form.is_valid():
        tags = {}
        for form in tag_forms:
            values = form.cleaned_data['values']
            if values:
                tags[form.tag] = values
        project.update_option('notifcation:tags', tags)

        project.update_option('alert:threshold', (
            alert_form.cleaned_data['pct_threshold'], alert_form.cleaned_data['min_events']))

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-project-notifications', args=[project.team.slug, project.slug]))

    context = csrf(request)
    context.update({
        'team': team,
        'project': project,
        'alert_form': alert_form,
        'tag_forms': tag_forms,
        'page': 'notifications',
    })
    return render_to_response('sentry/projects/notifications.html', context, request)


@has_access(MEMBER_OWNER)
def manage_project_quotas(request, team, project):
    from sentry.quotas.base import Quota

    form = ProjectQuotasForm(project, request.POST or None)

    if form and form.is_valid():
        form.save()

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-manage-project-quotas', args=[project.team.slug, project.slug]))

    context = {
        'team': team,
        'page': 'quotas',
        # TODO(dcramer): has_quotas is an awful hack
        'has_quotas': type(app.quotas) != Quota,
        'system_quota': app.quotas.get_system_quota(),
        'team_quota': app.quotas.get_team_quota(team),
        'project': project,
        'form': form,
    }
    return render_to_response('sentry/projects/quotas.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_plugins(request, team, project):
    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    if request.POST:
        enabled = set(request.POST.getlist('plugin'))
        for plugin in plugins.all():
            if plugin.can_enable_for_projects():
                plugin.set_option('enabled', plugin.slug in enabled, project)

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'team': team,
        'page': 'plugins',
        'project': project,
    })

    return render_to_response('sentry/projects/plugins/list.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def configure_project_plugin(request, team, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.team.slug, project.slug]))

    if not plugin.can_enable_for_projects():
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.team.slug, project.slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    form = plugin.project_conf_form
    if form is None:
        return HttpResponseRedirect(reverse('sentry-manage-project', args=[project.team.slug, project.slug]))

    action, view = plugin_config(plugin, project, request)
    if action == 'redirect':
        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'team': team,
        'page': 'plugin',
        'title': plugin.get_title(),
        'view': view,
        'project': project,
        'plugin': plugin,
        'plugin_is_enabled': plugin.is_enabled(project),
    })

    return render_to_response('sentry/projects/plugins/configure.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def reset_project_plugin(request, team, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.team.slug, project.slug, slug]))

    if not plugin.is_enabled(project):
        return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.team.slug, project.slug, slug]))

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.reset_options(project=project)

    return HttpResponseRedirect(reverse('sentry-configure-project-plugin', args=[project.team.slug, project.slug, slug]))


@has_access(MEMBER_OWNER)
@csrf_protect
def enable_project_plugin(request, team, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project-plugins', args=[project.team.slug, project.slug]))

    redirect_to = reverse('sentry-configure-project-plugin', args=[project.team.slug, project.slug, slug])

    if plugin.is_enabled(project) or not plugin.can_enable_for_projects():
        return HttpResponseRedirect(redirect_to)

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.set_option('enabled', True, project)

    return HttpResponseRedirect(redirect_to)


@has_access(MEMBER_OWNER)
@csrf_protect
def disable_project_plugin(request, team, project, slug):
    try:
        plugin = plugins.get(slug)
    except KeyError:
        return HttpResponseRedirect(reverse('sentry-manage-project-plugins', args=[project.team.slug, project.slug]))

    redirect_to = reverse('sentry-configure-project-plugin', args=[project.team.slug, project.slug, slug])

    if not (plugin.can_disable and plugin.is_enabled(project) and plugin.can_enable_for_projects()):
        return HttpResponseRedirect(redirect_to)

    result = plugins.first('has_perm', request.user, 'configure_project_plugin', project, plugin)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    plugin.set_option('enabled', False, project)

    return HttpResponseRedirect(redirect_to)
