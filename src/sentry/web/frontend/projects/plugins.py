"""
sentry.web.frontend.projects.plugins
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_OWNER
from sentry.plugins import plugins
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response, plugin_config


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
