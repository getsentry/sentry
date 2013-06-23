"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.constants import (
    PLATFORM_LIST, PLATFORM_TITLES, PLATFORM_ROOTS)
from sentry.models import ProjectKey
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response, render_to_string, get_raven_js_url


def get_key_context(user, project):
    try:
        key = ProjectKey.objects.get(user=user, project=project)
    except ProjectKey.DoesNotExist:
        try:
            key = ProjectKey.objects.filter(
                project=project,
                user__isnull=True,
            )[0]
        except IndexError:
            key = None

    if key is None:
        dsn = 'SENTRY_DSN'
        dsn_public = 'SENTRY_PUBLIC_DSN'
    else:
        dsn = key.dsn_private
        dsn_public = key.dsn_public

    return {
        'key': key,
        'dsn': dsn,
        'dsn_public': dsn_public,
        'raven_js_url': get_raven_js_url(),
    }


@has_access
def client_help(request, team, project):
    context = {
        'page': 'client_help',
        'project': project,
        'team': project.team,
        'SUBSECTION': 'projects',
        'SECTION': 'team',
    }
    context.update(get_key_context(request.user, project))

    return render_to_response('sentry/projects/client_help.html', context, request)


@has_access
def client_guide(request, team, project, platform):
    if platform not in PLATFORM_LIST:
        return HttpResponseRedirect(reverse('sentry'))

    template = 'sentry/partial/client_config/%s.html' % (platform,)

    context = {
        'platform': platform,
        'platform_title': PLATFORM_TITLES.get(platform, platform.title()),
        'project': project,
        'page': 'client_help_%s' % (PLATFORM_ROOTS.get(platform, platform),),
        'team': project.team,
        'SUBSECTION': 'projects',
        'SECTION': 'team',
    }
    context.update(get_key_context(request.user, project))

    if request.is_ajax():
        return render_to_response(template, context, request)

    context['template'] = render_to_string(template, context, request)

    return render_to_response('sentry/projects/docs/client_config.html', context, request)
