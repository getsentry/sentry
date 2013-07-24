"""
sentry.web.helpers
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging
import warnings

from django.conf import settings
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponse
from django.template import loader, RequestContext, Context
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe

from sentry.constants import MEMBER_OWNER, EVENTS_PER_PAGE
from sentry.models import Project, Team, Option, ProjectOption, ProjectKey

logger = logging.getLogger('sentry.errors')


def get_project_list(user=None, access=None, hidden=False, key='id', team=None):
    warnings.warn('get_project_list is Deprecated. Use Project.objects.get_for_user instead.', DeprecationWarning)
    return SortedDict(
        (getattr(p, key), p)
        for p in Project.objects.get_for_user(user, access)
    )


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
    if group.project in get_project_list(user).values():
        return False
    return True


def get_team_list(user, access=None):
    warnings.warn('get_team_list is Deprecated. Use Team.objects.get_for_user instead.', DeprecationWarning)
    return Team.objects.get_for_user(user, access)


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


def get_internal_project():
    try:
        project = Project.objects.get(id=settings.SENTRY_PROJECT)
    except Project.DoesNotExist:
        return {}
    try:
        projectkey = ProjectKey.objects.filter(project=project).order_by('-user')[0]
    except IndexError:
        return {}

    return {
        'id': project.id,
        'dsn': projectkey.get_dsn(public=True)
    }


def get_default_context(request, existing_context=None, team=None):
    from sentry.plugins import plugins

    context = {
        'HAS_SEARCH': settings.SENTRY_USE_SEARCH,
        'EVENTS_PER_PAGE': EVENTS_PER_PAGE,
        'URL_PREFIX': settings.SENTRY_URL_PREFIX,
        'PLUGINS': plugins,
    }

    if request:
        if existing_context and not team and 'team' in existing_context:
            team = existing_context['team']

        context.update({
            'request': request,
        })
        if team:
            # TODO: remove this extra query
            context.update({
                'can_admin_team': [team in Team.objects.get_for_user(request.user, MEMBER_OWNER)],
            })

        if not existing_context or 'TEAM_LIST' not in existing_context:
            context['TEAM_LIST'] = Team.objects.get_for_user(
                request.user, with_projects=True).values()

        if not existing_context or 'PROJECT_LIST' not in existing_context:
            # HACK:
            for t, p_list in context['TEAM_LIST']:
                if t == team:
                    context['PROJECT_LIST'] = p_list
                    break

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

    initials = plugin.get_form_initial(project)
    for field in form_class.base_fields:
        key = '%s:%s' % (plugin_key, field)
        if project:
            value = ProjectOption.objects.get_value(project, key, NOTSET)
        else:
            value = Option.objects.get_value(key, NOTSET)
        if value is not NOTSET:
            initials[field] = value

    form = form_class(
        request.POST or None,
        initial=initials,
        prefix=plugin_key
    )
    if form.is_valid():
        for field, value in form.cleaned_data.iteritems():
            key = '%s:%s' % (plugin_key, field)
            if project:
                ProjectOption.objects.set_value(project, key, value)
            else:
                Option.objects.set_value(key, value)

        return ('redirect', None)

    from django.template.loader import render_to_string
    return ('display', mark_safe(render_to_string(template, {
        'form': form,
        'request': request,
        'plugin': plugin,
        'plugin_description': plugin.get_description() or '',
    }, context_instance=RequestContext(request))))


def get_raven_js_url():
    return settings.SENTRY_RAVEN_JS_URL
