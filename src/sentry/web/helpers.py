"""
sentry.web.helpers
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponse
from django.template import loader, RequestContext, Context
from django.utils.safestring import mark_safe

from sentry import options
from sentry.constants import EVENTS_PER_PAGE
from sentry.models import Project, Team, ProjectOption

logger = logging.getLogger('sentry.errors')


def group_is_public(group, user):
    """
    Return ``True`` if the this group if the user viewing it should see a restricted view.

    This check should be used in combination with project membership checks, as we're only
    verifying if the user should have a restricted view of something they already have access
    to.
    """
    # if the group isn't public, this check doesn't matter
    if not group.is_public:
        return False
    # anonymous users always are viewing as if it were public
    if not user.is_authenticated():
        return True
    # superusers can always view events
    if user.is_superuser:
        return False
    # project owners can view events
    if group.project in Project.objects.get_for_user(team=group.project.team, user=user):
        return False
    return True


_LOGIN_URL = None


def get_login_url(reset=False):
    global _LOGIN_URL

    if _LOGIN_URL is None or reset:
        # if LOGIN_URL resolves force login_required to it instead of our own
        # XXX: this must be done as late as possible to avoid idempotent requirements
        try:
            resolve(settings.LOGIN_URL)
        except Exception:
            _LOGIN_URL = settings.SENTRY_LOGIN_URL
        else:
            _LOGIN_URL = settings.LOGIN_URL

        if _LOGIN_URL is None:
            _LOGIN_URL = reverse('sentry-login')
    return _LOGIN_URL


def get_default_context(request, existing_context=None, team=None):
    from sentry.plugins import plugins

    context = {
        'EVENTS_PER_PAGE': EVENTS_PER_PAGE,
        'URL_PREFIX': settings.SENTRY_URL_PREFIX,
        'PLUGINS': plugins,
        'ALLOWED_HOSTS': settings.ALLOWED_HOSTS,
        'SENTRY_RAVEN_JS_URL': settings.SENTRY_RAVEN_JS_URL,
    }

    if request:
        if existing_context and not team and 'team' in existing_context:
            team = existing_context['team']

        if team:
            context['organization'] = team.organization

        context.update({
            'request': request,
        })

        if (not existing_context or 'TEAM_LIST' not in existing_context) and team:
            context['TEAM_LIST'] = Team.objects.get_for_user(
                organization=team.organization,
                user=request.user,
                with_projects=True,
            )

    return context


def render_to_string(template, context=None, request=None):

    # HACK: set team session value for dashboard redirect
    if context and 'team' in context and isinstance(context['team'], Team):
        team = context['team']
    else:
        team = None

    default_context = get_default_context(request, context, team=team)

    if context is None:
        context = default_context
    else:
        context = dict(context)
        context.update(default_context)

    if request:
        context = RequestContext(request, context)
    else:
        context = Context(context)

    return loader.render_to_string(template, context)


def render_to_response(template, context=None, request=None, status=200):
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status

    return response


def plugin_config(plugin, project, request):
    """
    Configure the plugin site wide.

    Returns a tuple composed of a redirection boolean and the content to
    be displayed.
    """
    NOTSET = object()

    plugin_key = plugin.get_conf_key()
    if project:
        form_class = plugin.project_conf_form
        template = plugin.project_conf_template
    else:
        form_class = plugin.site_conf_form
        template = plugin.site_conf_template

    test_results = None

    initials = plugin.get_form_initial(project)
    for field in form_class.base_fields:
        key = '%s:%s' % (plugin_key, field)
        if project:
            value = ProjectOption.objects.get_value(project, key, NOTSET)
        else:
            value = options.get(key)
        if value is not NOTSET:
            initials[field] = value

    form = form_class(
        request.POST or None,
        initial=initials,
        prefix=plugin_key
    )
    if form.is_valid():
        if 'action_test' in request.POST and plugin.is_testable():
            try:
                test_results = plugin.test_configuration(project)
            except Exception as exc:
                if hasattr(exc, 'read') and callable(exc.read):
                    test_results = '%s\n%s' % (exc, exc.read())
                else:
                    test_results = exc
            if test_results is None:
                test_results = 'No errors returned'
        else:
            for field, value in form.cleaned_data.iteritems():
                key = '%s:%s' % (plugin_key, field)
                if project:
                    ProjectOption.objects.set_value(project, key, value)
                else:
                    options.set(key, value)

            return ('redirect', None)

    # TODO(mattrobenolt): Reliably determine if a plugin is configured
    # if hasattr(plugin, 'is_configured'):
    #     is_configured = plugin.is_configured(project)
    # else:
    #     is_configured = True
    is_configured = True

    from django.template.loader import render_to_string
    return ('display', mark_safe(render_to_string(template, {
        'form': form,
        'request': request,
        'plugin': plugin,
        'plugin_description': plugin.get_description() or '',
        'plugin_test_results': test_results,
        'plugin_is_configured': is_configured,
    }, context_instance=RequestContext(request))))


def get_raven_js_url():
    return settings.SENTRY_RAVEN_JS_URL
