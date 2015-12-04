"""
sentry.web.helpers
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponse
from django.template import loader, RequestContext, Context

from sentry.api.serializers.base import serialize
from sentry.auth import access
from sentry.constants import EVENTS_PER_PAGE
from sentry.models import Team

logger = logging.getLogger('sentry')


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
    from sentry import options
    from sentry.plugins import plugins

    context = {
        'EVENTS_PER_PAGE': EVENTS_PER_PAGE,
        'URL_PREFIX': options.get('system.url-prefix'),
        'SINGLE_ORGANIZATION': settings.SENTRY_SINGLE_ORGANIZATION,
        'PLUGINS': plugins,
        'ALLOWED_HOSTS': list(settings.ALLOWED_HOSTS),
    }

    if existing_context:
        if team is None and 'team' in existing_context:
            team = existing_context['team']

        if 'project' in existing_context:
            project = existing_context['project']
        else:
            project = None
    else:
        project = None

    if team:
        organization = team.organization
    elif project:
        organization = project.organization
    else:
        organization = None

    if request:
        context.update({
            'request': request,
        })

        if (not existing_context or 'TEAM_LIST' not in existing_context) and team:
            context['TEAM_LIST'] = Team.objects.get_for_user(
                organization=team.organization,
                user=request.user,
                with_projects=True,
            )

        user = request.user
    else:
        user = AnonymousUser()

    if organization:
        context['selectedOrganization'] = serialize(organization, user)
    if team:
        context['selectedTeam'] = serialize(team, user)
    if project:
        context['selectedProject'] = serialize(project, user)

    if not existing_context or 'ACCESS' not in existing_context:
        if request:
            context['ACCESS'] = access.from_request(
                request=request,
                organization=organization,
            ).to_django_context()
        else:
            context['ACCESS'] = access.from_user(
                user=user,
                organization=organization,
            ).to_django_context()

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


def render_to_response(template, context=None, request=None, status=200,
                       content_type='text/html'):
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status
    response['Content-Type'] = content_type
    return response
